import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  component: JoinPage,
});

function JoinPage() {
  const { ref } = useSearch({ from: "/join" });
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();

  useEffect(() => {
    if (!ref) return;
    void (async () => {
      // Resolve inviter via secure RPC
      const { data: inviterId } = await supabase.rpc("resolve_invite_code", { _code: ref });
      if (!inviterId) {
        nav({ to: "/" });
        return;
      }
      // Record the click via secure RPC (validates code server-side)
      await supabase.rpc("record_invite_click", { _code: ref });
      // Persist code so register can record the join
      try {
        if (typeof window !== "undefined") localStorage.setItem("invite_ref", ref);
      } catch {
        /* noop */
      }
      // Send to register if not signed in, otherwise home
      if (!loading) {
        nav({ to: user ? "/home" : "/register" });
      }
    })();
  }, [ref, loading, user, nav]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{t("loading_invitation")}</p>
        <Link to="/" className="mt-3 inline-block text-sm font-semibold text-primary">
          {t("continue_to_app")}
        </Link>
      </div>
    </div>
  );
}
