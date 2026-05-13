import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Flame, Ticket as TicketIcon, Gift, Clock, Trophy, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/rewards")({
  component: () => (
    <RequireAuth>
      <RewardsPage />
    </RequireAuth>
  ),
});

interface Streak { current_streak: number; longest_streak: number; last_check_date: string | null }
interface TicketRow { id: string; ticket_type: "daily" | "weekly" | "monthly"; ticket_number: number | null; draw_period_start: string; status: string; created_at: string }
interface DrawRow { id: string; draw_type: string; draw_date: string; prize_title: string; prize_image_url: string | null; winner_user_id: string | null; status: string }
interface ClaimRow { id: string; draw_id: string; status: string; expires_at: string }

function todayISO() { return new Date().toISOString().slice(0, 10); }

function RewardsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0, last_check_date: null });
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [upcoming, setUpcoming] = useState<DrawRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const [str, tix, draws, cl] = await Promise.all([
        supabase.from("streak_tracker").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("lottery_tickets").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }),
        supabase.from("lottery_draws").select("*").eq("status", "scheduled").order("draw_date").limit(5),
        supabase.from("prize_claims").select("*").eq("winner_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (str.data) setStreak(str.data as Streak);
      setTickets((tix.data ?? []) as TicketRow[]);
      setUpcoming((draws.data ?? []) as DrawRow[]);
      setClaims((cl.data ?? []) as ClaimRow[]);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  const today = todayISO();
  const todaysTicket = tickets.find((t) => t.ticket_type === "daily" && t.draw_period_start === today);
  const dailyTickets = tickets.filter((t) => t.ticket_type === "daily");
  const weeklyTickets = tickets.filter((t) => t.ticket_type === "weekly");
  const monthlyTickets = tickets.filter((t) => t.ticket_type === "monthly");
  const activeClaim = claims.find((c) => c.status === "pending" && new Date(c.expires_at) > new Date());
  const wonDraws = upcoming; // placeholder

  // Build a 7-day streak strip ending today
  const streakDots: { day: string; hit: boolean }[] = [];
  const last = streak.last_check_date ? new Date(streak.last_check_date) : null;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isHit = !!last && (last.getTime() - d.getTime()) >= 0 && i < streak.current_streak;
    streakDots.push({ day: d.toLocaleDateString(undefined, { weekday: "narrow" }), hit: isHit });
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-amber-50 via-white to-white pb-24">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-[#0F6E56] px-2 text-white shadow">
        <button onClick={() => nav({ to: "/profile" })} className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center font-bold tracking-wide">BuildHub Rewards</div>
        <span className="w-9" />
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{lang === "km" ? "កំពុងផ្ទុក..." : "Loading..."}</div>
      ) : (
        <div className="space-y-4 px-3 pt-4">

          {/* TODAY'S TICKET — lottery-style hero */}
          <LotteryTicket ticketNumber={todaysTicket?.ticket_number ?? null} lang={lang} />

          {/* Streak row — 7 dots */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-bold leading-none">{streak.current_streak} {lang === "km" ? "ថ្ងៃ" : "days"}</div>
                  <div className="text-[11px] text-muted-foreground">{lang === "km" ? "កំពូល" : "best"} {streak.longest_streak}</div>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{lang === "km" ? "៧ ថ្ងៃចុងក្រោយ" : "Last 7 days"}</div>
            </div>
            <div className="flex items-center justify-between gap-1">
              {streakDots.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`h-7 w-7 rounded-full border-2 transition ${d.hit ? "border-orange-500 bg-gradient-to-br from-orange-400 to-rose-500" : "border-border bg-muted"}`}
                  />
                  <div className="text-[10px] text-muted-foreground">{d.day}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active claim */}
          {activeClaim && (
            <div className="overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-md">
              <div className="flex items-center gap-2 bg-emerald-600 px-4 py-2 text-white">
                <Trophy className="h-4 w-4" />
                <div className="text-sm font-bold">{lang === "km" ? "អ្នកឈ្នះ!" : "You won!"}</div>
              </div>
              <div className="p-4">
                <div className="text-sm text-emerald-900">{lang === "km" ? "ចុចទាមទាររង្វាន់របស់អ្នក" : "Tap to claim your prize"}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-800">
                  <Clock className="h-3 w-3" /> {lang === "km" ? "ផុតកំណត់" : "Expires"} {new Date(activeClaim.expires_at).toLocaleString()}
                </div>
                <button
                  onClick={async () => {
                    if (!user) return;
                    const { data: rewards } = await supabase
                      .from("profiles")
                      .select("id")
                      .eq("is_super_user", true)
                      .ilike("full_name", "BuildHub Rewards")
                      .maybeSingle();
                    if (!rewards) return;
                    const a = rewards.id < user.id ? rewards.id : user.id;
                    const b = rewards.id < user.id ? user.id : rewards.id;
                    let { data: thread } = await supabase
                      .from("message_threads")
                      .select("id")
                      .eq("participant_a", a)
                      .eq("participant_b", b)
                      .maybeSingle();
                    if (!thread) {
                      const ins = await supabase.from("message_threads").insert({ participant_a: a, participant_b: b }).select("id").single();
                      thread = ins.data;
                    }
                    if (thread) nav({ to: "/messages/$threadId", params: { threadId: thread.id } });
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" /> {lang === "km" ? "ជជែកជាមួយ Rewards" : "Chat with Rewards"}
                </button>
              </div>
            </div>
          )}

          {/* Active tickets list with numbers */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <TicketIcon className="h-4 w-4 text-[#0F6E56]" />
              {lang === "km" ? "សំបុត្រសកម្ម" : "Active tickets"}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TicketBucket label={lang === "km" ? "ប្រចាំថ្ងៃ" : "Daily"} prize="$1" tickets={dailyTickets} color="from-amber-400 to-amber-500" />
              <TicketBucket label={lang === "km" ? "សប្តាហ៍" : "Weekly"} prize="$15" tickets={weeklyTickets} color="from-sky-400 to-sky-600" />
              <TicketBucket label={lang === "km" ? "ខែ" : "Monthly"} prize="$40" tickets={monthlyTickets} color="from-violet-400 to-violet-600" />
            </div>
            {tickets.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {tickets.slice(0, 12).map((t) => (
                  <span key={t.id} className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground">
                    #{String(t.ticket_number ?? "—").padStart(4, "0")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming draws */}
          {wonDraws.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Gift className="h-4 w-4 text-[#0F6E56]" />
                {lang === "km" ? "ការចាប់ឆ្នោតខាងមុខ" : "Upcoming draws"}
              </div>
              <ul className="space-y-2">
                {wonDraws.map((d) => (
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
          {tickets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-xs text-muted-foreground">
              {lang === "km"
                ? "ឆែកវត្តមានជារៀងរាល់ថ្ងៃដើម្បីទទួលបានសំបុត្រឆ្នោត!"
                : "Check in daily to earn lottery tickets!"}
            </div>
          )}

          <Link to="/profile" className="block py-2 text-center text-xs text-muted-foreground underline">
            {lang === "km" ? "ត្រឡប់ទៅប្រវត្តិរូប" : "Back to profile"}
          </Link>
        </div>
      )}
    </div>
  );
}

function LotteryTicket({ ticketNumber, lang }: { ticketNumber: number | null; lang: string }) {
  const display = ticketNumber !== null ? String(ticketNumber).padStart(4, "0") : "----";
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-100 via-amber-50 to-white p-1 shadow-lg">
      {/* Notch decoration */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-background border-2 border-amber-300" />
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 h-4 w-4 rounded-full bg-background border-2 border-amber-300" />
      <div className="rounded-xl border border-dashed border-amber-400/60 p-4">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-amber-700">
          <span>BuildHub</span>
          <span>{lang === "km" ? "សំបុត្រថ្ងៃនេះ" : "Today's Ticket"}</span>
        </div>
        <div className="mt-3 text-center">
          <div className="font-mono text-5xl font-black tracking-widest text-[#0F6E56]">#{display}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {ticketNumber !== null
              ? (lang === "km" ? "ចូលរួមការចាប់ឆ្នោត ៣ ថ្នាក់" : "Entered into 3 prize tiers")
              : (lang === "km" ? "ឆែកវត្តមានដើម្បីទទួលបានសំបុត្រ" : "Check in to receive your ticket")}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <PrizePill label={lang === "km" ? "ថ្ងៃ" : "Daily"} amount="$1" />
          <PrizePill label={lang === "km" ? "សប្តាហ៍" : "Weekly"} amount="$15" />
          <PrizePill label={lang === "km" ? "ខែ" : "Monthly"} amount="$40" />
        </div>
      </div>
    </div>
  );
}

function PrizePill({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="rounded-lg bg-white/70 px-1 py-1.5 ring-1 ring-amber-300/60">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-bold text-[#0F6E56]">{amount}</div>
    </div>
  );
}

function TicketBucket({ label, prize, tickets, color }: { label: string; prize: string; tickets: TicketRow[]; color: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${color} p-2 text-center text-white shadow-sm`}>
      <div className="text-[10px] uppercase tracking-wide opacity-90">{label}</div>
      <div className="text-2xl font-black leading-tight">{tickets.length}</div>
      <div className="text-[10px] opacity-90">{prize}</div>
    </div>
  );
}
