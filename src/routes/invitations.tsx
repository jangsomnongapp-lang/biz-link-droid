import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Users, Trophy, Lock, Check, Beer, Award, Star } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { claimInviteRewards } from "@/server/invite-rewards.functions";

export const Route = createFileRoute("/invitations")({
  component: () => (
    <RequireAuth>
      <InvitationsPage />
    </RequireAuth>
  ),
});

const TIERS = [
  { tier: 5, key: "tier_verified", icon: Check },
  { tier: 25, key: "tier_recruiter", icon: Award },
  { tier: 50, key: "tier_featured", icon: Star },
  { tier: 100, key: "tier_beer", icon: Beer },
];

interface LeaderRow {
  inviter_id: string;
  count: number;
  full_name: string | null;
  avatar_url: string | null;
}

function InvitationsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const [joined, setJoined] = useState(0);
  const [monthJoined, setMonthJoined] = useState(0);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [rewardStatus, setRewardStatus] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const link = useMemo(() => {
    if (!code || typeof window === "undefined") return "";
    return `${window.location.origin}/join?ref=${code}`;
  }, [code]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      // Get or create invite code
      let { data: ic } = await supabase
        .from("invite_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ic) {
        const newCode = generateCode(user.id);
        const { data: created, error } = await supabase
          .from("invite_codes")
          .insert({ user_id: user.id, code: newCode })
          .select("code")
          .single();
        if (!error) ic = created;
      }
      setCode(ic?.code ?? null);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [sentRes, joinRes, monthJoinRes, allJoinRes] = await Promise.all([
        supabase.from("invite_clicks").select("id", { count: "exact", head: true }).eq("inviter_id", user.id),
        supabase.from("invite_joins").select("id", { count: "exact", head: true }).eq("inviter_id", user.id),
        supabase
          .from("invite_joins")
          .select("id", { count: "exact", head: true })
          .eq("inviter_id", user.id)
          .gte("created_at", monthStart.toISOString()),
        supabase
          .from("invite_joins")
          .select("inviter_id")
          .gte("created_at", monthStart.toISOString()),
      ]);
      setSent(sentRes.count ?? 0);
      setJoined(joinRes.count ?? 0);
      setMonthJoined(monthJoinRes.count ?? 0);

      // aggregate leaderboard
      const counts = new Map<string, number>();
      for (const r of (allJoinRes.data as { inviter_id: string }[] | null) ?? []) {
        counts.set(r.inviter_id, (counts.get(r.inviter_id) ?? 0) + 1);
      }
      const ids = Array.from(counts.keys());
      let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", ids);
        for (const p of profs ?? []) profileMap.set(p.id, p);
      }
      const ranked: LeaderRow[] = ids
        .map((id) => ({
          inviter_id: id,
          count: counts.get(id) ?? 0,
          full_name: profileMap.get(id)?.full_name ?? null,
          avatar_url: profileMap.get(id)?.avatar_url ?? null,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setLeaders(ranked);
      setLoading(false);
    })();
  }, [user]);

  // Securely claim rewards via server function (validates joins server-side)
  // and load delivery status (pending vs sent) for each tier.
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const res = await claimInviteRewards();
        const map = new Map<number, string>();
        for (const r of res.rewards ?? []) map.set(r.tier, r.status);
        setRewardStatus(map);
      } catch {
        /* silently ignore — UI still shows progress */
      }
    })();
  }, [user, joined]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("share_link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("app_name"), url: link });
      } catch {
        /* user cancelled */
      }
    } else {
      void copyLink();
    }
  }

  const monthlyLeaderTop = leaders[0]?.count ?? 0;
  const myRank = leaders.findIndex((l) => l.inviter_id === user?.id) + 1;

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-card">
        <Link to="/settings" className="rounded-full p-1 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">{t("my_invitations")}</h1>
      </div>

      <div className="space-y-3 p-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={sent} label={t("invitations_sent")} color="text-primary" />
          <StatCard value={joined} label={t("successful_joins")} color="text-green-600" />
        </div>

        {/* Invite link */}
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-sm font-semibold text-foreground">{t("your_invite_link")}</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <span className="flex-1 truncate text-xs text-muted-foreground">{link || "..."}</span>
            <button onClick={copyLink} className="flex items-center gap-1 text-xs font-semibold text-primary active:opacity-60">
              <Copy className="h-3.5 w-3.5" /> {t("copy")}
            </button>
          </div>
          <button
            onClick={shareLink}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98]"
          >
            <Users className="h-4 w-4" />
            {t("share_with_friends")}
          </button>
        </div>

        {/* Rewards */}
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-foreground">{t("rewards_progress")}</p>
          </div>
          <div className="mt-3 space-y-2">
            {TIERS.map(({ tier, key, icon: Icon }) => {
              const completed = joined >= tier;
              const progress = Math.min(100, (joined / tier) * 100);
              return (
                <div
                  key={tier}
                  className={`rounded-xl border p-3 ${
                    completed
                      ? "border-green-500/30 bg-green-500/5"
                      : joined > 0 && tier === TIERS.find((x) => joined < x.tier)?.tier
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        completed ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {completed ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${completed ? "text-green-700" : "text-foreground"}`}>
                        {tier} {t("joins")} — {t(key as Parameters<typeof t>[0])}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {completed
                          ? t("completed")
                          : `${joined}/${tier} — ${tier - joined} ${t("more_to_go")}`}
                      </p>
                      {!completed && (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                    {completed && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          rewardStatus.get(tier) === "sent"
                            ? "bg-green-500/15 text-green-700"
                            : "bg-amber-500/15 text-amber-700"
                        }`}
                      >
                        {rewardStatus.get(tier) === "sent"
                          ? t("reward_delivered")
                          : t("reward_pending_delivery")}
                      </span>
                    )}
                    {!completed && joined < tier && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly challenge */}
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-foreground">{t("monthly_challenge")}</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-muted/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("your_position")}</span>
              <span className="font-bold text-primary">#{myRank > 0 ? myRank : "—"}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${monthlyLeaderTop ? Math.min(100, (monthJoined / monthlyLeaderTop) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthJoined} {t("joins")} — {t("leader_has")} {monthlyLeaderTop}
            </p>
          </div>
        </div>

        {/* Top this month */}
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-foreground">{t("top_this_month")}</p>
          </div>
          <div className="mt-3 space-y-1.5">
            {loading && <p className="text-xs text-muted-foreground">{t("loading")}</p>}
            {!loading && leaders.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">{t("no_data")}</p>
            )}
            {leaders.map((l, i) => (
              <div
                key={l.inviter_id}
                className={`flex items-center gap-3 rounded-lg p-2 ${
                  l.inviter_id === user?.id ? "bg-primary/10" : ""
                }`}
              >
                <span
                  className={`w-5 text-center text-sm font-bold ${
                    i === 0
                      ? "text-amber-500"
                      : i === 1
                        ? "text-slate-400"
                        : i === 2
                          ? "text-orange-600"
                          : "text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <Avatar name={l.full_name} url={l.avatar_url} size={32} />
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                  {l.inviter_id === user?.id ? t("you") : (l.full_name ?? "User")}
                </span>
                <span className="text-sm font-semibold text-primary">
                  {l.count} {t("joins")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 text-center shadow-card">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function generateCode(userId: string): string {
  const seed = userId.replace(/-/g, "").slice(0, 6);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${seed}${rand}`.toLowerCase();
}
