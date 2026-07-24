import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface PublicPostDetail {
  id: string;
  user_id: string;
  content: string | null;
  title: string | null;
  price: number | null;
  discount_price: number | null;
  currency: string;
  post_type: string;
  created_at: string;
  view_count: number;
  post_photos: Array<{ photo_url: string }>;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  store: { id: string; name: string; logo_url: string | null } | null;
}

export const getPublicPost = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }): Promise<PublicPostDetail | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select(
        "id, user_id, content, title, price, discount_price, currency, post_type, created_at, view_count, post_photos(photo_url), profiles(full_name, avatar_url)",
      )
      .eq("id", data.id)
      .eq("status", "approved")
      .maybeSingle();
    if (!post) return null;
    const { data: store } = await supabaseAdmin
      .from("supplier_stores")
      .select("id, name, logo_url")
      .eq("user_id", (post as { user_id: string }).user_id)
      .eq("status", "approved")
      .maybeSingle();
    return { ...(post as Omit<PublicPostDetail, "store">), store: store ?? null };
  });
