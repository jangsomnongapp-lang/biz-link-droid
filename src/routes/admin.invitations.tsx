import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trophy, Send, Check } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { markRewardSent } from "@/server/invite-rewards.functions";

export const Route = createFileRoute("/admin/invitations")({
  component: () => (
    <RequireAuth>
      <AdminInvitationsPage />
    </RequireAuth>
  ),
});

type Period = "month" | "prev" | "all";

interface UserStats {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  sent: number;
  joined: number;
  next_tier: number | null;
  pending_reward: { id: string; tier: number } | null;
  sent_reward_tiers: number[];
}

const TIERS = [5, 25, 50, 100];

function AdminInvitationsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [rows, setRows] = useState<UserStats[]>([]);
  const [totals, setTotals] = useState({ sent: 0, joined: 0, due: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data?.is_admin));
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      setLoading(true);
      const range = getRange(period);

      const clicksQ = supabase.from("invite_clicks").select("inviter_id, created_at");
      const joinsQ = supabase.from("invite_joins").select("inviter_id, created_at");
      if (range) {
        clicksQ.gte("created_at", range.start).lt("created_at", range.end);
        joinsQ.gte("created_at", range.start).lt("created_at", range.end);
      }
      const [{ data: clicks }, { data: joins }, { data: rewards }] = await Promise.all([
        clicksQ,
        joinsQ,
        supabase.from("invite_rewards").select("id, user_id, tier, status"),
      ]);

      const sentMap = new Map<string, number>();
      const joinMap = new Map<string, number>();
      // for "all time" joined we still need lifetime joined for tier calc
      const { data: lifetimeJoins } = range
        ? await supabase.from("invite_joins").select("inviter_id")
        : { data: joins };
      const lifetimeJoinMap = new Map<string, number>();
      for (const r of (lifetimeJoins as { inviter_id: string }[] | null) ?? []) {
        lifetimeJoinMap.set(r.inviter_id, (lifetimeJoinMap.get(r.inviter_id) ?? 0) + 1);
      }
      for (const r of (clicks as { inviter_id: string }[] | null) ?? []) {
        sentMap.set(r.inviter_id, (sentMap.get(r.inviter_id) ?? 0) + 1);
      }
      for (const r of (joins as { inviter_id: string }[] | null) ?? []) {
        joinMap.set(r.inviter_id, (joinMap.get(r.inviter_id) ?? 0) + 1);
      }

      const ids = new Set<string>([...sentMap.keys(), ...joinMap.keys(), ...lifetimeJoinMap.keys()]);
      const idArr = Array.from(ids);
      let profMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (idArr.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", idArr);
        for (const p of profs ?? []) profMap.set(p.id, p);
      }

      const rewardsByUser = new Map<string, { id: string; tier: number; status: string }[]>();
      for (const r of (rewards as { id: string; user_id: string; tier: number; status: string }[] | null) ?? []) {
        const arr = rewardsByUser.get(r.user_id) ?? [];
        arr.push(r);
        rewardsByUser.set(r.user_id, arr);
      }

      const list: UserStats[] = idArr
        .map((id) => {
          const lifetimeJoined = lifetimeJoinMap.get(id) ?? 0;
          const ur = rewardsByUser.get(id) ?? [];
          const pending = ur.find((r) => r.status === "pending");
          const sentTiers = ur.filter((r) => r.status === "sent").map((r) => r.tier);
          const nextTier = TIERS.find((tt) => lifetimeJoined < tt) ?? null;
          return {
            user_id: id,
            full_name: profMap.get(id)?.full_name ?? null,
            avatar_url: profMap.get(id)?.avatar_url ?? null,
            sent: sentMap.get(id) ?? 0,
            joined: joinMap.get(id) ?? 0,
            next_tier: nextTier,
            pending_reward: pending ? { id: pending.id, tier: pending.tier } : null,
            sent_reward_tiers: sentTiers,
          };
        })
        .sort((a, b) => b.joined - a.joined);

      setRows(list);
      setTotals({
        sent: Array.from(sentMap.values()).reduce((s, n) => s + n, 0),
        joined: Array.from(joinMap.values()).reduce((s, n) => s + n, 0),
        due: list.filter((r) => r.pending_reward).length,
      });
      setLoading(false);
    })();
  }, [isAdmin, period]);

  async function markSent(rewardId: string, userId: string) {
    const { error } = await supabase
      .from("invite_rewards")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", rewardId);
    if (error) {
      toast.error(t("error_generic"));
      return;
    }
    toast.success(t("prize_sent"));
    setRows((rs) =>
      rs.map((r) =>
        r.user_id === userId
          ? {
              ...r,
              sent_reward_tiers: [...r.sent_reward_tiers, r.pending_reward!.tier],
              pending_reward: null,
            }
          : r,
      ),
    );
    setTotals((tt) => ({ ...tt, due: Math.max(0, tt.due - 1) }));
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">{t("admin_only")}</p>
      </div>
    );
  }

  const leader = rows[0];

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-card">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="rounded-full p-1 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold">{t("admin_invitations")}</h1>
        </div>
        {totals.due > 0 && (
          <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold">
            {totals.due} {t("pending_label")}
          </span>
        )}
      </div>

      <div className="space-y-3 p-3">
        {/* Period chips */}
        <div className="flex gap-2 overflow-x-auto">
          {(["month", "prev", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground shadow-card"
              }`}
            >
              {t(`period_${p}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-2">
          <TotalCard value={totals.sent} label={t("total_invites")} color="text-primary" />
          <TotalCard value={totals.joined} label={t("successful")} color="text-green-600" />
          <TotalCard value={totals.due} label={t("prizes_due")} color="text-orange-500" />
        </div>

        {/* Monthly leader */}
        {leader && period === "month" && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-card">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-amber-700">{t("monthly_leader")}</p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-full bg-amber-500/20 p-0.5">
                <Avatar name={leader.full_name} url={leader.avatar_url} size={44} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{leader.full_name ?? "User"}</p>
                <p className="text-xs text-muted-foreground">
                  {leader.joined} {t("joins")}
                </p>
              </div>
              {leader.pending_reward && (
                <button
                  onClick={() => void markSent(leader.pending_reward!.id, leader.user_id)}
                  className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-2 text-xs font-bold text-white active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  {t("send_prize")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* All users */}
        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("all_users_sorted")}
          </p>
          {loading && <p className="py-4 text-center text-xs text-muted-foreground">{t("loading")}</p>}
          {!loading && rows.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("no_data")}</p>
          )}
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.user_id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={r.full_name} url={r.avatar_url} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.full_name ?? "User"}
                    </p>
                  </div>
                  {r.pending_reward ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                      {t("prize_due")}
                    </span>
                  ) : r.sent_reward_tiers.length > 0 ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                      <Check className="h-3 w-3" /> {t("on_track")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <MiniStat value={r.sent} label={t("sent")} />
                  <MiniStat value={r.joined} label={t("joined")} valueClass="text-green-600" />
                  {r.pending_reward ? (
                    <button
                      onClick={() => void markSent(r.pending_reward!.id, r.user_id)}
                      className="flex flex-col items-center justify-center rounded-lg bg-primary px-2 py-1.5 text-primary-foreground active:scale-95"
                    >
                      <span className="text-sm font-bold">{t("mark_sent")} ✓</span>
                    </button>
                  ) : r.next_tier ? (
                    <div className="flex flex-col items-center justify-center rounded-lg bg-muted/30 px-2 py-1.5">
                      <span className="text-sm font-bold text-orange-500">{r.next_tier} 🎯</span>
                      <span className="text-[10px] text-muted-foreground">{t("next_prize")}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg bg-green-500/10 px-2 py-1.5">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-[10px] text-green-700">{t("all_done")}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center shadow-card">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniStat({ value, label, valueClass = "text-foreground" }: { value: number; label: string; valueClass?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
      <p className={`text-sm font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function getRange(p: Period): { start: string; end: string } | null {
  const now = new Date();
  if (p === "all") return null;
  if (p === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
