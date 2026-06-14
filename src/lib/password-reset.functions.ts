import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const TELEGRAM_BOT_USERNAME = "Jangsomnong_bot";

function normalize(phone: string) {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}
function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function hashResetCode(resetId: string, code: string) {
  return hashCode(`${resetId}:${code}`);
}

export const requestPasswordResetTelegram = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().min(6).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: SupabaseClient = supabaseAdmin;
    const digits = normalize(data.phone);
    if (digits.length < 6) throw new Error("Invalid phone");

    const { data: recent } = await db
      .from("telegram_password_resets")
      .select("created_at")
      .eq("phone_digits", digits)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at) {
      const ageMs = Date.now() - new Date(recent.created_at).getTime();
      if (ageMs < 60_000) throw new Error("Please wait before requesting another code");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", `+855${digits}`)
      .maybeSingle();

    const resetId = randomUUID();
    const startToken = randomBytes(24).toString("base64url");
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await db.from("telegram_password_resets").insert({
      id: resetId,
      user_id: profile?.id ?? null,
      phone_digits: digits,
      start_token_hash: hashCode(startToken),
      expires_at: expires,
    });
    if (insErr) throw new Error(insErr.message);

    return {
      resetId,
      botUrl: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${startToken}`,
    };
  });

export const verifyResetCodeAndSetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { resetId: string; code: string; newPassword: string }) =>
    z
      .object({
        resetId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
        newPassword: z.string().min(6).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: SupabaseClient = supabaseAdmin;

    const { data: row, error: selErr } = await db
      .from("telegram_password_resets")
      .select("id, user_id, code_hash, expires_at, attempts, used_at, telegram_chat_id")
      .eq("id", data.resetId)
      .is("used_at", null)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row?.user_id || !row.code_hash || !row.telegram_chat_id) throw new Error("Invalid code");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired");
    if (row.attempts >= 5) throw new Error("Too many attempts");

    const submitted = Buffer.from(hashResetCode(row.id, data.code));
    const stored = Buffer.from(row.code_hash);
    const match = submitted.length === stored.length && timingSafeEqual(submitted, stored);

    if (!match) {
      await db
        .from("telegram_password_resets")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Invalid code");
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.newPassword,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);

    await db
      .from("telegram_password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true };
  });
