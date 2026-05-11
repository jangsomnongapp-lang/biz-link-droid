import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TIERS = [5, 25, 50, 100] as const;

/**
 * Securely claim any invitation reward tiers the caller has actually earned.
 * - Counts joins server-side (cannot be spoofed from the client)
 * - Inserts only missing tiers
 * - Returns the canonical reward state for the user
 */
export const claimInviteRewards = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
    const authHeader = getRequest().headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Missing authorization token");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabaseAdmin.auth.getClaims(token);
    const userId = authData?.claims?.sub;
    if (authErr || !userId) {
      throw new Error("Unauthorized: Invalid authorization token");
    }

    const { count: joinCount, error: countErr } = await supabaseAdmin
      .from("invite_joins")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", userId);
    if (countErr) throw new Error(countErr.message);

    const joined = joinCount ?? 0;
    const earned = TIERS.filter((t) => joined >= t);

    const { data: existing, error: existErr } = await supabaseAdmin
      .from("invite_rewards")
      .select("tier, status, sent_at")
      .eq("user_id", userId);
    if (existErr) throw new Error(existErr.message);

    const existingTiers = new Set((existing ?? []).map((r) => r.tier));
    const toInsert = earned.filter((t) => !existingTiers.has(t));

    if (toInsert.length > 0) {
      // Digital badges (5/25/50) auto-deliver instantly. Beer (100) stays pending for admin shipping.
      const rows = toInsert.map((tier) => ({
        user_id: userId,
        tier,
        status: tier === 100 ? "pending" : "sent",
        sent_at: tier === 100 ? null : new Date().toISOString(),
      }));
      const { error: insErr } = await supabaseAdmin.from("invite_rewards").insert(rows);
      if (insErr) throw new Error(insErr.message);

      // Auto-grant the matching profile badge for digital tiers.
      const patch: { is_verified?: boolean; is_recruiter?: boolean; is_featured?: boolean } = {};
      if (toInsert.includes(5)) patch.is_verified = true;
      if (toInsert.includes(25)) patch.is_recruiter = true;
      if (toInsert.includes(50)) patch.is_featured = true;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("profiles").update(patch as never).eq("id", userId);
      }
    }

    const { data: rewards } = await supabaseAdmin
      .from("invite_rewards")
      .select("tier, status, sent_at")
      .eq("user_id", userId)
      .order("tier", { ascending: true });

    return {
      joined,
      newlyClaimed: toInsert,
      rewards: rewards ?? [],
    };
    } catch (err) {
      console.error("claimInviteRewards failed:", err);
      return {
        joined: 0,
        newlyClaimed: [] as number[],
        rewards: [] as { tier: number; status: string; sent_at: string | null }[],
        error: "Failed to claim rewards. Please try again.",
      };
    }
  });

/**
 * Admin-only: mark a reward as sent (delivered to the user).
 */
export const markRewardSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rewardId: string }) => {
    if (!input?.rewardId || typeof input.rewardId !== "string") {
      throw new Error("rewardId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.is_admin) throw new Error("Forbidden");

    // Look up the reward first so we know which user + tier to credit
    const { data: reward, error: rErr } = await supabaseAdmin
      .from("invite_rewards")
      .select("id, user_id, tier, status")
      .eq("id", data.rewardId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!reward) throw new Error("Reward not found");

    const { error } = await supabaseAdmin
      .from("invite_rewards")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.rewardId);
    if (error) throw new Error(error.message);

    // Auto-grant the matching profile badge for tiers 5 / 25 / 50.
    // Tier 100 (beer) is a physical prize — no profile flag.
    const patch: { is_verified?: boolean; is_recruiter?: boolean; is_featured?: boolean } = {};
    if (reward.tier === 5) patch.is_verified = true;
    else if (reward.tier === 25) patch.is_recruiter = true;
    else if (reward.tier === 50) patch.is_featured = true;

    if (Object.keys(patch).length > 0) {
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update(patch as never)
        .eq("id", reward.user_id);
      if (pErr) throw new Error(pErr.message);
    }

    return { ok: true, tier: reward.tier, granted: patch };
  });

/**
 * Public read: returns the current monthly leaderboard top N (default 10).
 * Computed server-side from invite_joins so clients can't fake counts.
 */
export const getMonthlyLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number; month?: string } | undefined) => ({
    limit: Math.min(Math.max(input?.limit ?? 10, 1), 50),
    month: input?.month,
  }))
  .handler(async ({ data }) => {
    const start = data.month ? new Date(data.month) : new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const { data: joins, error } = await supabaseAdmin
      .from("invite_joins")
      .select("inviter_id")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const r of joins ?? []) {
      counts.set(r.inviter_id, (counts.get(r.inviter_id) ?? 0) + 1);
    }
    const ranked = Array.from(counts.entries())
      .map(([inviter_id, count]) => ({ inviter_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, data.limit);

    if (ranked.length === 0) return { leaders: [], periodStart: start.toISOString() };

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in(
        "id",
        ranked.map((r) => r.inviter_id),
      );
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

    return {
      periodStart: start.toISOString(),
      leaders: ranked.map((r, i) => ({
        rank: i + 1,
        inviter_id: r.inviter_id,
        count: r.count,
        full_name: pmap.get(r.inviter_id)?.full_name ?? null,
        avatar_url: pmap.get(r.inviter_id)?.avatar_url ?? null,
      })),
    };
  });
