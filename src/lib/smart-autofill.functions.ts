import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeSmartAutofillInput } from "@/lib/smart-autofill.schema";

export const smartAutofill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sanitizeSmartAutofillInput(data))
  .handler(async ({ data }) => {
    if (!data.valid) return null;
    const { generateSmartAutofill } = await import("@/lib/smart-autofill.server");
    return generateSmartAutofill(data);
  });

export const recognizeProductPicture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sanitizeSmartAutofillInput(data))
  .handler(async ({ data }) => {
    if (!data.valid || !data.imageDataUrl) {
      return { product: "", error: "invalid-image" as const };
    }
    try {
      const { identifyConstructionProduct } = await import("@/lib/smart-autofill.server");
      const product = await identifyConstructionProduct(data.imageDataUrl);
      return { product, error: product ? null : ("not-recognized" as const) };
    } catch (error) {
      console.error("Picture recognition failed", error);
      return { product: "", error: "recognition-unavailable" as const };
    }
  });
