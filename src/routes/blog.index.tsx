import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexPage,
});

interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_km: string;
}

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
  blog_categories: { slug: string; name_en: string; name_km: string } | null;
}

function BlogIndexPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["blog:categories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_categories")
        .select("id, slug, name_en, name_km")
        .order("sort_order");
      return (data as Category[] | null) ?? [];
    },
  });

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["blog:posts", activeCategory],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("blog_posts")
        .select(
          "id, slug, title, excerpt, cover_image_url, published_at, author_name, blog_categories(slug, name_en, name_km)"
        )
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (activeCategory) {
        q = q.eq("blog_categories.slug", activeCategory);
      }
      const { data } = await q;
      return (data as Post[] | null) ?? [];
    },
  });

  return (
    <div className="px-4 py-5">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          BuildHub Blog
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Construction tips, materials guides, cost updates, and safety advice for Cambodia.
        </p>
      </div>

      {/* Category filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge
          variant={activeCategory === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setActiveCategory(null)}
        >
          All
        </Badge>
        {categories.map((c) => (
          <Badge
            key={c.slug}
            variant={activeCategory === c.slug ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setActiveCategory(c.slug)}
          >
            {c.name_en}
          </Badge>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No articles yet. Check back soon.
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className="block"
          >
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              {post.cover_image_url && (
                <div className="aspect-[16/9] w-full overflow-hidden">
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  {post.blog_categories && (
                    <Badge variant="secondary" className="text-xs">
                      {post.blog_categories.name_en}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {post.published_at ? format(new Date(post.published_at), "d MMM yyyy") : "Draft"}
                  </span>
                </div>
                <h2 className="text-lg font-bold leading-tight text-foreground">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
