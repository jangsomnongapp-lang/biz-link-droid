import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Flame, Beer, Check, ChevronRight } from "lucide-react";

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

const todayISO = () => new Date().toISOString().slice(0, 10);

function RewardsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["rewards", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const uid = user!.id;
      const [str, tix, draws, cl] = await Promise.all([
        supabase.from("streak_tracker").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("lottery_tickets").select("*").eq("user_id", uid).eq("status", "active").order("created_at", { ascending: false }),
        supabase.from("lottery_draws").select("*").eq("status", "scheduled").order("draw_date").limit(5),
        supabase.from("prize_claims").select("*").eq("winner_id", uid).order("created_at", { ascending: false }),
      ]);
      return {
        streak: (str.data as Streak | null) ?? { current_streak: 0, longest_streak: 0, last_check_date: null },
        tickets: (tix.data ?? []) as TicketRow[],
        upcoming: (draws.data ?? []) as DrawRow[],
        claims: (cl.data ?? []) as ClaimRow[],
      };
    },
  });

  const streak = data?.streak ?? { current_streak: 0, longest_streak: 0, last_check_date: null };
  const tickets = data?.tickets ?? [];
  const upcoming = data?.upcoming ?? [];
  const claims = data?.claims ?? [];

  useEffect(() => {
    if (!user) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["rewards", user.id] });
    const ch = supabase
      .channel(`rewards:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "streak_tracker", filter: `user_id=eq.${user.id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "lottery_tickets", filter: `user_id=eq.${user.id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "lottery_draws" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "prize_claims", filter: `winner_id=eq.${user.id}` }, invalidate)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  const today = todayISO();
  // Format Date as local YYYY-MM-DD (avoid UTC shift from toISOString)
  const fmtLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Current week's Monday (period start for upcoming weekly draw)
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay(); // 0 Sun..6 Sat
    const diff = day === 0 ? -6 : 1 - day; // back to Monday
    d.setDate(d.getDate() + diff);
    return fmtLocal(d);
  })();
  // First of next month (period start for upcoming monthly draw)
  const monthStart = (() => {
    const d = new Date();
    return fmtLocal(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  })();
  const todaysTicket = tickets.find((t) => t.ticket_type === "daily" && t.draw_period_start === today);
  // Only count tickets for the CURRENT upcoming draw period, not historical active ones
  const weeklyTickets = tickets.filter((t) => t.ticket_type === "weekly" && t.draw_period_start === weekStart);
  const monthlyTickets = tickets.filter((t) => t.ticket_type === "monthly" && t.draw_period_start === monthStart);
  const activeClaim = claims.find((c) => c.status === "pending" && new Date(c.expires_at) > new Date());

  const weeklyDraw = upcoming.find((d) => d.draw_type === "weekly");
  const monthlyDraw = upcoming.find((d) => d.draw_type === "monthly");

  const ticketNum = todaysTicket?.ticket_number ?? null;
  const ticketDisplay = ticketNum !== null ? String(ticketNum).padStart(4, "0") : "----";
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const goal = 7;
  const cur = Math.min(streak.current_streak, goal);
  const remaining = Math.max(0, goal - cur);

  async function openRewardsChat() {
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
      .from("message_threads").select("id").eq("participant_a", a).eq("participant_b", b).maybeSingle();
    if (!thread) {
      const ins = await supabase.from("message_threads").insert({ participant_a: a, participant_b: b }).select("id").single();
      thread = ins.data;
    }
    if (thread) nav({ to: "/messages/$threadId", params: { threadId: thread.id } });
  }

  function hoursLeft(iso: string) {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 3600000));
  }

  return (
    <div className="min-h-screen bg-white pb-12 text-zinc-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 shadow">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight">{lang === "km" ? "រង្វាន់របស់ខ្ញុំ" : "My rewards"}</div>
              <div className="text-[11px] text-zinc-500">My prizes and tickets</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow">
            Day {streak.current_streak} <Flame className="h-3.5 w-3.5" />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">{lang === "km" ? "កំពុងផ្ទុក..." : "Loading..."}</div>
        ) : (
          <>
            {/* Today's active ticket label */}
            <div className="mt-5 text-[12px] text-zinc-500 font-bold uppercase tracking-wider">
              Streak
            </div>

            {/* Lottery ticket (yellow) */}
            <div className="mt-2 overflow-hidden rounded-2xl bg-yellow-300 text-zinc-900 shadow-lg ring-1 ring-orange-200">
              <div className="flex items-center justify-between bg-orange-500 px-4 py-2 text-white">
                <span className="text-sm font-bold">{lang === "km" ? "ទាស់លាភ" : "TICKET"}</span>
                <span className="text-xs font-extrabold tracking-widest">BUILDHUB</span>
              </div>
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-orange-700">
                    {lang === "km" ? "លេខសំបុត្រ" : "Ticket Number"}
                  </div>
                  <div className="mt-1 font-mono text-4xl font-black text-orange-600">#{ticketDisplay}</div>
                  <div className="mt-1 text-[11px] text-zinc-700">{todayLabel}</div>
                </div>
                <div className="flex w-24 flex-col items-center rounded-lg bg-yellow-100 p-2 text-center ring-1 ring-orange-300/50">
                  <Beer className="h-7 w-7 text-orange-500" />
                  <div className="mt-1 text-[10px] leading-tight text-zinc-700">
                    Daily $1<br />Weekly $15<br />Monthly $40
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t-2 border-dashed border-orange-300 bg-yellow-300 px-4 py-2 text-sm font-bold text-zinc-900">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  {ticketNum !== null ? "Validated ✓" : (lang === "km" ? "មិនទាន់ឆែក" : "Not checked in")}
                </span>
                <span className="font-mono text-orange-700">#{ticketDisplay}</span>
              </div>
            </div>

            {/* Streak */}
            <div className="mt-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">Streak</div>
                  <div className="mt-1 text-lg font-bold">
                    <span className="text-orange-500">{cur}</span>
                    <span className="text-zinc-500 text-sm"> / {goal} days</span>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {remaining > 0 ? `${remaining} more → monthly ticket` : "Monthly ticket unlocked!"}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-1.5">
                {Array.from({ length: goal }).map((_, i) => {
                  const hit = i < cur;
                  return (
                    <div key={i} className={`flex h-9 flex-1 items-center justify-center rounded-full text-xs font-bold ${
                      hit ? "bg-emerald-500 text-white shadow" : "border border-zinc-300 bg-white text-zinc-400"
                    }`}>
                      {hit ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active tickets */}
            <div className="mt-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Active tickets</div>
              <div className="mt-3 space-y-3">
                <DrawRowItem
                  title={lang === "km" ? "ឆ្នោតប្រចាំសប្តាហ៍" : "Weekly draw"}
                  sub={weeklyDraw ? `${new Date(weeklyDraw.draw_date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · 11:00am · $15` : "Sunday · $15"}
                  count={weeklyTickets.length}
                />
                <DrawRowItem
                  title={lang === "km" ? "ឆ្នោតប្រចាំខែ" : "Monthly draw"}
                  sub={monthlyDraw ? `${new Date(monthlyDraw.draw_date).toLocaleDateString("en-US", { month: "long", day: "numeric" })} · $40` : "Month end · $40"}
                  count={monthlyTickets.length}
                />
              </div>
            </div>

            {/* Won card */}
            {activeClaim && (
              <button
                onClick={openRewardsChat}
                className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-orange-400 bg-orange-50 p-3 text-left shadow-sm active:scale-[0.99]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500">
                  <Beer className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-orange-700">You won today's draw!</div>
                  <div className="text-[11px] text-orange-600">2 beers waiting · {hoursLeft(activeClaim.expires_at)}h left to claim</div>
                </div>
                <span className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white">Claim</span>
              </button>
            )}

            {/* BuildHub Rewards chat */}
            <button
              onClick={openRewardsChat}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-zinc-50 p-3 text-left ring-1 ring-zinc-200 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">BuildHub Rewards</div>
                <div className="text-[11px] text-zinc-500">Questions about prizes? Chat with us</div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DrawRowItem({ title, sub, count }: { title: string; sub: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-zinc-500">{sub}</div>
      </div>
      <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow">
        {count} {count === 1 ? "ticket" : "tickets"}
      </span>
    </div>
  );
}
