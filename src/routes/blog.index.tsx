import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Calendar, Search, ArrowRight, BookOpen, User } from "lucide-react";
import { useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");

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
          "id, slug, title, excerpt, cover_image_url, published_at, author_name, blog_categories(slug, name_en, name_km)",
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.excerpt ?? "").toLowerCase().includes(q),
    );
  }, [posts, search]);

  const activeCategoryName =
    categories.find((c) => c.slug === activeCategory)?.name_en ?? null;

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Hero header */}
      <header className="mb-6 md:mb-10">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <BookOpen className="h-3.5 w-3.5" />
          BuildHub Insights
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          {activeCategoryName
            ? `${activeCategoryName} — BuildHub Blog`
            : "Construction Tips, Materials & Market News for Cambodia"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Practical, on-the-ground guides for building, renovating, and sourcing
          materials in Phnom Penh and across Cambodia — written for owners,
          contractors, and suppliers.
        </p>
      </header>

      {/* Search */}
      <div className="mb-5 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles…"
          className="pl-9 h-11"
          aria-label="Search articles"
        />
      </div>

      {/* Category filter */}
      <nav
        aria-label="Blog categories"
        className="mb-8 flex flex-wrap gap-2 border-b border-border pb-5"
      >
        <Badge
          variant={activeCategory === null ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-sm"
          onClick={() => setActiveCategory(null)}
        >
          All ({posts.length})
        </Badge>
        {categories.map((c) => (
          <Badge
            key={c.slug}
            variant={activeCategory === c.slug ? "default" : "outline"}
            className="cursor-pointer px-3 py-1.5 text-sm"
            onClick={() => setActiveCategory(c.slug)}
          >
            {c.name_en}
          </Badge>
        ))}
      </nav>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-72 w-full rounded-xl md:col-span-2 lg:col-span-3" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search
              ? `No articles match "${search}".`
              : "No articles in this category yet. Check back soon."}
          </p>
        </div>
      )}

      {!isLoading && featured && (
        <>
          {/* Featured hero post */}
          <section aria-label="Featured article" className="mb-10">
            <Link
              to="/blog/$slug"
              params={{ slug: featured.slug }}
              className="group block"
            >
              <Card className="overflow-hidden border-border transition-all hover:shadow-xl md:grid md:grid-cols-2">
                {featured.cover_image_url && (
                  <div className="aspect-[16/9] w-full overflow-hidden md:aspect-auto md:h-full">
                    <img
                      src={featured.cover_image_url}
                      alt={featured.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="eager"
                    />
                  </div>
                )}
                <CardContent className="flex flex-col justify-center p-6 md:p-8">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground">
                      Featured
                    </Badge>
                    {featured.blog_categories && (
                      <Badge variant="secondary" className="text-xs">
                        {featured.blog_categories.name_en}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-foreground md:text-3xl">
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground md:text-base">
                      {featured.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    {featured.author_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {featured.author_name}
                      </span>
                    )}
                    {featured.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(featured.published_at), "d MMM yyyy")}
                      </span>
                    )}
                  </div>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Read article
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          </section>

          {rest.length > 0 && (
            <section aria-label="Latest articles">
              <h2 className="mb-4 text-lg font-bold text-foreground">
                Latest articles
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <Link
                    key={post.id}
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="group block h-full"
                  >
                    <Card className="flex h-full flex-col overflow-hidden border-border transition-all hover:-translate-y-1 hover:shadow-lg">
                      {post.cover_image_url && (
                        <div className="aspect-[16/9] w-full overflow-hidden">
                          <img
                            src={post.cover_image_url}
                            alt={post.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <CardContent className="flex flex-1 flex-col p-4">
                        <div className="mb-2 flex items-center gap-2">
                          {post.blog_categories && (
                            <Badge variant="secondary" className="text-xs">
                              {post.blog_categories.name_en}
                            </Badge>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {post.published_at
                              ? format(new Date(post.published_at), "d MMM yyyy")
                              : "Draft"}
                          </span>
                        </div>
                        <h3 className="text-base font-bold leading-snug text-foreground group-hover:text-primary">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                            {post.excerpt}
                          </p>
                        )}
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          Read more
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
