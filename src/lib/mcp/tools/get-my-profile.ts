import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description: "Fetch the signed-in user's BuildHub profile (name, phone, roles, verification status).",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select(
        "id,full_name,phone,about_me,language,is_provider,is_client,is_supplier,is_specialist,is_recruiter,is_verified,member_number,created_at",
      )
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("Profile not found.");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});
