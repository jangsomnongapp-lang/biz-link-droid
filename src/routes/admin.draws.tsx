import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ensureScheduledDraws, runAdminLotteryDraw, setAdminManualWinner } from "@/lib/admin-draws.functions";
import {
  ArrowLeft,
  Gift,
  Dice5,
  Sparkles,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/draws")({
  component: () => (
    <RequireAdmin>
      <AdminDrawsPage />
    </RequireAdmin>
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
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

function AdminDrawsPage() {
  const { user } = useAuth();
  const ensureScheduledFn = useServerFn(ensureScheduledDraws);
  const runDrawFn = useServerFn(runAdminLotteryDraw);
  const setManualWinnerFn = useServerFn(setAdminManualWinner);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [winners, setWinners] = useState<Record<string, { full_name: string | null }>>({});
  const [selectedType, setSelectedType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [participants, setParticipants] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [manualNumber, setManualNumber] = useState("");

  const activeDraw = useMemo(() => {
    const start = periodStart(selectedType);
    return draws.find((d) => d.draw_type === selectedType && d.draw_date === start) ?? null;
  }, [draws, selectedType]);

  const winnerName = activeDraw?.winner_user_id
    ? winners[activeDraw.winner_user_id]?.full_name ?? activeDraw.winner_user_id.slice(0, 8)
    : null;

  async function loadAll() {
    if (!user) return;
    const me = await supabase.rpc("get_my_profile_flags");
    if (!me.data?.[0]?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const { data: drawData } = await supabase
      .from("lottery_draws")
      .select("*")
      .order("draw_date", { ascending: false })
      .limit(50);

    const rows = (drawData ?? []) as DrawRow[];
    setDraws(rows);

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
    try {
      await ensureScheduledFn({ headers: await authHeaders() });
      toast.success("Schedule synced");
      void loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sync schedule");
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
    try {
      const result = await runDrawFn({ headers: await authHeaders(), data: { drawId: activeDraw.id } });
      if (!result?.ok) toast.warning(`No winner: ${result?.reason ?? "no entries"}`);
      else toast.success("Winner drawn 🎉");
      void loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run draw");
    } finally {
      setBusy(false);
    }
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
    try {
      await setManualWinnerFn({
        headers: await authHeaders(),
        data: {
          drawId: activeDraw.id,
          drawType: selectedType,
          drawPeriodStart: periodStart(selectedType),
          ticketNumber: num,
        },
      });
      toast.success(`Winner set: #${num}`);
      setManualNumber("");
      void loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to set winner");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-sm text-neutral-500">
        Loading…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-neutral-900 p-6 text-center">
        <div>
          <p className="font-medium">Admins only.</p>
          <Link to="/home" className="text-sm text-orange-600 underline mt-2 inline-block">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const recent = draws.slice(0, 8);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/95 px-3 sm:px-4 py-3 backdrop-blur">
        <Link to="/home" className="rounded-full p-1.5 hover:bg-neutral-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1" />
        <button
          onClick={ensureScheduled}
          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sync schedule</span>
          <span className="sm:hidden">Sync</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl p-3 sm:p-4 md:p-6">
        <section>
          <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm">
            <div className="text-center">
              <h3 className="text-base font-bold">Run draw</h3>
              <p className="text-[11px] text-neutral-500">
                {activeDraw ? activeDraw.prize_title : "Select draw type first"}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">Draw type</p>
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
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
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

            <div className="mt-4 rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                Active participants
              </p>
              <p className="mt-1 text-3xl font-extrabold text-neutral-900">{participants}</p>
              <p className="text-[11px] text-neutral-500">tickets in this draw</p>
            </div>

            <button
              onClick={autoDraw}
              disabled={busy || !activeDraw || activeDraw.status !== "scheduled"}
              className="mt-4 flex w-full flex-col items-center rounded-xl bg-orange-500 px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-400 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Dice5 className="h-4 w-4" /> Auto draw
              </span>
              <span className="text-[11px] font-medium text-white/90">
                Random winner selected
              </span>
            </button>

            {activeDraw?.status === "drawn" && winnerName && (
              <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Winner selected
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-extrabold text-neutral-900 break-words">
                  {activeDraw.winning_ticket_id ? "🎉" : ""} {winnerName}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    Drawn ✓
                  </span>
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className="text-[11px] text-neutral-500">Or enter manually</p>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2">
                <span className="text-neutral-400">#</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ticket number"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                />
              </div>
              <button
                onClick={setManualWinner}
                disabled={busy || !manualNumber || !activeDraw}
                className="mt-3 w-full rounded-xl border-2 border-orange-500/60 px-3 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-50"
              >
                Set manual winner
              </button>
            </div>
          </div>
        </section>

        {/* Recent draws */}
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">Recent draws</h3>
          {recent.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
              <CalendarIcon className="mx-auto mb-2 h-5 w-5" />
              No draws yet — tap "Sync schedule".
            </div>
          )}
          <div className="space-y-2">
            {recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <Gift className="h-4 w-4 shrink-0 text-orange-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold capitalize truncate">
                    {d.draw_type}{" "}
                    <span className="text-xs font-normal text-neutral-500">· {d.draw_date}</span>
                  </div>
                  <div className="text-xs text-neutral-600 truncate">{d.prize_title}</div>
                  {d.winner_user_id && (
                    <div className="text-[11px] text-neutral-500 truncate">
                      Winner:{" "}
                      <span className="font-medium text-neutral-800">
                        {winners[d.winner_user_id]?.full_name ?? d.winner_user_id.slice(0, 8)}
                      </span>
                    </div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    d.status === "drawn"
                      ? "bg-emerald-100 text-emerald-700"
                      : d.status === "no_entries"
                        ? "bg-neutral-100 text-neutral-600"
                        : "bg-orange-100 text-orange-700"
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
