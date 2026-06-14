import { createClient } from "@supabase/supabase-js";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const requireAutofillAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    const url = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    const authorization = getRequest().headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!url || !publishableKey || !token) return null;

    const authClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;

    return next();
  } catch (error) {
    console.error("Smart autofill authentication failed", error);
    return null;
  }
});

const InputSchema = z.object({
  flow: z.enum(["material", "rental", "supplier"]),
  text: z.string().max(1000).optional(),
  imageDataUrl: z.string().max(7_500_000).optional(),
});

export const smartAutofill = createServerFn({ method: "POST" })
  .middleware([requireAutofillAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { generateSmartAutofill } = await import("@/lib/smart-autofill.server");
      return await generateSmartAutofill(data);
    } catch (error) {
      console.error("Smart autofill generation failed", error);
      return null;
    }
  });
