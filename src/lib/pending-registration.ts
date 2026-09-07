import { supabase } from "@/integrations/supabase/client";

const KEY = "buildhub_pending_registration";

export interface PendingRegistration {
  roles: {
    is_provider: boolean;
    is_coordinator: boolean;
    is_organization: boolean;
    is_client: boolean;
    is_specialist: boolean;
  };
  categoryIds: string[];
}

/** Remember the roles/categories chosen in registration before an OAuth redirect. */
export function savePendingRegistration(data: PendingRegistration) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

function readPendingRegistration(): PendingRegistration | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRegistration;
    if (!parsed || typeof parsed !== "object" || !parsed.roles) return null;
    return {
      roles: {
        is_provider: !!parsed.roles.is_provider,
        is_coordinator: !!parsed.roles.is_coordinator,
        is_organization: !!parsed.roles.is_organization,
        is_client: !!parsed.roles.is_client,
        is_specialist: !!parsed.roles.is_specialist,
      },
      categoryIds: Array.isArray(parsed.categoryIds) ? parsed.categoryIds.filter((c) => typeof c === "string") : [],
    };
  } catch {
    return null;
  }
}

export function clearPendingRegistration() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * Apply roles/categories saved before a Google sign-in redirect.
 * Runs once per sign-in; safe to call on every session change.
 */
export async function applyPendingRegistration(userId: string) {
  const pending = readPendingRegistration();
  if (!pending) return;

  try {
    const { roles, categoryIds } = pending;
    await supabase.rpc("update_my_role_flags", {
      _is_provider: roles.is_provider,
      _is_coordinator: roles.is_coordinator,
      _is_organization: roles.is_organization,
      _is_client: roles.is_client,
    });

    if (roles.is_specialist) {
      await supabase.from("profiles").update({ is_specialist: true }).eq("id", userId);
    }

    if (categoryIds.length > 0) {
      await supabase
        .from("user_categories")
        .upsert(
          categoryIds.map((cid) => ({ user_id: userId, category_id: cid })),
          { onConflict: "user_id,category_id", ignoreDuplicates: true },
        );
    }
    clearPendingRegistration();
  } catch (e) {
    console.error("[pending-registration] failed to apply", e);
  }
}
