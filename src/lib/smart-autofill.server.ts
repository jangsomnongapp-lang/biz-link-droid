import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import { z } from "zod";

const ResultSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string(),
  quantity: z.string(),
  durationDays: z.string(),
  related: z.array(z.string()),
  alternatives: z.array(z.string()),
  marketPriceRange: z.string(),
});

export type SmartAutofillResult = z.infer<typeof ResultSchema>;

export async function generateSmartAutofill(input: {
  flow: "material" | "rental" | "supplier";
  text?: string;
  imageDataUrl?: string;
}): Promise<SmartAutofillResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Unavailable");

  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": key },
  });
  const categoryChoices =
    input.flow === "material"
      ? "electrical, cement, steel, zinc, tools, timber, sanitary, paint, other"
      : input.flow === "rental"
        ? "vehicles, heavy, light, tools"
        : "a short construction product category name";
  const prompt = `Identify the construction item for a Cambodia marketplace ${input.flow} form.
Return concise, practical field values in the user's language when text is provided.
Category must be one of: ${categoryChoices}.
For material: include likely quantity only when evident, plus up to 3 related items and 3 substitute alternatives.
For rental: include likely quantity and rental duration in whole days only when evident.
For supplier: include a broad category and a realistic Cambodia market price range as reference; never return a single exact price.
Unknown values must be empty strings or empty arrays. Do not mention technology.
User text: ${input.text?.slice(0, 1000) ?? ""}`;
  const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
    { type: "text", text: prompt },
  ];
  if (input.imageDataUrl?.startsWith("data:image/")) {
    content.push({ type: "image", image: input.imageDataUrl });
  }
  const { output } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    output: Output.object({ schema: ResultSchema }),
    messages: [{ role: "user", content }],
  });
  return output;
}
