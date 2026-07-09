import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://buildhubkh.com";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false } },
        );

        const [{ data: posts }, { data: categories }] = await Promise.all([
          supabase
            .from("blog_posts")
            .select("slug, title, excerpt, published_at")
            .eq("status", "published")
            .order("published_at", { ascending: false })
            .limit(50),
          supabase.from("blog_categories").select("slug, name"),
        ]);

        const lines: string[] = [];
        lines.push("# BuildHub Cambodia");
        lines.push("");
        lines.push(
          "> BuildHub is Cambodia's construction marketplace connecting homeowners, contractors, workers, and material suppliers. Find workers, post projects, source materials, and read construction guides in Khmer and English.",
        );
        lines.push("");
        lines.push("## Core pages");
        lines.push(`- [Home](${BASE_URL}/): Overview of BuildHub`);
        lines.push(`- [Find a worker](${BASE_URL}/find-worker): Browse skilled construction workers`);
        lines.push(`- [Find materials](${BASE_URL}/find-material): Request quotes from material suppliers`);
        lines.push(`- [Suppliers](${BASE_URL}/suppliers): Directory of approved supplier stores`);
        lines.push(`- [Search](${BASE_URL}/search): Site-wide search across people, suppliers, projects, posts, and blog`);
        lines.push("");
        lines.push("## Blog");
        lines.push(`- [Blog index](${BASE_URL}/blog): All construction guides and news`);
        if (categories && categories.length > 0) {
          lines.push("");
          lines.push("### Categories");
          for (const c of categories) {
            lines.push(`- [${c.name}](${BASE_URL}/blog/category/${c.slug})`);
          }
        }
        if (posts && posts.length > 0) {
          lines.push("");
          lines.push("### Recent posts");
          for (const p of posts) {
            const desc = p.excerpt ? `: ${p.excerpt}` : "";
            lines.push(`- [${p.title}](${BASE_URL}/blog/${p.slug})${desc}`);
          }
        }
        lines.push("");
        lines.push("## Optional");
        lines.push(`- [Sitemap](${BASE_URL}/sitemap.xml): Full URL list for crawlers`);
        lines.push("");

        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
