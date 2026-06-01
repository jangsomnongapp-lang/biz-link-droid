import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

function phoneToEmail(phone: string) {
  const digits = normalizePhone(phone);
  return `p${digits}@project001.local`;
}

export const changeMyPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().trim().min(6).max(20).regex(/^[0-9+\-\s()]+$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const digits = normalizePhone(data.phone);
    if (digits.length < 6) throw new Error("Invalid phone number");

    const newEmail = phoneToEmail(data.phone);
    const normalizedPhone = `+855${digits}`;

    // Check uniqueness in profiles (compare against normalized form)
    const { data: clash } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", normalizedPhone)
      .neq("id", userId)
      .maybeSingle();
    if (clash) throw new Error("This phone number is already in use");

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
      phone: digits,
      email_confirm: true,
    });
    if (authErr) throw new Error(authErr.message);

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ phone: normalizedPhone })
      .eq("id", userId);
    if (profErr) throw new Error(profErr.message);

    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
