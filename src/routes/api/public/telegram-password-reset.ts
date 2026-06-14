import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const TelegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      chat: z.object({ id: z.number().int() }),
      from: z.object({ id: z.number().int() }).optional(),
      text: z.string().max(500).optional(),
      contact: z
        .object({
          phone_number: z.string().min(6).max(30),
          user_id: z.number().int().optional(),
        })
        .optional(),
    })
    .optional(),
});

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^855/, "").replace(/^0+/, "");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function telegramCall(method: string, body: Record<string, unknown>) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey || !telegramKey) throw new Error("Telegram is not configured");

  const response = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Telegram ${method} failed (${response.status}): ${detail}`);
  }
}

async function sendContactRequest(chatId: number) {
  await telegramCall("sendMessage", {
    chat_id: chatId,
    text: "សូមចុចប៊ូតុងខាងក្រោម ដើម្បីផ្ទៀងផ្ទាត់លេខទូរស័ព្ទរបស់អ្នក។\n\nTap the button below to verify your phone number.",
    reply_markup: {
      keyboard: [[{ text: "📱 ផ្ទៀងផ្ទាត់លេខទូរស័ព្ទ / Verify phone", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function handleStart(db: SupabaseClient, chatId: number, token: string) {
  const { data: reset } = await db
    .from("telegram_password_resets")
    .select("id, expires_at, used_at")
    .eq("start_token_hash", hash(token))
    .maybeSingle();

  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    await telegramCall("sendMessage", {
      chat_id: chatId,
      text: "តំណនេះផុតកំណត់។ សូមស្នើសុំម្តងទៀតក្នុង BuildHub។\n\nThis link has expired. Please request another one in BuildHub.",
    });
    return;
  }

  await db.from("telegram_password_resets").update({ telegram_chat_id: chatId }).eq("id", reset.id);
  await sendContactRequest(chatId);
}

async function handleContact(
  db: SupabaseClient,
  chatId: number,
  senderId: number | undefined,
  contact: { phone_number: string; user_id?: number },
) {
  if (!senderId || contact.user_id !== senderId) {
    await telegramCall("sendMessage", {
      chat_id: chatId,
      text: "សូមចែករំលែកលេខផ្ទាល់ខ្លួនរបស់អ្នកដោយប្រើប៊ូតុងផ្ទៀងផ្ទាត់។\n\nPlease share your own number using the verification button.",
    });
    return;
  }

  const { data: reset } = await db
    .from("telegram_password_resets")
    .select("id, phone_digits, user_id, expires_at, used_at, last_sent_at")
    .eq("telegram_chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    !reset ||
    reset.used_at ||
    !reset.user_id ||
    normalizePhone(contact.phone_number) !== reset.phone_digits ||
    new Date(reset.expires_at).getTime() < Date.now()
  ) {
    await telegramCall("sendMessage", {
      chat_id: chatId,
      text: "មិនអាចផ្ទៀងផ្ទាត់លេខនេះបានទេ។ សូមពិនិត្យលេខក្នុង BuildHub ហើយព្យាយាមម្តងទៀត។\n\nWe could not verify this number. Check the number in BuildHub and try again.",
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (reset.last_sent_at && Date.now() - new Date(reset.last_sent_at).getTime() < 60_000) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await db
    .from("telegram_password_resets")
    .update({ code_hash: hash(`${reset.id}:${code}`), last_sent_at: new Date().toISOString() })
    .eq("id", reset.id);
  if (error) throw new Error(error.message);

  await telegramCall("sendMessage", {
    chat_id: chatId,
    text: `លេខកូដកំណត់ពាក្យសម្ងាត់របស់អ្នកគឺ: ${code}\nផុតកំណត់ក្នុង ១០ នាទី។\n\nYour BuildHub password reset code is: ${code}\nIt expires in 10 minutes.`,
    reply_markup: { remove_keyboard: true },
  });
}

export const Route = createFileRoute("/api/public/telegram-password-reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const telegramKey = process.env.TELEGRAM_API_KEY;
        if (!telegramKey) return new Response("Not configured", { status: 500 });

        const expected = hash(`telegram-webhook:${telegramKey}`);
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, expected)) return new Response("Unauthorized", { status: 401 });

        const parsed = TelegramUpdateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success || !parsed.data.message) return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db: SupabaseClient = supabaseAdmin;
        const message = parsed.data.message;
        const startToken = message.text?.match(/^\/start\s+([A-Za-z0-9_-]{20,100})$/)?.[1];

        if (startToken) await handleStart(db, message.chat.id, startToken);
        else if (message.contact) {
          await handleContact(db, message.chat.id, message.from?.id, message.contact);
        }

        return Response.json({ ok: true });
      },
    },
  },
});