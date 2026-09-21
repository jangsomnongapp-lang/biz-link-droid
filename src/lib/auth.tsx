import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initPushNotifications } from "@/lib/pushNotifications";
import { initExpoPushTokenListener } from "@/lib/expoPushToken";
import { applyPendingRegistration, hasPendingRegistration } from "@/lib/pending-registration";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import type { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function isInvalidRefreshTokenError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  return text.includes("Invalid Refresh Token") || text.includes("refresh_token_not_found");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Restore session from storage FIRST, then subscribe to changes.
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error && isInvalidRefreshTokenError(error)) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          setSession(null);
          return;
        }
        setSession(data.session);
      })
      .catch(() => {
        // Transient error (e.g. offline). Do NOT sign the user out —
        // keep whatever session storage has and let onAuthStateChange recover.
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const uid = session?.user?.id ?? null;
    if (uid) {
      void applyPendingRegistration(uid);
      void initPushNotifications(uid);
      const cleanup = initExpoPushTokenListener(uid);
      return () => { cleanup(); };
    }
  }, [session?.user?.id]);

  // Global "must be registered" guard. The web Google OAuth flow returns to
  // "/" (not /login), so the login page's ensureRegistered check never runs
  // there — enforce it here so unregistered Google accounts are signed out no
  // matter which route the session lands on.
  const { t } = useI18n();
  const registrationCheckedRef = useRef<string | null>(null);
  useEffect(() => {
    const uid = session?.user?.id ?? null;
    if (loading || !uid) return;
    if (registrationCheckedRef.current === uid) return;
    registrationCheckedRef.current = uid;
    // Mid-registration (roles chosen before the Google redirect) — allowed.
    if (hasPendingRegistration()) return;
    // The login page runs its own guard with navigation handling — don't double-fire.
    if (window.location.pathname === "/login") return;
    void (async () => {
      try {
        const { data: p } = await supabase
          .from("profiles")
          .select("is_provider, is_coordinator, is_organization, is_client, is_specialist, is_supplier")
          .eq("id", uid)
          .maybeSingle();
        const registered = !!(
          p &&
          (p.is_provider || p.is_coordinator || p.is_organization || p.is_client || p.is_specialist || p.is_supplier)
        );
        if (!registered) {
          await supabase.auth.signOut();
          toast.error(t("login_not_registered"));
        }
      } catch {
        // Network hiccup — let them through rather than trapping real users.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.user?.id]);

  // Expose a global handler the native wrapper can call to set the session
  // after a Google login deep link. Using supabase.auth.setSession() (instead
  // of the wrapper writing localStorage directly) ensures the session is
  // stored in the exact format Supabase expects (user split into a separate
  // key, expires_at handling, etc.).
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setBuildHubSession = async (sessionJson: string) => {
      try {
        const session = JSON.parse(sessionJson);
        await supabase.auth.setSession(session);
      } catch (e) {
        console.error("[auth] __setBuildHubSession failed", e);
      }
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__setBuildHubSession;
    };
  }, []);

  // Hand the session back to the native app via deep link when a Google login
  // was initiated from the system browser (see nativeGoogleLogin.ts). The
  // native wrapper injects this session into the WebView so the user is logged
  // in there too.
  useEffect(() => {
    if (loading || !session) return;
    const redirectBack = localStorage.getItem("buildhub_oauth_redirect");
    if (!redirectBack) return;

    // Chrome may have a CACHED session that was already revoked by a logout in
    // the app (Chrome and the WebView have separate localStorage). If we hand
    // it back without validating, the app gets a dead session and the user is
    // bounced back still logged out. Validate against the server first; only
    // hand back a session that is actually still valid.
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        // Stale session. Do NOT clear the redirect marker here — login.tsx is
        // doing a fresh Google login, and once it completes it will set a
        // valid session that re-triggers this effect. Clearing the marker now
        // would strand the user in Chrome with no way to hand back the fresh
        // session.
        return;
      }
      localStorage.removeItem("buildhub_oauth_redirect");
      const sessionJson = encodeURIComponent(JSON.stringify(session));
      window.location.href = `${redirectBack}?session=${sessionJson}`;
    });
  }, [loading, session]);




  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          // Also drop the cached native Google account so the next sign-in
          // shows the account chooser instead of reusing the same account.
          try {
            if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
              const { SocialLogin } = await import("@capgo/capacitor-social-login");
              await SocialLogin.logout({ provider: "google" }).catch(() => undefined);
            }
          } catch {
            // ignore
          }
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

/** Normalize a Cambodian phone number to its local digits without +855 or a trunk zero. */
export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^855/, "").replace(/^0+/, "");
}

/** Build a synthetic email from a phone number so we can use Supabase email auth as the storage layer. */
export function phoneToEmail(phone: string) {
  const digits = normalizePhone(phone);
  return `p${digits}@project001.local`;
}

/** Include historical account formats created before phone normalization was standardized. */
export function phoneLoginEmails(phone: string) {
  const rawDigits = phone.replace(/\D/g, "");
  const localDigits = normalizePhone(phone);
  return Array.from(
    new Set([
      `p${localDigits}@project001.local`,
      `p0${localDigits}@project001.local`,
      `p${rawDigits}@project001.local`,
    ]),
  );
}
