import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  query: z.string().min(1).max(500),
});

interface Interpretation {
  intent: "supplier" | "worker" | "project" | "general";
  keywords: string[];
  summary: string;
}

async function interpretQuery(query: string): Promise<Interpretation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const prompt = `You help users search a Cambodian construction marketplace called BuildHub.
The user query (may be in Khmer or English): "${query}"

Classify the intent and extract 1-5 short search keywords (in both Khmer and English when possible).
Also write a 1-sentence friendly summary in the same language as the query explaining what you're searching for.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              intent: {
                type: "STRING",
                enum: ["supplier", "worker", "project", "general"],
              },
              keywords: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
              summary: { type: "STRING" },
            },
            required: ["intent", "keywords", "summary"],
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini error:", res.status, text);
    throw new Error(`AI service error (${res.status})`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(raw) as Interpretation;
  return {
    intent: parsed.intent ?? "general",
    keywords: (parsed.keywords ?? []).slice(0, 5),
    summary: parsed.summary ?? "",
  };
}

export const aiSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const interp = await interpretQuery(data.query);
      const terms = interp.keywords.length > 0 ? interp.keywords : [data.query];

      const orExpr = (cols: string[]) =>
        terms
          .flatMap((t) =>
            cols.map((c) => `${c}.ilike.%${t.replace(/[%,]/g, "")}%`),
          )
          .join(",");

      const [su, li, pe] = await Promise.all([
        supabaseAdmin
          .from("supplier_stores")
          .select("id, name, description, logo_url, location")
          .eq("status", "approved")
          .or(orExpr(["name", "description", "location"]))
          .limit(10),
        supabaseAdmin
          .from("listings")
          .select("id, title, description, location, budget")
          .eq("status", "approved")
          .or(orExpr(["title", "description", "location"]))
          .limit(10),
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, avatar_url, about_me")
          .or(orExpr(["full_name", "about_me"]))
          .limit(10),
      ]);

      return {
        interpretation: interp,
        suppliers: su.data ?? [],
        listings: li.data ?? [],
        people: pe.data ?? [],
        error: null as string | null,
      };
    } catch (e) {
      console.error("aiSearch failed:", e);
      return {
        interpretation: {
          intent: "general" as const,
          keywords: [] as string[],
          summary: "",
        },
        suppliers: [],
        listings: [],
        people: [],
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  });
