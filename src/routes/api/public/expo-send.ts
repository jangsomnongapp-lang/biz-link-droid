import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendExpoPushToTokens } from "@/lib/expoPush.server";

const bodySchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(500).default(""),
  data: z.record(z.string(), z.string()).optional(),
});

export const Route = createFileRoute("/api/public/expo-send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const secret = process.env.FCM_PUSH_WEBHOOK_SECRET ?? "";
          if (!secret || auth !== `Bearer ${secret}`) {
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
            .eq("user_id", parsed.user_id)
            .eq("provider", "expo");
          if (error) {
            console.error("expo-send: device_tokens query failed", error);
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }
          const tokens = (rows ?? []).map((r) => r.token).filter(Boolean);
          if (tokens.length === 0) return Response.json({ ok: true, sent: 0, skipped: "no_expo_tokens" });

          const results = await sendExpoPushToTokens(tokens, {
            title: parsed.title,
            body: parsed.body,
            data: parsed.data,
          });

          // Expo "DeviceNotRegistered" / "InvalidCredentials" means token is dead
          const dead = results
            .filter(
              (r) =>
                !r.ok &&
                (r.errorCode === "DeviceNotRegistered" ||
                  r.errorCode === "InvalidCredentials" ||
                  r.status === 400),
            )
            .map((r) => r.token);
          if (dead.length > 0) {
            await supabaseAdmin.from("device_tokens").delete().in("token", dead);
          }

          const failedDetails = results
            .filter((r) => !r.ok)
            .map((r) => ({ status: r.status, errorCode: r.errorCode }));
          if (failedDetails.length > 0) {
            console.error("expo-send: some sends failed", failedDetails);
          }

          return Response.json({
            ok: true,
            sent: results.filter((r) => r.ok).length,
            failed: results.filter((r) => !r.ok).length,
            pruned: dead.length,
            failedDetails,
          });
        } catch (e) {
          const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
          console.error("expo-send: unhandled error", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
