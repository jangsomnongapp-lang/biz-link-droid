import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { aiSearch } from "@/lib/ai-search.functions";
import {
  ArrowLeft,
  Sparkles,
  Store,
  ClipboardList,
  MapPin,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/ai-search")({
  component: () => (
    <RequireAuth>
      <AiSearchPage />
    </RequireAuth>
  ),
});

type Result = Awaited<ReturnType<typeof aiSearch>>;
type Rec = Result["recommendations"][number];

function AiSearchPage() {
  const { lang } = useI18n();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const search = useServerFn(aiSearch);

  async function run() {
    const v = q.trim();
    if (!v) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await search({ data: { query: v } });
      setResult(r);
    } catch (e) {
      setResult({
        summary: "",
        recommendations: [],
        error: e instanceof Error ? e.message : "Failed",
      });
    } finally {
      setLoading(false);
    }
  }

  const empty =
    result && !result.error && result.recommendations.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-primary px-3 text-primary-foreground">
        <button
          onClick={() => window.history.back()}
          className="rounded-full p-2 active:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 font-bold">
          <Sparkles className="h-5 w-5" />
          {lang === "km" ? "AI ស្វែងរក" : "AI Search"}
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <p className="mb-3 text-sm text-muted-foreground">
          {lang === "km"
            ? "ពិពណ៌នាអ្វីដែលអ្នកត្រូវការ — AI នឹងណែនាំពីទិន្នន័យក្នុងប្រព័ន្ធ។"
            : "Describe what you need — AI will recommend matches from the database."}
        </p>
        <textarea
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              run();
            }
          }}
          rows={3}
          placeholder={
            lang === "km"
              ? "ឧ. ខ្ញុំត្រូវការជាងអគ្គិសនីនៅភ្នំពេញ..."
              : "e.g. I need an electrician in Phnom Penh..."
          }
          className="w-full rounded-xl border border-border bg-surface p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={run}
          disabled={!q.trim() || loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {lang === "km" ? "កំពុងគិត..." : "Thinking..."}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {lang === "km" ? "ស្វែងរកដោយ AI" : "Search with AI"}
            </>
          )}
        </button>

        {result?.error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {result.error}
          </div>
        )}

        {result && !result.error && (
          <div className="mt-5 space-y-4">
            {result.summary && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3 w-3" />
                  AI
                </div>
                <p className="text-sm text-foreground">{result.summary}</p>
              </div>
            )}

            {empty && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {lang === "km" ? "មិនមានលទ្ធផល" : "No results found"}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {result.recommendations.map((r, i) => (
                <RecCard key={`${r.kind}-${r.id}-${i}`} r={r} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RecCard({ r }: { r: Rec }) {
  if (r.kind === "supplier" && r.supplier) {
    const s = r.supplier;
    return (
      <Link
        to="/suppliers/$storeId"
        params={{ storeId: s.id }}
        className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 active:bg-muted"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {s.logo_url ? (
            <img
              src={s.logo_url}
              alt={s.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Store className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{s.name}</div>
          {s.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{s.location}</span>
            </div>
          )}
          <ReasonChip reason={r.reason} />
        </div>
      </Link>
    );
  }
  if (r.kind === "listing" && r.listing) {
    const l = r.listing;
    return (
      <Link
        to="/listings/$listingId"
        params={{ listingId: l.id }}
        className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 active:bg-muted"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-sm font-semibold">{l.title}</div>
          {l.description && (
            <div className="line-clamp-1 text-xs text-muted-foreground">
              {l.description}
            </div>
          )}
          {l.budget != null && (
            <div className="mt-0.5 text-[11px] font-semibold text-primary">
              ${l.budget}
            </div>
          )}
          <ReasonChip reason={r.reason} />
        </div>
      </Link>
    );
  }
  if (r.kind === "person" && r.person) {
    const p = r.person;
    return (
      <Link
        to="/users/$userId"
        params={{ userId: p.id }}
        className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 active:bg-muted"
      >
        <Avatar name={p.full_name} url={p.avatar_url} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {p.full_name ?? "—"}
          </div>
          {p.about_me && (
            <div className="line-clamp-1 text-xs text-muted-foreground">
              {p.about_me}
            </div>
          )}
          <ReasonChip reason={r.reason} />
        </div>
      </Link>
    );
  }
  return null;
}

function ReasonChip({ reason }: { reason: string }) {
  if (!reason) return null;
  return (
    <div className="mt-1.5 flex items-start gap-1 rounded-md bg-primary/5 px-2 py-1 text-[11px] text-primary">
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="line-clamp-2">{reason}</span>
    </div>
  );
}
