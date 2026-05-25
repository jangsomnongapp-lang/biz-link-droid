import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/** Generate a synthetic, unique email for an identity (no real email needed). */
function syntheticEmail(masterId: string) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `identity-${masterId.slice(0, 8)}-${suffix}@buildhub.local`;
}

/** Mirror of phoneToEmail in src/lib/auth.tsx — keep in sync. */
function phoneToEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `p${digits}@project001.local`;
}

async function assertSuperUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, is_admin, is_super_user, master_account_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // If this account is linked to a master, always resolve to the master so
  // sub-identities (even ones that also happen to be flagged as super users
  // themselves) operate on the parent's identity list and can switch back.
  if (data?.master_account_id) {
    const { data: master, error: masterError } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, is_super_user")
      .eq("id", data.master_account_id)
      .maybeSingle();
    if (masterError) throw new Error(masterError.message);
    if (master?.is_super_user || master?.is_admin) return master.id;
  }
  if (data?.is_super_user) {
    return data.id;
  }
  throw new Error("Forbidden: not a super user");
}

async function maybeSuperUser(userId: string) {
  try {
    return await assertSuperUser(userId);
  } catch (error: any) {
    if (String(error?.message ?? "").includes("Forbidden")) return null;
    throw error;
  }
}

export const listIdentities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const masterId = await maybeSuperUser(context.userId);
    if (!masterId) return { identities: [] as Array<any>, masterId: null, forbidden: true };

    const { data: rows, error } = await supabaseAdmin
      .from("super_user_identities")
      .select("id, identity_user_id, display_order, avatar_shape, is_official, badges, description")
      .eq("master_user_id", masterId)
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);

    const identityIds = (rows ?? []).map((r) => r.identity_user_id);
    if (identityIds.length === 0) return { identities: [] as Array<any>, masterId, forbidden: false };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, is_provider, is_coordinator, is_organization, is_client, is_specialist, is_supplier, is_admin")
      .in("id", identityIds);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Unread counts per identity
    const { data: threads } = await supabaseAdmin
      .from("message_threads")
      .select("id, participant_a, participant_b")
      .or(
        `participant_a.in.(${identityIds.join(",")}),participant_b.in.(${identityIds.join(",")})`,
      );
    const threadOwner = new Map<string, string>(); // threadId -> identity_user_id receiver
    for (const t of threads ?? []) {
      if (identityIds.includes(t.participant_a)) threadOwner.set(t.id, t.participant_a);
      else if (identityIds.includes(t.participant_b)) threadOwner.set(t.id, t.participant_b);
    }
    const unreadByIdentity = new Map<string, number>();
    if (threadOwner.size > 0) {
      const { data: msgs } = await supabaseAdmin
        .from("messages")
        .select("thread_id, sender_id, read_at")
        .in("thread_id", Array.from(threadOwner.keys()))
        .is("read_at", null);
      for (const m of msgs ?? []) {
        const owner = threadOwner.get(m.thread_id);
        if (!owner) continue;
        if (m.sender_id === owner) continue; // own outgoing message
        unreadByIdentity.set(owner, (unreadByIdentity.get(owner) ?? 0) + 1);
      }
    }

    return {
      masterId,
      forbidden: false,
      identities: (rows ?? []).map((r) => ({
        ...r,
        profile: pmap.get(r.identity_user_id) ?? null,
        unread: unreadByIdentity.get(r.identity_user_id) ?? 0,
      })),
    };
  });

const createSchema = z.object({
  full_name: z.string().min(1).max(120),
  description: z.string().max(300).optional().default(""),
  avatar_url: z.string().url().nullable().optional(),
  avatar_shape: z.enum(["circle", "square"]).default("circle"),
  user_type: z.enum(["worker", "company", "supplier", "client", "specialist"]),
  location: z.string().max(120).optional().default(""),
  badges: z.array(z.string().max(40)).max(8).default([]),
});

export const createIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const masterId = await assertSuperUser(context.userId);

    const email = syntheticEmail(masterId);
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        language: "km",
        is_provider: data.user_type === "worker",
        is_specialist: data.user_type === "specialist",
        is_organization: data.user_type === "company",
        is_client: data.user_type === "client",
      },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create identity");
    const identityId = created.user.id;

    // Patch profile with extras + master link + supplier flag if applicable
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        about_me: data.description ?? "",
        avatar_url: data.avatar_url ?? null,
        master_account_id: masterId,
        is_supplier: data.user_type === "supplier",
      })
      .eq("id", identityId);

    const { data: row, error: iErr } = await supabaseAdmin
      .from("super_user_identities")
      .insert({
        master_user_id: masterId,
        identity_user_id: identityId,
        display_order: 100 + Math.floor(Date.now() / 1000) % 10000,
        avatar_shape: data.avatar_shape,
        badges: data.badges,
        description: data.description ?? "",
      })
      .select()
      .single();
    if (iErr) throw new Error(iErr.message);

    return { ok: true, identity: row };
  });

