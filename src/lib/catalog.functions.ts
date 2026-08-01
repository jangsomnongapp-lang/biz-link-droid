import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CatalogImportInputSchema, CatalogPhotoInputSchema } from "@/lib/catalog.schema";

async function assertStoreOwner(
  supabase: { from: (table: string) => any },
  storeId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("supplier_stores")
    .select("id,user_id")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new Error("Not allowed");
}

export const importCatalogPriceList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CatalogImportInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreOwner(context.supabase, data.storeId, context.userId);
    try {
      const { parsePriceList } = await import("@/lib/catalog.server");
      const items = await parsePriceList(data);
      return { items, error: items.length ? null : ("no-items" as const) };
    } catch (error) {
      console.error("Catalogue import failed", error);
      return { items: [], error: "import-failed" as const };
    }
  });

export const recognizeCatalogProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CatalogPhotoInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreOwner(context.supabase, data.storeId, context.userId);
    try {
      const { identifyCatalogProduct } = await import("@/lib/catalog.server");
      return { product: await identifyCatalogProduct(data.imageDataUrl), error: null };
    } catch (error) {
      console.error("Catalogue photo recognition failed", error);
      return { product: null, error: "not-recognized" as const };
    }
  });
