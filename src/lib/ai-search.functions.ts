import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  query: z.string().min(1).max(500),
});

type Kind = "supplier" | "listing" | "person";

interface Candidate {
  id: string;
  kind: Kind;
  title: string;
  desc: string;
  location: string | null;
}

interface SupplierRow {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  location: string | null;
}
interface ListingRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  budget: number | null;
}
interface PersonRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  about_me: string | null;
}

interface Recommendation {
  id: string;
  kind: Kind;
  reason: string;
}

interface AIResult {
  summary: string;
  recommendations: Recommendation[];
}

function tokenize(q: string): string[] {
  return Array.from(
    new Set(
      q
        .toLowerCase()
        .split(/[\s,.\-/()\[\]"']+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .slice(0, 6),
    ),
  );
}

async function fetchCandidates(query: string): Promise<{
  suppliers: SupplierRow[];
  listings: ListingRow[];
  people: PersonRow[];
}> {
  const tokens = tokenize(query);

  const orExpr = (cols: string[]) =>
    tokens.length === 0
      ? null
      : tokens
          .flatMap((t) =>
            cols.map((c) => `${c}.ilike.%${t.replace(/[%,]/g, "")}%`),
          )
          .join(",");

  const supOr = orExpr(["name", "description", "location"]);
  const liOr = orExpr(["title", "description", "location"]);
  const peOr = orExpr(["full_name", "about_me"]);

  // Run keyword search; if no tokens, fall back to recent items.
  const suQ = supabaseAdmin
    .from("supplier_stores")
    .select("id, name, description, logo_url, location")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(25);
  if (supOr) suQ.or(supOr);

  const liQ = supabaseAdmin
    .from("listings")
    .select("id, title, description, location, budget")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(25);
  if (liOr) liQ.or(liOr);

  const peQ = supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url, about_me")
    .order("created_at", { ascending: false })
    .limit(25);
  if (peOr) peQ.or(peOr);

  const [su, li, pe] = await Promise.all([suQ, liQ, peQ]);
  return {
    suppliers: (su.data ?? []) as SupplierRow[],
    listings: (li.data ?? []) as ListingRow[],
    people: (pe.data ?? []) as PersonRow[],
  };
}

function truncate(s: string | null | undefined, n: number): string {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v.length > n ? v.slice(0, n) + "…" : v;
}

async function geminiCall(
  apiKey: string,
  body: unknown,
  attempt = 0,
): Promise<unknown> {
  const models = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];
  const model = models[Math.min(attempt, models.length - 1)];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (res.status === 429 || res.status === 503) {
    if (attempt >= 2) {
      throw new Error(
        "AI is busy right now. Please try again in a minute.",
      );
    }
    const delay = 500 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, delay));
    return geminiCall(apiKey, body, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini error:", res.status, text);
    throw new Error(`AI service error (${res.status})`);
  }
  return res.json();
}

async function askGemini(
  query: string,
  candidates: Candidate[],
): Promise<AIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const lines = candidates.map(
    (c) =>
      `${c.kind}|${c.id}|${c.title}${c.location ? ` (${c.location})` : ""}${c.desc ? ` — ${c.desc}` : ""}`,
  );

  const prompt = `You are BuildHub's AI assistant. BuildHub is a Cambodian construction marketplace.
User asked (Khmer or English): "${query}"

Below is a list of candidates from the database. Each line: kind|id|title (location) — description.
Pick the 3-8 best matches that genuinely fit the user's need. Use the EXACT id from the list.
Reply in the SAME language as the user's query.
Write a 1-2 sentence friendly summary, then for each recommendation a short reason (max 15 words).

Candidates:
${lines.join("\n")}`;

  const data = (await geminiCall(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          recommendations: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                kind: {
                  type: "STRING",
                  enum: ["supplier", "listing", "person"],
                },
                id: { type: "STRING" },
                reason: { type: "STRING" },
              },
              required: ["kind", "id", "reason"],
            },
          },
        },
        required: ["summary", "recommendations"],
      },
    },
  })) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(raw) as AIResult;
  return {
    summary: parsed.summary ?? "",
    recommendations: (parsed.recommendations ?? []).slice(0, 8),
  };
}

export const aiSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { suppliers, listings, people } = await fetchCandidates(data.query);

      const candidates: Candidate[] = [
        ...suppliers.map<Candidate>((s) => ({
          id: s.id,
          kind: "supplier",
          title: s.name,
          desc: truncate(s.description, 120),
          location: s.location,
        })),
        ...listings.map<Candidate>((l) => ({
          id: l.id,
          kind: "listing",
          title: l.title,
          desc: truncate(l.description, 120),
          location: l.location,
        })),
        ...people.map<Candidate>((p) => ({
          id: p.id,
          kind: "person",
          title: p.full_name ?? "—",
          desc: truncate(p.about_me, 120),
          location: null,
        })),
      ];

      if (candidates.length === 0) {
        return {
          summary: "",
          recommendations: [] as Array<
            Recommendation & {
              supplier?: SupplierRow;
              listing?: ListingRow;
              person?: PersonRow;
            }
          >,
          error: null as string | null,
        };
      }

      const ai = await askGemini(data.query, candidates);

      const supMap = new Map(suppliers.map((s) => [s.id, s]));
      const liMap = new Map(listings.map((l) => [l.id, l]));
      const peMap = new Map(people.map((p) => [p.id, p]));

      const enriched = ai.recommendations
        .map((r) => {
          if (r.kind === "supplier" && supMap.has(r.id)) {
            return { ...r, supplier: supMap.get(r.id)! };
          }
          if (r.kind === "listing" && liMap.has(r.id)) {
            return { ...r, listing: liMap.get(r.id)! };
          }
          if (r.kind === "person" && peMap.has(r.id)) {
            return { ...r, person: peMap.get(r.id)! };
          }
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return {
        summary: ai.summary,
        recommendations: enriched,
        error: null as string | null,
      };
    } catch (e) {
      console.error("aiSearch failed:", e);
      return {
        summary: "",
        recommendations: [] as Array<
          Recommendation & {
            supplier?: SupplierRow;
            listing?: ListingRow;
            person?: PersonRow;
          }
        >,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  });
