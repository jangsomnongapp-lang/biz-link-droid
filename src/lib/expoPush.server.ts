// Expo Push API sender for Cloudflare Workers runtime

export interface ExpoPushSendResult {
  token: string;
  ok: boolean;
  status: number;
  errorCode?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Send push notifications via Expo Push API.
 * ExponentPushToken[...] tokens ONLY.
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
export async function sendExpoPushToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<ExpoPushSendResult[]> {
  if (tokens.length === 0) return [];

  // Expo recommends batching in chunks of ~100
  const BATCH_SIZE = 100;
  const results: ExpoPushSendResult[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
      priority: "high",
      channelId: "buildhub_high_v2",
    }));

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (res.status === 429) {
      // Rate limited — Expo asks for backoff. We won't retry inline here;
      // the caller (queue worker) will retry on next run.
      console.warn("Expo push rate limited");
    }

    let tickets: ExpoPushTicket[] | null = null;
    try {
      const json = (await res.json()) as { data?: ExpoPushTicket[] };
      tickets = json.data ?? null;
    } catch {
      // ignore JSON parse errors
    }

    if (!tickets || tickets.length !== batch.length) {
      // If we can't map tickets to tokens, mark all as failed with HTTP status
      batch.forEach((token) =>
        results.push({ token, ok: false, status: res.status, errorCode: `HTTP_${res.status}` }),
      );
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const token = batch[j];
      const ticket = tickets[j];
      if (ticket.status === "ok") {
        results.push({ token, ok: true, status: 200 });
      } else {
        results.push({
          token,
          ok: false,
          status: res.status,
          errorCode: ticket.details?.error ?? ticket.message ?? "error",
        });
      }
    }
  }

  return results;
}
