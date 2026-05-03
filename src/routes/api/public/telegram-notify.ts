import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMessage(kind: string, data: Record<string, unknown>): string {
  switch (kind) {
    case "report":
      return (
        `🚩 <b>New report</b>\n` +
        `From: ${escapeHtml(data.reporter_name)}\n` +
        `Target: ${escapeHtml(data.target_kind)} (${escapeHtml(data.target_id)})\n` +
        `Reason: ${escapeHtml(data.reason) || "—"}`
      );
    case "post":
      return (
        `📝 <b>New post</b>\n` +
        `By: ${escapeHtml(data.user_name)}\n` +
        `Status: ${escapeHtml(data.status)}\n` +
        (data.content ? `\n${escapeHtml(data.content)}` : "")
      );
    case "story":
      return (
        `📸 <b>New story</b>\n` +
        `By: ${escapeHtml(data.user_name)}\n` +
        `Status: ${escapeHtml(data.status)}` +
        (data.caption ? `\n${escapeHtml(data.caption)}` : "")
      );
    case "project":
      return (
        `💼 <b>New project</b>\n` +
        `By: ${escapeHtml(data.user_name)}\n` +
        `Title: ${escapeHtml(data.title)}\n` +
        `Status: ${escapeHtml(data.status)}`
      );
    case "rental":
      return (
        `🚜 <b>New rental listing</b>\n` +
        `By: ${escapeHtml(data.user_name)}\n` +
        `Title: ${escapeHtml(data.title)}\n` +
        `Category: ${escapeHtml(data.category)}\n` +
        `Price/day: $${escapeHtml(data.price_per_day)}\n` +
        `Status: ${escapeHtml(data.status)}`
      );
    default:
      return `🔔 <b>${escapeHtml(kind)}</b>\n${escapeHtml(JSON.stringify(data))}`;
  }
}

export const Route = createFileRoute("/api/public/telegram-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const providedSecret = request.headers.get("x-webhook-secret");

        if (!expectedSecret || providedSecret !== expectedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
        if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
          return new Response("Telegram not configured", { status: 500 });
        }

        let payload: { kind: string; chat_id: string; data: Record<string, unknown> };
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        if (!payload?.kind || !payload?.chat_id) {
          return new Response("Missing kind or chat_id", { status: 400 });
        }

        const text = buildMessage(payload.kind, payload.data ?? {});

        const tgRes = await fetch(`${GATEWAY_URL}/sendMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: payload.chat_id,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });

        const body = await tgRes.text();
        if (!tgRes.ok) {
          console.error("Telegram send failed", tgRes.status, body);
          return new Response(`Telegram error: ${body}`, { status: 502 });
        }

        return new Response("ok");
      },
    },
  },
});
