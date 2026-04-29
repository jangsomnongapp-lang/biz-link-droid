import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  component: JoinPage,
});

function JoinPage() {
  const { ref } = useSearch({ from: "/join" });
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!ref) return;
    void (async () => {
      // Resolve inviter
      const { data: ic } = await supabase
        .from("invite_codes")
        .select("user_id")
        .eq("code", ref)
        .maybeSingle();
      if (!ic) {
        nav({ to: "/" });
        return;
      }
      // Record the click
      await supabase.from("invite_clicks").insert({ code: ref, inviter_id: ic.user_id });
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
        <p className="text-sm text-muted-foreground">Loading invitation...</p>
        <Link to="/" className="mt-3 inline-block text-sm font-semibold text-primary">
          Continue to app →
        </Link>
      </div>
    </div>
  );
}
