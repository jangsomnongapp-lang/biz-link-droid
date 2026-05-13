import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Flame, Ticket, Gift, Sparkles, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rewards")({
  component: () => (
    <RequireAuth>
      <RewardsPage />
    </RequireAuth>
  ),
});

interface Streak { current_streak: number; longest_streak: number; last_check_date: string | null }
interface TicketRow { id: string; ticket_type: "daily" | "weekly" | "monthly"; draw_period_start: string; status: string; created_at: string }
interface DrawRow { id: string; draw_type: string; draw_date: string; prize_title: string; prize_image_url: string | null; winner_user_id: string | null; status: string }
interface ClaimRow { id: string; draw_id: string; status: string; expires_at: string }

function todayISO() { return new Date().toISOString().slice(0, 10); }

function RewardsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayCheck, setTodayCheck] = useState<{ available: boolean } | null>(null);
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0, last_check_date: null });
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [upcoming, setUpcoming] = useState<DrawRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [boom, setBoom] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const today = todayISO();
      const [check, str, tix, draws, cl] = await Promise.all([
        supabase.from("daily_availability").select("available").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("streak_tracker").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("lottery_tickets").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }),
        supabase.from("lottery_draws").select("*").eq("status", "scheduled").order("draw_date").limit(5),
        supabase.from("prize_claims").select("*").eq("winner_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setTodayCheck(check.data ?? null);
      if (str.data) setStreak(str.data as Streak);
      setTickets((tix.data ?? []) as TicketRow[]);
      setUpcoming((draws.data ?? []) as DrawRow[]);
      setClaims((cl.data ?? []) as ClaimRow[]);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  async function mark(available: boolean) {
    if (submitting || !user) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("mark_daily_availability", { _available: available });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { already?: boolean; available?: boolean; streak?: number };
    if (res?.already) {
      toast.message(lang === "km" ? "អ្នកបានឆ្លើយរួចហើយថ្ងៃនេះ" : "Already answered today");
      return;
    }
    setTodayCheck({ available });
    if (available) {
      setBoom(true);
      const [tix, str] = await Promise.all([
        supabase.from("lottery_tickets").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }),
        supabase.from("streak_tracker").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setTickets((tix.data ?? []) as TicketRow[]);
      if (str.data) setStreak(str.data as Streak);
    } else {
      toast(lang === "km" ? "ជួបគ្នាស្អែក!" : "See you tomorrow!");
      setStreak((s) => ({ ...s, current_streak: 0, last_check_date: todayISO() }));
    }
  }

  if (boom) return <BoomScreen onClose={() => setBoom(false)} streak={streak.current_streak} />;

  const dailyTickets = tickets.filter((t) => t.ticket_type === "daily").length;
  const weeklyTickets = tickets.filter((t) => t.ticket_type === "weekly").length;
  const monthlyTickets = tickets.filter((t) => t.ticket_type === "monthly").length;
  const activeClaim = claims.find((c) => c.status === "pending" && new Date(c.expires_at) > new Date());

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-amber-50 to-white pb-20">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-[#0F6E56] px-2 text-white shadow">
        <button onClick={() => nav({ to: "/profile" })} className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center font-bold">
          {lang === "km" ? "BuildHub Rewards" : "BuildHub Rewards"}
        </div>
        <span className="w-9" />
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{lang === "km" ? "កំពុងផ្ទុក..." : "Loading..."}</div>
      ) : (
        <div className="space-y-3 px-3 pt-3">
          {/* Today's availability gate */}
          {!todayCheck ? (
            <div className="overflow-hidden rounded-2xl border-2 border-amber-300 bg-white shadow-md">
              <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <div className="font-bold">{lang === "km" ? "តើអ្នកអាចធ្វើការថ្ងៃនេះទេ?" : "Are you available to work today?"}</div>
                </div>
                <div className="mt-1 text-xs text-white/90">
                  {lang === "km" ? "ឆ្លើយ \"បាទ/ចាស\" ទទួលបានសំបុត្រឆ្នោត ៣!" : "Say YES — earn 3 lottery tickets!"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  disabled={submitting}
                  onClick={() => mark(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 py-3 text-sm font-semibold text-rose-800 active:scale-[0.98]"
                >
                  <X className="h-4 w-4" /> {lang === "km" ? "មិនទាន់" : "Not today"}
                </button>
                <button
                  disabled={submitting}
                  onClick={() => mark(true)}
                  style={{ backgroundColor: "#0F6E56" }}
                  className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white active:scale-[0.98]"
                >
                  <Check className="h-4 w-4" /> {lang === "km" ? "បាទ/ចាស" : "Yes, available!"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-white p-4 text-center text-sm">
              {todayCheck.available
                ? <span className="text-[#0F6E56] font-semibold">✓ {lang === "km" ? "អ្នកបានឆែកថ្ងៃនេះរួចហើយ" : "You've checked in today"}</span>
                : <span className="text-muted-foreground">{lang === "km" ? "ជួបគ្នាស្អែក!" : "See you tomorrow!"}</span>}
            </div>
          )}

          {/* Streak */}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white">
              <Flame className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold leading-none">{streak.current_streak}</div>
              <div className="text-xs text-muted-foreground">
                {lang === "km" ? "ថ្ងៃជាប់គ្នា" : "day streak"} · {lang === "km" ? "កំពូល" : "best"} {streak.longest_streak}
              </div>
            </div>
          </div>

          {/* Active claim banner */}
          {activeClaim && (
            <Link
              to="/rewards"
              className="block rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4"
            >
              <div className="flex items-center gap-2 text-emerald-900">
                <Gift className="h-5 w-5" />
                <div className="font-bold">{lang === "km" ? "អ្នកឈ្នះ! ទាមទាររង្វាន់របស់អ្នក" : "You won! Claim your prize"}</div>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-800">
                <Clock className="h-3 w-3" /> {lang === "km" ? "ផុតកំណត់" : "Expires"} {new Date(activeClaim.expires_at).toLocaleString()}
              </div>
            </Link>
          )}

          {/* Tickets summary */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Ticket className="h-4 w-4 text-[#0F6E56]" />
              {lang === "km" ? "សំបុត្រសកម្ម" : "Active tickets"}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <TicketStat n={dailyTickets} label={lang === "km" ? "ប្រចាំថ្ងៃ" : "Daily"} color="#f59e0b" />
              <TicketStat n={weeklyTickets} label={lang === "km" ? "ប្រចាំសប្តាហ៍" : "Weekly"} color="#3b82f6" />
              <TicketStat n={monthlyTickets} label={lang === "km" ? "ប្រចាំខែ" : "Monthly"} color="#8b5cf6" />
            </div>
          </div>

          {/* Upcoming draws */}
          {upcoming.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Gift className="h-4 w-4 text-[#0F6E56]" />
                {lang === "km" ? "ការចាប់ឆ្នោតខាងមុខ" : "Upcoming draws"}
              </div>
              <ul className="space-y-2">
                {upcoming.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2">
                    {d.prize_image_url
                      ? <img src={d.prize_image_url} alt="" className="h-12 w-12 rounded object-cover" />
                      : <div className="flex h-12 w-12 items-center justify-center rounded bg-amber-100 text-amber-600"><Gift className="h-6 w-6" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.prize_title}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">{d.draw_type} · {new Date(d.draw_date).toLocaleDateString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty state */}
          {tickets.length === 0 && upcoming.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-xs text-muted-foreground">
              {lang === "km"
                ? "ឆែកវត្តមានរបស់អ្នកជារៀងរាល់ថ្ងៃដើម្បីទទួលបានសំបុត្រឆ្នោត ហើយឈ្នះរង្វាន់!"
                : "Check in daily to earn lottery tickets and win prizes!"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TicketStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-border p-2">
      <div className="text-xl font-bold" style={{ color }}>{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function BoomScreen({ onClose, streak }: { onClose: () => void; streak: number }) {
  const { lang } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white">
      <div className="animate-bounce text-7xl font-black drop-shadow-lg">BOOM!</div>
      <div className="mt-3 text-2xl font-bold">{lang === "km" ? "+៣ សំបុត្រ" : "+3 tickets!"}</div>
      <div className="mt-1 text-sm opacity-90">{lang === "km" ? "ប្រចាំថ្ងៃ · ប្រចាំសប្តាហ៍ · ប្រចាំខែ" : "Daily · Weekly · Monthly"}</div>
      {streak > 1 && (
        <div className="mt-6 flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur">
          <Flame className="h-5 w-5" /> <span className="font-bold">{streak} {lang === "km" ? "ថ្ងៃជាប់គ្នា" : "day streak"}</span>
        </div>
      )}
      <button
        onClick={onClose}
        className="mt-10 rounded-full bg-white px-8 py-3 font-bold text-orange-600 shadow-lg active:scale-95"
      >
        {lang === "km" ? "អស្ចារ្យ!" : "Awesome!"}
      </button>
    </div>
  );
}
