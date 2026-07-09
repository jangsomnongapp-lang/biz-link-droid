import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

interface BlogCategory {
  slug: string;
  name_en: string;
  name_km: string;
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
  meta_title: string | null;
  meta_description: string | null;
  blog_categories: BlogCategory | null;
}

interface PostListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
  blog_categories: BlogCategory | null;
}

interface BlogCategoryRow {
  id: string;
  slug: string;
  name_en: string;
  name_km: string;
}

export const getBlogPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, content, cover_image_url, published_at, author_name, meta_title, meta_description, blog_categories(slug, name_en, name_km)",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return (post as BlogPost | null) ?? null;
  });

export const listBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ categorySlug: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, cover_image_url, published_at, author_name, blog_categories(slug, name_en, name_km)",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (data.categorySlug) {
      q = q.eq("blog_categories.slug", data.categorySlug);
    }
    const { data: posts } = await q;
    return (posts as PostListItem[] | null) ?? [];
  });

export const listBlogCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: categories } = await supabaseAdmin
    .from("blog_categories")
    .select("id, slug, name_en, name_km")
    .order("sort_order");
  return (categories as BlogCategoryRow[] | null) ?? [];
});

