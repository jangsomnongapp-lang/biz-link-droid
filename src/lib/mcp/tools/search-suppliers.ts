import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseAnon, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_suppliers",
  title: "Search suppliers",
  description: "Search BuildHub construction material and equipment supplier stores.",
  inputSchema: {
    query: z.string().trim().optional().describe("Keyword to match in store name, description, or location."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const supabase = ctx.isAuthenticated() ? supabaseForUser(ctx) : supabaseAnon();
    let q = supabase
      .from("supplier_stores")
      .select("id,name,description,location,phone,status,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (query) q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { suppliers: data ?? [] },
    };
  },
});
