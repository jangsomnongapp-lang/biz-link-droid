import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/ai-search")({
  component: () => (
    <RequireAuth>
      <AiSearchPage />
    </RequireAuth>
  ),
});

function AiSearchPage() {
  const { lang } = useI18n();
  const [q, setQ] = useState("");

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

      <main className="flex-1 px-4 py-6">
        <p className="mb-3 text-sm text-muted-foreground">
          {lang === "km"
            ? "ពិពណ៌នាអ្វីដែលអ្នកត្រូវការ — AI នឹងជួយស្វែងរក។"
            : "Describe what you need — AI will help you find it."}
        </p>
        <textarea
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={4}
          placeholder={
            lang === "km"
              ? "ឧ. ខ្ញុំត្រូវការជាងអគ្គិសនីនៅភ្នំពេញ..."
              : "e.g. I need an electrician in Phnom Penh..."
          }
          className="w-full rounded-xl border border-border bg-surface p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          disabled={!q.trim()}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {lang === "km" ? "ស្វែងរក" : "Search"}
        </button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {lang === "km" ? "នឹងមកដល់ឆាប់ៗ" : "Coming soon"}
        </p>
      </main>
    </div>
  );
}
