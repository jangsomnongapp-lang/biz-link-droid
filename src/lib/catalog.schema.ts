import { z } from "zod";

export const CatalogImportInputSchema = z.object({
  storeId: z.string().uuid(),
  imageDataUrl: z.string().max(7_500_000).optional(),
  fileDataUrl: z.string().max(7_500_000).optional(),
  fileName: z.string().max(200).optional(),
  text: z.string().max(20_000).optional(),
});

export const CatalogPhotoInputSchema = z.object({
  storeId: z.string().uuid(),
  imageDataUrl: z.string().min(20).max(7_500_000),
});

export const ParsedCatalogItemSchema = z.object({
  name_en: z.string().default(""),
  name_km: z.string().default(""),
  unit: z.string().default("unit"),
  price: z.number().nullable().default(null),
  currency: z.enum(["USD", "KHR"]).default("USD"),
  category_code: z.string().default(""),
});

export type ParsedCatalogItem = z.infer<typeof ParsedCatalogItemSchema>;

export const CATALOG_CATEGORY_CODES = [
  "cement",
  "steel",
  "bricks",
  "tiles",
  "paint",
  "plumbing",
  "electrical",
  "roofing",
  "wood",
  "glass_aluminum",
  "doors_windows",
  "sanitary",
  "hardware",
  "machinery",
  "furniture",
  "other",
] as const;
