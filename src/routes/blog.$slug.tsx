import { Link, createFileRoute } from "@tanstack/react-router";
import { getBlogPostBySlug } from "@/lib/blog.functions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    return await getBlogPostBySlug({ slug: params.slug });
  },
  head: ({ loaderData }) => {
    const title =
      loaderData?.meta_title ?? loaderData?.title ?? "Article — BuildHub Blog";
    const description =
      loaderData?.meta_description ??
      loaderData?.excerpt ??
      "Read the latest construction guide on BuildHub.";
    const url = `https://buildhubkh.com/blog/${loaderData?.slug ?? ""}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: loaderData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: loaderData.title,
                description: loaderData.excerpt ?? description,
                url,
                inLanguage: "en",
                about: loaderData.blog_categories?.name_en ?? "Construction",
                author: {
                  "@type": "Organization",
                  name: loaderData.author_name ?? "BuildHub",
                },
                publisher: {
                  "@type": "Organization",
                  name: "BuildHub",
                  url: "https://buildhubkh.com/",
                },
                datePublished: loaderData.published_at ?? undefined,
                mainEntityOfPage: url,
              }),
            },
          ]
        : undefined,
    };
  },
  pendingComponent: () => (
    <div className="px-4 py-5">
      <Skeleton className="mb-4 h-8 w-3/4" />
      <Skeleton className="mb-2 h-4 w-1/2" />
      <Skeleton className="mb-4 h-48 w-full rounded-xl" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  ),
  component: BlogPostPage,
});

interface PostDetail {
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
  blog_categories: { slug: string; name_en: string; name_km: string } | null;
}

function BlogPostPage() {
  const post = Route.useLoaderData() as PostDetail | null;

  if (!post) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-foreground">Article not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The article you’re looking for may have been removed or is not yet published.
        </p>
        <Link
          to="/blog"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <article className="px-4 py-5">
      <Link
        to="/blog"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to blog
      </Link>

      {post.blog_categories && (
        <Badge variant="secondary" className="mb-3">
          {post.blog_categories.name_en}
        </Badge>
      )}

      <h1 className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-foreground">
        {post.title}
      </h1>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {post.author_name && <span>{post.author_name}</span>}
        {post.published_at && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(post.published_at), "d MMMM yyyy")}
          </span>
        )}
      </div>

      {post.cover_image_url && (
        <div className="mb-6 aspect-[16/9] w-full overflow-hidden rounded-xl">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="h-full w-full object-cover"
            loading="eager"
          />
        </div>
      )}

      {post.excerpt && (
        <p className="mb-6 text-base leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
      )}

      <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-bold prose-a:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Get help with your project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find workers, suppliers, and project support on BuildHub.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/find-worker"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
          >
            Find a worker
          </Link>
          <Link
            to="/find-material"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground active:scale-[0.98]"
          >
            Find materials
          </Link>
        </div>
      </div>
    </article>
  );
}

