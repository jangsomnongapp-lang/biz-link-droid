import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export const getListingSeo = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("listings")
      .select("id, title, description, location, budget, currency, status, listing_photos(photo_url)")
      .eq("id", data.id)
      .eq("status", "active")
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      budget: (row.budget as number | null) ?? null,
      currency: (row.currency as string) ?? "USD",
      status: (row.status as string) ?? "active",
      photo: (row.listing_photos as { photo_url: string }[] | null)?.[0]?.photo_url ?? null,
    };
  });

export const getSupplierSeo = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("supplier_stores")
      .select("id, name, description, location, logo_url")
      .eq("id", data.id)
      .eq("status", "approved")
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      logo: (row.logo_url as string | null) ?? null,
    };
  });

export const getUserSeo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("profiles")
      .select("id, full_name, about_me, avatar_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id as string,
      name: (row.full_name as string | null) ?? null,
      about: (row.about_me as string | null) ?? null,
      avatar: (row.avatar_url as string | null) ?? null,
    };
  });