export const updateIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      identity_id: z.string().uuid(),
      full_name: z.string().min(1).max(120).optional(),
      description: z.string().max(300).optional(),
      avatar_url: z.string().url().nullable().optional(),
      avatar_shape: z.enum(["circle", "square"]).optional(),
      badges: z.array(z.string().max(40)).max(8).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const masterId = await assertSuperUser(context.userId);

    const { data: row, error } = await supabaseAdmin
      .from("super_user_identities")
      .select("identity_user_id, master_user_id")
      .eq("id", data.identity_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.master_user_id !== masterId) throw new Error("Not found");

    if (data.full_name || data.avatar_url !== undefined || data.description !== undefined) {
      await supabaseAdmin
        .from("profiles")
        .update({
          ...(data.full_name && { full_name: data.full_name }),
          ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
          ...(data.description !== undefined && { about_me: data.description }),
        })
        .eq("id", row.identity_user_id);
    }

    const patch: { avatar_shape?: "circle" | "square"; badges?: string[]; description?: string } = {};
    if (data.avatar_shape) patch.avatar_shape = data.avatar_shape;
    if (data.badges) patch.badges = data.badges;
    if (data.description !== undefined) patch.description = data.description;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("super_user_identities").update(patch).eq("id", data.identity_id);
    }
    return { ok: true };
  });

/**
 * Switch into an identity. Returns a one-time magic-link token-hash that the
 * client uses to call supabase.auth.verifyOtp() — replacing the current session.
 * The target may be the master account itself, or any of its identities.
 */
export const switchToIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ target_user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const masterId = await assertSuperUser(context.userId);

    // Authorize: target must be the master itself OR a linked identity
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, master_account_id")
      .eq("id", data.target_user_id)
      .maybeSingle();
    if (!target) throw new Error("Target not found");
    if (target.id !== masterId && target.master_account_id !== masterId) {
      throw new Error("Forbidden");
    }

    // Look up the auth.users email
    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(
      data.target_user_id,
    );
    if (uErr || !userRes.user?.email) throw new Error("Identity has no email");

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userRes.user.email,
    });
    if (lErr || !link?.properties) throw new Error(lErr?.message ?? "Failed to issue link");

    return {
      email: userRes.user.email,
      token_hash: link.properties.hashed_token,
    };
  });

/**
 * Unified inbox: list latest threads across all identities (and the master).
 */
export const getUnifiedInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const masterId = await assertSuperUser(context.userId);

    const { data: identityRows } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`id.eq.${masterId},master_account_id.eq.${masterId}`);
    const ids = (identityRows ?? []).map((r) => r.id);
    if (ids.length === 0) return { threads: [] as Array<any> };

    const { data: threads } = await supabaseAdmin
      .from("message_threads")
      .select("id, participant_a, participant_b, last_message, last_message_at")
      .or(`participant_a.in.(${ids.join(",")}),participant_b.in.(${ids.join(",")})`)
      .order("last_message_at", { ascending: false })
      .limit(100);

    // Count unread per thread (messages not sent by the receiving identity)
    const threadIds = (threads ?? []).map((t) => t.id);
    const unreadByThread = new Map<string, number>();
    if (threadIds.length > 0) {
      const { data: msgs } = await supabaseAdmin
        .from("messages")
        .select("thread_id, sender_id, read_at")
        .in("thread_id", threadIds)
        .is("read_at", null);
      const ownerByThread = new Map<string, string>();
      for (const t of threads ?? []) {
        ownerByThread.set(t.id, ids.includes(t.participant_a) ? t.participant_a : t.participant_b);
      }
      for (const m of msgs ?? []) {
        if (m.sender_id === ownerByThread.get(m.thread_id)) continue;
        unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
      }
    }

    // Resolve other-party profiles + receiving-identity profiles
    const otherIds = new Set<string>();
    for (const t of threads ?? []) {
      const owner = ids.includes(t.participant_a) ? t.participant_a : t.participant_b;
      const other = owner === t.participant_a ? t.participant_b : t.participant_a;
      otherIds.add(other);
    }
    const allProfileIds = Array.from(new Set([...ids, ...otherIds]));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", allProfileIds);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

    return {
      threads: (threads ?? []).map((t) => {
        const owner = ids.includes(t.participant_a) ? t.participant_a : t.participant_b;
        const other = owner === t.participant_a ? t.participant_b : t.participant_a;
        return {
          thread_id: t.id,
          identity_id: owner,
          identity_name: pmap.get(owner)?.full_name ?? null,
          identity_avatar: pmap.get(owner)?.avatar_url ?? null,
          other_id: other,
          other_name: pmap.get(other)?.full_name ?? null,
          other_avatar: pmap.get(other)?.avatar_url ?? null,
          last_message: t.last_message,
          last_message_at: t.last_message_at,
          unread: unreadByThread.get(t.id) ?? 0,
        };
      }),
    };
  });

/** Quick check: is the current user a super user? Used by the client to gate the menu entry. */
export const amISuperUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, is_super_user, master_account_id")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      isSuperUser: !!(data?.is_super_user || data?.is_admin),
      isIdentity: !!data?.master_account_id,
    };
  });

/**
 * Assign a phone-number login to a sub-identity. Anyone signing in with that
 * phone + password lands directly on that identity (no manual switching).
 * Only the master super user can call this.
 */
export const setIdentityPhoneLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      identity_user_id: z.string().uuid(),
      phone: z.string().min(6).max(20),
      password: z.string().min(6).max(72),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const masterId = await assertSuperUser(context.userId);

    // Verify target belongs to this master
    const { data: target, error: tErr } = await supabaseAdmin
      .from("profiles")
      .select("id, master_account_id")
      .eq("id", data.identity_user_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target || target.master_account_id !== masterId) {
      throw new Error("Identity not found");
    }

    const email = phoneToEmail(data.phone);

    // Ensure this phone is not already taken by another auth user
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .neq("id", data.identity_user_id)
      .maybeSingle();
    if (existing) throw new Error("Phone number already in use");

    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(
      data.identity_user_id,
      { email, password: data.password, email_confirm: true },
    );
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin
      .from("profiles")
      .update({ phone: data.phone })
      .eq("id", data.identity_user_id);

    return { ok: true };
  });
