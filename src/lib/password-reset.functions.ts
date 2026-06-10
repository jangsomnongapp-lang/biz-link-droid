import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt, timingSafeEqual } from "crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

function normalize(phone: string) {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}
function syntheticEmail(digits: string) {
  return `p${digits}@project001.local`;
}
function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

async function sendBrevoSms(toDigitsCountryless: string, message: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  if (!lovableKey || !brevoKey) throw new Error("SMS not configured");

  // Brevo requires E.164 without leading +; for Cambodia prefix 855
  const recipient = `855${toDigitsCountryless}`;

  const res = await fetch(`${GATEWAY_URL}/transactionalSMS/sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": brevoKey,
    },
    body: JSON.stringify({
      sender: "BuildHub",
      recipient,
      content: message,
      type: "transactional",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Brevo SMS failed", res.status, text);
    throw new Error(`SMS send failed (${res.status})`);
  }
}

export const requestPasswordResetSms = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().min(6).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const digits = normalize(data.phone);
    if (digits.length < 6) throw new Error("Invalid phone");

    // Find user via synthetic email
    const email = syntheticEmail(digits);
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    // listUsers doesn't filter; find match. For scale this should be replaced; OK here.
    const user = list.users.find((u) => u.email === email);
    if (!user) {
      // Don't reveal which phones exist
      return { ok: true };
    }

    // Throttle: 1 SMS per 60s
    const { data: recent } = await supabaseAdmin
      .from("password_reset_codes")
      .select("last_sent_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.last_sent_at) {
      const ageMs = Date.now() - new Date(recent.last_sent_at).getTime();
      if (ageMs < 60_000) throw new Error("Please wait before requesting another code");
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("password_reset_codes").insert({
      user_id: user.id,
      phone_digits: digits,
      code_hash: hashCode(code),
      expires_at: expires,
    });
    if (insErr) throw new Error(insErr.message);

    await sendBrevoSms(digits, `BuildHub: your password reset code is ${code}. Expires in 10 minutes.`);

    return { ok: true };
  });

export const verifyResetCodeAndSetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string; newPassword: string }) =>
    z
      .object({
        phone: z.string().min(6).max(20),
        code: z.string().regex(/^\d{6}$/),
        newPassword: z.string().min(6).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const digits = normalize(data.phone);
    const email = syntheticEmail(digits);

    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    const user = list.users.find((u) => u.email === email);
    if (!user) throw new Error("Invalid code");

    const { data: row, error: selErr } = await supabaseAdmin
      .from("password_reset_codes")
      .select("id, code_hash, expires_at, attempts, used_at")
      .eq("user_id", user.id)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Invalid code");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired");
    if (row.attempts >= 5) throw new Error("Too many attempts");

    const submitted = Buffer.from(hashCode(data.code));
    const stored = Buffer.from(row.code_hash);
    const match = submitted.length === stored.length && timingSafeEqual(submitted, stored);

    if (!match) {
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Invalid code");
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.newPassword,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin
      .from("password_reset_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true };
  });
