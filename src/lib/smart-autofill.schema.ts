import { z } from "zod";

const SmartAutofillInputSchema = z.object({
  flow: z.enum(["material", "rental", "supplier"]),
  text: z.string().max(1000).optional(),
  imageDataUrl: z.string().max(7_500_000).optional(),
});

export type SmartAutofillInput = z.infer<typeof SmartAutofillInputSchema>;

export type SanitizedSmartAutofillInput =
  | (SmartAutofillInput & { valid: true })
  | { flow: "material"; valid: false };

export function sanitizeSmartAutofillInput(input: unknown): SanitizedSmartAutofillInput {
  const parsed = SmartAutofillInputSchema.safeParse(input);
  if (!parsed.success) return { flow: "material", valid: false };
  return { ...parsed.data, valid: true };
}