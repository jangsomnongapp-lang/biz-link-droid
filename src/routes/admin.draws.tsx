import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trophy, PlayCircle, RefreshCw, Calendar } from "lucide-react";
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
  draw_type: string;
  draw_date: string;
  prize_title: string;
  status: string;
  winner_user_id: string | null;
  drawn_at: string | null;
  published_at: string | null;
}

function AdminDrawsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [winners, setWinners] = useState<Record<string, { full_name: string | null }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const me = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me.data?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    const { data } = await supabase
      .from("lottery_draws")
      .select("*")
      .order("draw_date", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as DrawRow[];
    setDraws(rows);
    const winnerIds = rows.map((d) => d.winner_user_id).filter(Boolean) as string[];
    if (winnerIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", winnerIds);
      const m: Record<string, { full_name: string | null }> = {};
      for (const p of ps ?? []) m[p.id] = { full_name: p.full_name };
      setWinners(m);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user]);

  async function ensureScheduled() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("ensure_scheduled_draws");
    if (error) toast.error(error.message);
    else { toast.success("Scheduled draws refreshed"); void load(); }
  }

  async function runDraw(id: string) {
    setBusyId(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("run_lottery_draw", { _draw_id: id });
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    const result = data as { ok: boolean; reason?: string };
    if (!result?.ok) toast.warning(`No winner: ${result?.reason ?? "no entries"}`);
    else toast.success("Winner drawn & post published 🎉");
    void load();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="font-medium">Admins only.</p>
          <Link to="/home" className="text-sm text-primary underline mt-2 inline-block">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/home" className="rounded-full p-1.5 hover:bg-accent"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-base font-semibold">Lottery Draws</h1>
        <button onClick={ensureScheduled} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          <RefreshCw className="h-3.5 w-3.5" /> Sync schedule
        </button>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {draws.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Calendar className="mx-auto mb-2 h-6 w-6" />
            No draws yet. Tap “Sync schedule” to seed today’s draws.
          </div>
        )}
        {draws.map((d) => (
          <div key={d.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold capitalize">{d.draw_type}</span>
              <span className="text-xs text-muted-foreground">· {d.draw_date}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                d.status === "drawn" ? "bg-emerald-100 text-emerald-700" :
                d.status === "no_entries" ? "bg-muted text-muted-foreground" :
                "bg-amber-100 text-amber-700"
              }`}>{d.status}</span>
            </div>
            <div className="mt-1 text-sm">{d.prize_title}</div>
            {d.winner_user_id && (
              <div className="mt-1 text-xs text-muted-foreground">
                Winner: <span className="font-medium text-foreground">{winners[d.winner_user_id]?.full_name ?? d.winner_user_id.slice(0, 8)}</span>
                {d.published_at && <span> · post published</span>}
              </div>
            )}
            {d.status === "scheduled" && (
              <button
                onClick={() => runDraw(d.id)}
                disabled={busyId === d.id}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90 disabled:opacity-60"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {busyId === d.id ? "Drawing…" : "Run draw now"}
              </button>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
