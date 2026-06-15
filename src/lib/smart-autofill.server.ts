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

interface ProductCandidate {
  id: string;
  title: string;
  content: string;
  photoUrl: string;
}

const VisualMatchesSchema = z.object({
  matches: z.array(
    z.object({
      id: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export async function matchConstructionProductPhotos(
  customerImage: string,
  candidates: ProductCandidate[],
): Promise<string[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is unavailable");
  if (!candidates.length) return [];

  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `The first image is a customer's construction product. Compare it visually with every numbered supplier product image that follows. Match by the actual object, shape, material, packaging, and construction use—not merely by written product names. Different brands of the same product type can match. Reject merely related products. Return JSON only in this exact form: {"matches":[{"id":"candidate id","confidence":0.0}]}. Include at most 8 candidates with confidence of 0.55 or higher, best first.`,
    },
    { type: "image_url", image_url: { url: customerImage } },
  ];
  for (const candidate of candidates) {
    content.push({
      type: "text",
      text: `SUPPLIER CANDIDATE id=${candidate.id}\nListing text (secondary hint only): ${candidate.title} ${candidate.content}`.slice(
        0,
        700,
      ),
    });
    content.push({ type: "image_url", image_url: { url: candidate.photoUrl } });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content }],
      max_tokens: 500,
      temperature: 0,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Visual product matching failed (${response.status}): ${detail}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const raw = payload.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw : raw?.map((part) => part.text ?? "").join("");
  const json = text?.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  const parsed = VisualMatchesSchema.safeParse(JSON.parse(json));
  if (!parsed.success) return [];
  const validIds = new Set(candidates.map((candidate) => candidate.id));
  return parsed.data.matches
    .filter((match) => match.confidence >= 0.55 && validIds.has(match.id))
    .map((match) => match.id)
    .slice(0, 8);
}

export async function identifyConstructionProduct(imageDataUrl: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is unavailable");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Identify the main construction material or tool in this photo. Return only useful search keywords: first the Khmer product name, then the English name. No sentence, brand guess, quantity, or explanation. Example: ស៊ីម៉ងត៍ cement",
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: 120,
      temperature: 0.1,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Picture recognition failed (${response.status}): ${detail}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const text =
    typeof content === "string" ? content : content?.map((part) => part.text ?? "").join(" ");
  return (text ?? "")
    .replace(/[\n\r]+/g, " ")
    .trim()
    .slice(0, 200);
}

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
