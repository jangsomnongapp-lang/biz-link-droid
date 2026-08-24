import { createStartHandler } from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";
import { createRouter } from "./router";
import { startInstance } from "./start";

// Standard TanStack Start Cloudflare handler
export default {
  async fetch(request: Request, env: Record<string, unknown>) {
    const handler = createStartHandler({
      createRouter,
      getRouterManifest,
    });
    return handler({ request, env });
  },

  // Cron trigger: process push notification queue
  async scheduled(
    controller: ScheduledController,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
  ) {
    const secret = (env.QUEUE_WORKER_SECRET as string) ?? "";
    const host = (env.HOST_URL as string) ?? "https://buildhubkh.com";
    const url = `${host}/api/public/process-push-queue`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      });

      const body = await res.text();
      console.log("[cron:process-push-queue] status:", res.status, "body:", body);
    } catch (e) {
      console.error("[cron:process-push-queue] failed:", e);
    }
  },
};
