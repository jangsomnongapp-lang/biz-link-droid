import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  flow: z.enum(["material", "rental", "supplier"]),
  text: z.string().max(1000).optional(),
  imageDataUrl: z.string().max(7_500_000).optional(),
});

export const smartAutofill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { generateSmartAutofill } = await import("@/lib/smart-autofill.server");
      return await generateSmartAutofill(data);
    } catch {
      return null;
    }
  });