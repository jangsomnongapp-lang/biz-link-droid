import { z } from "zod";
import {
  CATALOG_CATEGORY_CODES,
  ParsedCatalogItemSchema,
  type ParsedCatalogItem,
} from "@/lib/catalog.schema";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

type Block =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

async function callGateway(content: Block[], maxTokens: number): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is unavailable");
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content }],
      max_tokens: maxTokens,
      temperature: 0,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`AI request failed (${response.status}): ${detail}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const raw = payload.choices?.[0]?.message?.content;
  return typeof raw === "string" ? raw : (raw?.map((part) => part.text ?? "").join("") ?? "");
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI returned no structured data");
  return JSON.parse(match[0]);
}

const ImportSchema = z.object({ items: z.array(ParsedCatalogItemSchema).default([]) });

const IMPORT_PROMPT = `You convert a construction supplier's price list into a structured product catalogue for Cambodia.
Read every product row you can see, including handwritten Khmer notes, Excel screenshots, PDFs and WhatsApp screenshots.
Return JSON only, in this exact form:
{"items":[{"name_en":"Portland cement 50kg","name_km":"ស៊ីម៉ង់ត៍ ៥០គីឡូ","unit":"bag","price":6.5,"currency":"USD","category_code":"cement"}]}
Rules:
- name_en is required, translate/transliterate Khmer names to English when needed; name_km may be "" if unknown.
- unit is a short word such as bag, piece, sheet, m2, m3, box, roll, set, kg, can, bucket, pair, unit.
- price is a number without currency symbols, or null if the list has no price. Prices with ៛ or values above 1000 are usually KHR.
- category_code must be one of: ${CATALOG_CATEGORY_CODES.join(", ")}.
- Skip totals, headers, phone numbers and anything that is not a sellable product. Maximum 60 items.`;

export async function parsePriceList(input: {
  imageDataUrl?: string;
  fileDataUrl?: string;
  fileName?: string;
  text?: string;
}): Promise<ParsedCatalogItem[]> {
  const content: Block[] = [{ type: "text", text: IMPORT_PROMPT }];
  if (input.imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  }
  if (input.fileDataUrl) {
    content.push({
      type: "file",
      file: { filename: input.fileName || "price-list.pdf", file_data: input.fileDataUrl },
    });
  }
  if (input.text) {
    content.push({ type: "text", text: `PRICE LIST TEXT:\n${input.text.slice(0, 18_000)}` });
  }
  if (content.length === 1) return [];
  const parsed = ImportSchema.safeParse(extractJson(await callGateway(content, 4000)));
  if (!parsed.success) return [];
  return parsed.data.items
    .filter((item) => item.name_en.trim().length > 1)
    .map((item) => ({
      ...item,
      name_en: item.name_en.trim().slice(0, 120),
      name_km: item.name_km.trim().slice(0, 120),
      unit: (item.unit || "unit").trim().slice(0, 20),
      category_code: (CATALOG_CATEGORY_CODES as readonly string[]).includes(item.category_code)
        ? item.category_code
        : "other",
    }))
    .slice(0, 60);
}

const PhotoSchema = z.object({
  name_en: z.string().default(""),
  name_km: z.string().default(""),
  unit: z.string().default("unit"),
  category_code: z.string().default("other"),
  description: z.string().default(""),
});

export type IdentifiedProduct = z.infer<typeof PhotoSchema>;

export async function identifyCatalogProduct(imageDataUrl: string): Promise<IdentifiedProduct> {
  const text = await callGateway(
    [
      {
        type: "text",
        text: `Identify the construction material, product or tool in this photo as sold in Cambodian building-supply stores.
Return JSON only: {"name_en":"","name_km":"","unit":"","category_code":"","description":""}
- name_en: short product name including size/weight when visible (e.g. "Portland cement 50kg").
- name_km: the Khmer name.
- unit: bag, piece, sheet, m2, m3, box, roll, set, kg, can, bucket, pair or unit.
- category_code: one of ${CATALOG_CATEGORY_CODES.join(", ")}.
- description: one short sentence about the product and its typical use. No price.`,
      },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    500,
  );
  const parsed = PhotoSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Product could not be recognised");
  const data = parsed.data;
  return {
    name_en: data.name_en.trim().slice(0, 120),
    name_km: data.name_km.trim().slice(0, 120),
    unit: (data.unit || "unit").trim().slice(0, 20),
    category_code: (CATALOG_CATEGORY_CODES as readonly string[]).includes(data.category_code)
      ? data.category_code
      : "other",
    description: data.description.trim().slice(0, 300),
  };
}
