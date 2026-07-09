import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseAnon, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_listing",
  title: "Get listing details",
  description: "Fetch full details for a single BuildHub construction listing by id.",
  inputSchema: {
    listing_id: z.string().uuid().describe("Listing UUID."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ listing_id }, ctx) => {
    const supabase = ctx.isAuthenticated() ? supabaseForUser(ctx) : supabaseAnon();
    const { data, error } = await supabase
      .from("listings")
      .select("id,title,description,budget,currency,location,status,created_at,updated_at,user_id")
      .eq("id", listing_id)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("Listing not found.");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { listing: data },
    };
  },
});
