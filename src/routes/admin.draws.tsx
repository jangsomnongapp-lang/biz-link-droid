import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Trophy,
  Gift,
  Inbox,
  Clock,
  PlusSquare,
  Dice5,
  Sparkles,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/draws")({
  component: () => (
    <RequireAuth>
      <AdminDrawsPage />
    </RequireAuth>
  ),
});

interface DrawRow {
  id: string;
  draw_type: "daily" | "weekly" | "monthly" | string;
  draw_date: string;
  prize_title: string;
  status: string;
  winner_user_id: string | null;
  winning_ticket_id: string | null;
  drawn_at: string | null;
  published_at: string | null;
}

const DRAW_META: Record<string, { label: string; price: string; emoji: string }> = {
  daily: { label: "Daily", price: "$1", emoji: "🎟️" },
  weekly: { label: "Weekly", price: "$15", emoji: "🏅" },
  monthly: { label: "Monthly", price: "$40", emoji: "🏆" },
};

function periodStart(type: string): string {
  const now = new Date();
  if (type === "daily") return now.toISOString().slice(0, 10);
  if (type === "weekly") {
    const d = new Date(now);
    const day = d.getDay(); // 0 = Sun
    const diff = (day + 6) % 7; // back to Monday
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  }
  // monthly
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function AdminDrawsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [winners, setWinners] = useState<Record<string, { full_name: string | null }>>({});
  const [selectedType, setSelectedType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [participants, setParticipants] = useState<number>(0);
  const [prizesPaid, setPrizesPaid] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [pendingClaims, setPendingClaims] = useState<number>(0);

  // The active draw for the currently selected type (today / this week / this month)
  const activeDraw = useMemo(() => {
    const start = periodStart(selectedType);
    return draws.find((d) => d.draw_type === selectedType && d.draw_date === start) ?? null;
  }, [draws, selectedType]);

  const winnerName = activeDraw?.winner_user_id
    ? winners[activeDraw.winner_user_id]?.full_name ?? activeDraw.winner_user_id.slice(0, 8)
    : null;

  async function loadAll() {
    if (!user) return;
    const me = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me.data?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const [{ data: drawData }, { count: paidCount }, { count: claimsCount }] = await Promise.all([
      supabase
        .from("lottery_draws")
        .select("*")
        .order("draw_date", { ascending: false })
        .limit(50),
      supabase
        .from("lottery_draws")
        .select("id", { count: "exact", head: true })
        .eq("status", "drawn"),
      supabase
        .from("prize_claims")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const rows = (drawData ?? []) as DrawRow[];
    setDraws(rows);
    setPrizesPaid(paidCount ?? 0);
    setPendingClaims(claimsCount ?? 0);

    const winnerIds = rows.map((d) => d.winner_user_id).filter(Boolean) as string[];
    if (winnerIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", winnerIds);
      const m: Record<string, { full_name: string | null }> = {};
      for (const p of ps ?? []) m[p.id] = { full_name: p.full_name };
      setWinners(m);
    }
    setLoading(false);
  }

  async function loadParticipants(type: string) {
    const start = periodStart(type);
    const { count } = await supabase
      .from("lottery_tickets")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type", type)
      .eq("draw_period_start", start)
      .eq("status", "active");
    setParticipants(count ?? 0);
  }

  useEffect(() => {
    void loadAll();
  }, [user]);

  useEffect(() => {
    if (isAdmin) void loadParticipants(selectedType);
  }, [isAdmin, selectedType, draws]);

  async function ensureScheduled() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("ensure_scheduled_draws");
    if (error) toast.error(error.message);
    else {
      toast.success("Schedule synced");
      void loadAll();
    }
  }

  async function autoDraw() {
    if (!activeDraw) {
      toast.error("No active draw — sync schedule first");
      return;
    }
    if (activeDraw.status !== "scheduled") {
      toast.message("Draw already completed");
      return;
    }
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("run_lottery_draw", {
      _draw_id: activeDraw.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; reason?: string };
    if (!result?.ok) toast.warning(`No winner: ${result?.reason ?? "no entries"}`);
    else toast.success("Winner drawn 🎉");
    void loadAll();
  }

  async function setManualWinner() {
    if (!activeDraw) {
      toast.error("No active draw");
      return;
    }
    const num = Number(manualNumber);
    if (!Number.isInteger(num) || num <= 0) {
      toast.error("Enter a valid ticket number");
      return;
    }
    setBusy(true);
    const { data: ticket, error: tErr } = await supabase
      .from("lottery_tickets")
      .select("id, user_id, status")
      .eq("ticket_type", selectedType)
      .eq("draw_period_start", periodStart(selectedType))
      .eq("ticket_number", num)
      .maybeSingle();

    if (tErr || !ticket) {
      setBusy(false);
      toast.error("Ticket not found for this draw period");
      return;
    }

    const { error: uErr } = await supabase
      .from("lottery_draws")
      .update({
        winner_user_id: ticket.user_id,
        winning_ticket_id: ticket.id,
        status: "drawn",
        drawn_at: new Date().toISOString(),
      })
      .eq("id", activeDraw.id);

    setBusy(false);
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success(`Winner set: #${num}`);
    setManualNumber("");
    void loadAll();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1530] text-sm text-white/70">
        Loading…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1530] text-white p-6 text-center">
        <div>
          <p className="font-medium">Admins only.</p>
          <Link to="/home" className="text-sm text-orange-300 underline mt-2 inline-block">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const recent = draws.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#1a1530] text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#1a1530]/95 px-4 py-3 backdrop-blur">
        <Link to="/home" className="rounded-full p-1.5 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-base font-semibold">BuildHub Rewards</h1>
        <button
          onClick={ensureScheduled}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Sync schedule
        </button>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {/* LEFT — Profile card */}
          <section>
            <p className="mb-2 text-center text-xs font-medium text-white/60">
              BuildHub Rewards profile
            </p>
            <div className="rounded-2xl border-2 border-orange-500/60 bg-[#231a3d] p-5 shadow-xl">
              <div className="flex justify-end">
                <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-300">
                  Admin
                </span>
              </div>
              <div className="-mt-4 flex flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-500/90 text-3xl shadow-lg">
                  🎁
                </div>
                <h2 className="mt-3 text-lg font-bold">BuildHub Rewards</h2>
                <p className="text-xs text-orange-300">Official prize account</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat label="Participants" value={participants} />
                <Stat label="Prizes paid" value={prizesPaid} />
              </div>

              <div className="mt-5 space-y-2.5">
                <ActionRow
                  icon={<PlusSquare className="h-4 w-4" />}
                  title="New post"
                  subtitle="Shows · flyers · winners"
                  highlight
                  to="/announce"
                />
                <ActionRow
                  icon={<Inbox className="h-4 w-4" />}
                  title="Prize inbox"
                  badge={pendingClaims > 0 ? `${pendingClaims} new` : undefined}
                  to="/admin/posts"
                />
                <ActionRow
                  icon={<Clock className="h-4 w-4" />}
                  title="Pending claims"
                  badge={pendingClaims > 0 ? `${pendingClaims}` : undefined}
                  to="/admin/posts"
                />
                <div className="rounded-xl border-2 border-orange-500/60 bg-[#1a1530] p-3">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="h-4 w-4 text-orange-400" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-orange-300">Run draw</div>
                      <div className="text-[11px] text-white/50">Daily · Weekly · Monthly</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT — Run draw panel */}
          <section>
            <p className="mb-2 text-center text-xs font-medium text-white/60">Run draw panel</p>
            <div className="rounded-2xl border border-white/10 bg-[#231a3d] p-5 shadow-xl">
              <div className="text-center">
                <h3 className="text-base font-bold">Run draw</h3>
                <p className="text-[11px] text-white/50">
                  {activeDraw ? activeDraw.prize_title : "Select draw type first"}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wide text-white/50">Draw type</p>
                <div className="mt-2 space-y-2">
                  {(["daily", "weekly", "monthly"] as const).map((t) => {
                    const meta = DRAW_META[t];
                    const isActive = selectedType === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setSelectedType(t)}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          isActive
                            ? "bg-orange-500 text-white shadow-md"
                            : "bg-[#1a1530] text-white/80 hover:bg-[#1a1530]/70"
                        }`}
                      >
                        <span>{meta.emoji}</span>
                        <span>
                          {meta.label} · {meta.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-[#1a1530] p-4 text-center">
                <p className="text-[11px] uppercase tracking-wide text-white/50">
                  Active participants
                </p>
                <p className="mt-1 text-3xl font-extrabold text-white">{participants}</p>
                <p className="text-[11px] text-white/50">tickets in this draw</p>
              </div>

              <button
                onClick={autoDraw}
                disabled={busy || !activeDraw || activeDraw.status !== "scheduled"}
                className="mt-4 flex w-full flex-col items-center rounded-xl bg-orange-500 px-3 py-3 text-sm font-bold text-white shadow-md transition hover:bg-orange-400 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Dice5 className="h-4 w-4" /> Auto draw
                </span>
                <span className="text-[11px] font-medium text-white/80">
                  Random winner selected
                </span>
              </button>

              {activeDraw?.status === "drawn" && winnerName && (
                <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                    Winner selected
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-white">
                    {activeDraw.winning_ticket_id ? "🎉" : ""} {winnerName}
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={autoDraw}
                      disabled
                      className="rounded-md bg-rose-900/60 px-3 py-1 text-xs font-semibold text-rose-200 opacity-70"
                    >
                      Retry
                    </button>
                    <span className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      Drawn ✓
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <p className="text-[11px] text-white/50">Or enter manually</p>
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#1a1530] px-3 py-2">
                  <span className="text-white/40">#</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ticket number"
                    value={manualNumber}
                    onChange={(e) => setManualNumber(e.target.value)}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  />
                </div>
                <button
                  onClick={setManualWinner}
                  disabled={busy || !manualNumber || !activeDraw}
                  className="mt-3 w-full rounded-xl border-2 border-orange-500/60 px-3 py-2.5 text-sm font-semibold text-orange-300 hover:bg-orange-500/10 disabled:opacity-50"
                >
                  Set manual winner
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Recent draws */}
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-white/80">Recent draws</h3>
          {recent.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/50">
              <CalendarIcon className="mx-auto mb-2 h-5 w-5" />
              No draws yet — tap “Sync schedule”.
            </div>
          )}
          <div className="space-y-2">
            {recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#231a3d] p-3"
              >
                <Gift className="h-4 w-4 text-orange-400" />
                <div className="flex-1">
                  <div className="text-sm font-semibold capitalize">
                    {d.draw_type}{" "}
                    <span className="text-xs font-normal text-white/50">· {d.draw_date}</span>
                  </div>
                  <div className="text-xs text-white/60">{d.prize_title}</div>
                  {d.winner_user_id && (
                    <div className="text-[11px] text-white/50">
                      Winner:{" "}
                      <span className="font-medium text-white/80">
                        {winners[d.winner_user_id]?.full_name ?? d.winner_user_id.slice(0, 8)}
                      </span>
                    </div>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    d.status === "drawn"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : d.status === "no_entries"
                        ? "bg-white/10 text-white/60"
                        : "bg-orange-500/20 text-orange-300"
                  }`}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#1a1530] p-3 text-center">
      <p className="text-2xl font-extrabold text-orange-400">{value}</p>
      <p className="text-[11px] text-white/60">{label}</p>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  badge,
  highlight,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  highlight?: boolean;
  to?: string;
}) {
  const inner = (
    <div
      className={`flex items-center gap-2.5 rounded-xl p-3 transition ${
        highlight
          ? "bg-orange-500 text-white hover:bg-orange-400"
          : "bg-[#1a1530] text-white/85 hover:bg-[#1a1530]/70"
      }`}
    >
      <span className={highlight ? "text-white" : "text-white/70"}>{icon}</span>
      <div className="flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && (
          <div className={`text-[11px] ${highlight ? "text-white/85" : "text-white/50"}`}>
            {subtitle}
          </div>
        )}
      </div>
      {badge && (
        <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return inner;
}
