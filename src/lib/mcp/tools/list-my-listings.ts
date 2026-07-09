import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_my_listings",
  title: "List my listings",
  description: "List construction project listings owned by the signed-in user, including pending and closed ones.",
  inputSchema: {
    status: z
      .enum(["pending", "active", "rejected", "closed", "finished"])
      .optional()
      .describe("Filter by listing status."),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("listings")
      .select("id,title,description,budget,currency,location,status,created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { listings: data ?? [] },
    };
  },
});
