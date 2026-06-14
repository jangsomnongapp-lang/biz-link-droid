import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeSmartAutofillInput } from "@/lib/smart-autofill.schema";

export const smartAutofill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sanitizeSmartAutofillInput(data))
  .handler(async ({ data }) => {
    try {
      if (!data.valid) return null;
      const { generateSmartAutofill } = await import("@/lib/smart-autofill.server");
      return await generateSmartAutofill(data);
    } catch (error) {
      console.error("Smart autofill generation failed", error);
      return null;
    }
  });
