import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseAnon, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_listings",
  title: "Search construction listings",
  description:
    "Search active BuildHub construction project listings. Optionally filter by keyword (matches title/description/location) and limit results.",
  inputSchema: {
    query: z.string().trim().optional().describe("Keyword to match in title, description, or location."),
    location: z.string().trim().optional().describe("Filter listings by location substring."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum results to return (1-50)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ query, location, limit }, ctx) => {
    const supabase = ctx.isAuthenticated() ? supabaseForUser(ctx) : supabaseAnon();
    let q = supabase
      .from("listings")
      .select("id,title,description,budget,currency,location,status,created_at,user_id")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`);
    if (location) q = q.ilike("location", `%${location}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { listings: data ?? [] },
    };
  },
});
