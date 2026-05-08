import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const requestFreeHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Verify user has at least one active listing
    const { data: active, error: lerr } = await supabaseAdmin
      .from("listings")
      .select("id, title")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    if (lerr) throw new Error(lerr.message);
    if (!active || active.length === 0) {
      throw new Error("You must have at least 1 active project to request help.");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, is_client")
      .eq("id", userId)
      .maybeSingle();

    const requesterName = profile?.full_name ?? "Someone";
    const role = profile?.is_client ? "client" : "worker";
    const title = `Free help request from ${requesterName}`;
    const body = role === "client"
      ? `${requesterName} is requesting free technical advice for their construction project.`
      : `${requesterName} is requesting free advice on how to execute their work.`;

    // Notify all admins
    const { data: admins, error: aerr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("is_admin", true);
    if (aerr) throw new Error(aerr.message);

    if (admins && admins.length > 0) {
      const rows = admins.map((a) => ({
        user_id: a.id,
        kind: "help_request",
        title,
        body,
        related_user_id: userId,
        related_listing_id: active[0].id,
      }));
      const { error: nerr } = await supabaseAdmin.from("notifications").insert(rows);
      if (nerr) throw new Error(nerr.message);
    }

    // Also fire telegram notification via existing helper (best-effort)
    try {
      await supabaseAdmin.rpc("notify_telegram" as any, {
        _kind: "help_request",
        _payload: {
          user_id: userId,
          user_name: requesterName,
          role,
          title,
          body,
        },
      });
    } catch {
      // ignore
    }

    return { ok: true };
  });
