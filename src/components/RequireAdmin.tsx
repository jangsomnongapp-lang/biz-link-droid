import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { verifyAdmin } from "@/lib/admin-guard.functions";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const check = useServerFn(verifyAdmin);
  const [state, setState] = useState<"checking" | "ok" | "deny">("checking");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/" });
      return;
    }
    let cancelled = false;
    check()
      .then((r) => {
        if (cancelled) return;
        if (r?.isAdmin) setState("ok");
        else {
          setState("deny");
          nav({ to: "/home" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState("deny");
        nav({ to: "/home" });
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, nav, check]);

  if (loading || state !== "ok")
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  return <>{children}</>;
}
