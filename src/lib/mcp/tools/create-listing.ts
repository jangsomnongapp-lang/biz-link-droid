import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_listing",
  title: "Create construction listing",
  description:
    "Create a new BuildHub construction project listing for the signed-in user. New listings start in 'pending' status and are reviewed before going live.",
  inputSchema: {
    title: z.string().trim().min(3).describe("Short project title."),
    description: z.string().trim().optional().describe("Full project description."),
    budget: z.number().nonnegative().optional().describe("Estimated budget amount."),
    currency: z.enum(["USD", "KHR"]).default("USD"),
    location: z.string().trim().optional().describe("Project location (city, district, etc.)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ title, description, budget, currency, location }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("listings")
      .insert({
        user_id: ctx.getUserId(),
        title,
        description: description ?? null,
        budget: budget ?? null,
        currency,
        location: location ?? null,
      })
      .select("id,title,status,created_at")
      .single();
    if (error) return errorResult(error.message);
    return {
      content: [
        { type: "text", text: `Created listing ${data.id} (status: ${data.status}).` },
      ],
      structuredContent: { listing: data },
    };
  },
});
