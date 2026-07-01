import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendFcmToTokens } from "@/lib/fcm.server";

const bodySchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(500).default(""),
  data: z.record(z.string(), z.string()).optional(),
});

export const Route = createFileRoute("/api/public/fcm-send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`;
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY || auth !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch (e) {
          return new Response(`Bad request: ${(e as Error).message}`, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: rows, error } = await supabaseAdmin
          .from("device_tokens")
          .select("token")
          .eq("user_id", parsed.user_id);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        const tokens = (rows ?? []).map((r) => r.token).filter(Boolean);
        if (tokens.length === 0) return Response.json({ ok: true, sent: 0, skipped: "no_tokens" });

        const results = await sendFcmToTokens(tokens, {
          title: parsed.title,
          body: parsed.body,
          data: parsed.data,
        });

        // Prune invalid tokens returned by FCM
        const dead = results
          .filter((r) => !r.ok && (r.errorCode === "UNREGISTERED" || r.errorCode === "INVALID_ARGUMENT" || r.status === 404))
          .map((r) => r.token);
        if (dead.length > 0) {
          await supabaseAdmin.from("device_tokens").delete().in("token", dead);
        }

        return Response.json({
          ok: true,
          sent: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          pruned: dead.length,
        });
      },
    },
  },
});
