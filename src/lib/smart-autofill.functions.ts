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
  .handler(async ({ data, context }) => {
    if (!data.valid || !data.imageDataUrl) {
      return { product: "", matchedPostIds: [], error: "invalid-image" as const };
    }
    try {
      const { data: stores, error: storesError } = await context.supabase
        .from("supplier_stores")
        .select("user_id")
        .eq("status", "approved");
      if (storesError) throw storesError;
      const supplierIds = (stores ?? []).map((store) => store.user_id);
      if (!supplierIds.length) return { product: "", matchedPostIds: [], error: null };

      const { data: posts, error: postsError } = await context.supabase
        .from("posts")
        .select("id, title, content, post_photos(photo_url)")
        .eq("status", "approved")
        .in("post_type", ["novedad", "stock", "oferta", "liquidacion"])
        .in("user_id", supplierIds)
        .order("created_at", { ascending: false })
        .limit(30);
      if (postsError) throw postsError;
      const candidates = (posts ?? [])
        .map((post) => ({
          id: post.id,
          title: post.title ?? "",
          content: post.content ?? "",
          photoUrl: post.post_photos?.[0]?.photo_url ?? "",
        }))
        .filter((post) => post.photoUrl)
        .slice(0, 20);
      const { identifyConstructionProduct, matchConstructionProductPhotos } = await import(
        "@/lib/smart-autofill.server"
      );
      const matchedPostIds = await matchConstructionProductPhotos(data.imageDataUrl, candidates);
      const product = matchedPostIds.length
        ? ""
        : await identifyConstructionProduct(data.imageDataUrl).catch(() => "");
      return {
        product,
        matchedPostIds,
        error: matchedPostIds.length || product ? null : ("not-recognized" as const),
      };
    } catch (error) {
      console.error("Picture recognition failed", error);
      return {
        product: "",
        matchedPostIds: [],
        error: "recognition-unavailable" as const,
      };
    }
  });
