import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Restore session from storage FIRST, then subscribe to changes.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
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


  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
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
