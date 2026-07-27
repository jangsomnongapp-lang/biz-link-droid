import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://buildhubkh.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/home", changefreq: "weekly", priority: "0.8" },
          { path: "/llms.txt", changefreq: "monthly", priority: "0.5" },
          { path: "/login", changefreq: "yearly", priority: "0.3" },
          { path: "/mcp", changefreq: "yearly", priority: "0.1" },
          { path: "/my-posts", changefreq: "yearly", priority: "0.3" },
          { path: "/online-orders", changefreq: "yearly", priority: "0.3" },
          { path: "/listings", changefreq: "daily", priority: "0.9" },
          { path: "/suppliers", changefreq: "daily", priority: "0.9" },
          { path: "/find-worker", changefreq: "weekly", priority: "0.8" },
          { path: "/find-material", changefreq: "weekly", priority: "0.8" },
          { path: "/ai-search", changefreq: "weekly", priority: "0.7" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/alerts", changefreq: "daily", priority: "0.6" },
          { path: "/announce", changefreq: "weekly", priority: "0.5" },
          { path: "/guides/architects", changefreq: "monthly", priority: "0.7" },
          { path: "/help", changefreq: "monthly", priority: "0.6" },
          { path: "/connect", changefreq: "monthly", priority: "0.5" },
          { path: "/forgot-password", changefreq: "yearly", priority: "0.3" },
          { path: "/invitations", changefreq: "monthly", priority: "0.4" },
          { path: "/join", changefreq: "monthly", priority: "0.4" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/profile", changefreq: "monthly", priority: "0.4" },
          { path: "/register", changefreq: "yearly", priority: "0.4" },
          { path: "/report", changefreq: "yearly", priority: "0.3" },
          { path: "/rewards", changefreq: "weekly", priority: "0.5" },
          { path: "/search", changefreq: "weekly", priority: "0.6" },
          { path: "/settings", changefreq: "monthly", priority: "0.3" },
        ];




        const { data: posts } = await supabaseAdmin
          .from("blog_posts")
          .select("slug, updated_at")
          .eq("status", "published")
          .order("published_at", { ascending: false });

        for (const post of posts ?? []) {
          if (!post.slug) continue;
          entries.push({
            path: `/blog/${post.slug}`,
            changefreq: "monthly",
            priority: "0.7",
            lastmod: post.updated_at
              ? new Date(post.updated_at).toISOString().split("T")[0]
              : undefined,
          });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
