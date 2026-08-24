import { createFileRoute } from "@tanstack/react-router";
import { sendFcmToTokens } from "@/lib/fcm.server";
import { sendExpoPushToTokens } from "@/lib/expoPush.server";

/**
 * Queue worker: poll pending push_notification_queue rows and send them.
 *
 * Recommended invocation:
 *   Cloudflare Cron Trigger every 1 minute pointing to this route.
 *   Or a Supabase pg_cron job that calls this via HTTP with QUEUE_WORKER_SECRET.
 */

export const Route = createFileRoute("/api/public/process-push-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const secret = process.env.QUEUE_WORKER_SECRET ?? "";
          if (!secret || auth !== `Bearer ${secret}`) {
            return new Response("Unauthorized", { status: 401 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Fetch up to 100 pending rows (oldest first)
          const { data: rows, error } = await supabaseAdmin
            .from("push_notification_queue")
            .select("id, device_token, platform, title, body, data")
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(100);

          if (error) {
            console.error("process-push-queue: select failed", error);
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }

          if (!rows || rows.length === 0) {
            return Response.json({ ok: true, processed: 0 });
          }

          // Group by token provider using device_tokens table lookup
          const tokens = rows.map((r) => r.device_token);
          const { data: tokenMeta } = await supabaseAdmin
            .from("device_tokens")
            .select("token, provider")
            .in("token", tokens);

          const providerMap = new Map<string, string>();
          (tokenMeta ?? []).forEach((m) => providerMap.set(m.token, m.provider ?? "unknown"));

          const fcmRows = rows.filter((r) => providerMap.get(r.device_token) === "fcm");
          const expoRows = rows.filter((r) => providerMap.get(r.device_token) === "expo");
          const unknownRows = rows.filter((r) => {
            const p = providerMap.get(r.device_token);
            return p !== "fcm" && p !== "expo";
          });

          const now = new Date().toISOString();

          // Send notifications individually so each gets its own title/body/data
          const allResults: Array<{ token: string; ok: boolean; status: number; errorCode?: string; provider: "fcm" | "expo" }> = [];

          for (const row of fcmRows) {
            const results = await sendFcmToTokens([row.device_token], {
              title: row.title,
              body: row.body ?? "",
              data: (row.data as Record<string, string>) ?? {},
            });
            allResults.push({ ...results[0], provider: "fcm" });
          }

          for (const row of expoRows) {
            const results = await sendExpoPushToTokens([row.device_token], {
              title: row.title,
              body: row.body ?? "",
              data: (row.data as Record<string, string>) ?? {},
            });
            allResults.push({ ...results[0], provider: "expo" });
          }

          const deadTokens = allResults
            .filter(
              (r) =>
                !r.ok &&
                (r.errorCode === "UNREGISTERED" ||
                  r.errorCode === "INVALID_ARGUMENT" ||
                  r.errorCode === "DeviceNotRegistered" ||
                  r.errorCode === "InvalidCredentials" ||
                  r.status === 404 ||
                  r.status === 400),
            )
            .map((r) => r.token);

          if (deadTokens.length > 0) {
            await supabaseAdmin.from("device_tokens").delete().in("token", deadTokens);
          }

          // Update queue statuses
          for (const row of rows) {
            const res = allResults.find((r) => r.token === row.device_token);
            const status = res?.ok ? "sent" : "failed";
            const errorMessage = res?.ok ? null : res?.errorCode ?? "unknown";
            await supabaseAdmin
              .from("push_notification_queue")
              .update({ status, error_message: errorMessage, processed_at: now })
              .eq("id", row.id);
          }

          // Mark unknown-provider rows as failed so they don't block the queue forever
          for (const row of unknownRows) {
            await supabaseAdmin
              .from("push_notification_queue")
              .update({ status: "failed", error_message: "unknown_provider", processed_at: now })
              .eq("id", row.id);
          }

          return Response.json({
            ok: true,
            processed: rows.length,
            sent: allResults.filter((r) => r.ok).length,
            failed: allResults.filter((r) => !r.ok).length + unknownRows.length,
            pruned: deadTokens.length,
          });
        } catch (e) {
          const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
          console.error("process-push-queue: unhandled error", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
