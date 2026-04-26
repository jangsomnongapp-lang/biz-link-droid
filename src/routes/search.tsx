import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Search as SearchIcon, Clock, X, HardHat, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/search")({
  component: () => (
    <RequireAuth>
      <SearchPage />
    </RequireAuth>
  ),
});

const POPULAR = [
  { en: "Electrician", km: "ជាងអគ្គិសនី", icon: "⚡" },
  { en: "Bricklayer", km: "ជាងឥដ្ឋ", icon: "🧱" },
  { en: "Carpenter", km: "ជាងឈើ", icon: "🪚" },
  { en: "Painter", km: "ជាងលាប", icon: "🎨" },
  { en: "Plumber", km: "ជាងបំពង់ទឹក", icon: "🔧" },
  { en: "Welder", km: "ជាងផ្សារ", icon: "🪛" },
  { en: "Roofer", km: "ជាងដំបូល", icon: "🏠" },
  { en: "AC & Ventilation", km: "ម៉ាស៊ីនត្រជាក់", icon: "❄️" },
];

function SearchPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("recent_searches");
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  function saveRecent(term: string) {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 8);
    setRecent(next);
    localStorage.setItem("recent_searches", JSON.stringify(next));
  }

  function removeRecent(term: string) {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    localStorage.setItem("recent_searches", JSON.stringify(next));
  }

  function submit(term: string) {
    const v = term.trim();
    if (!v) return;
    saveRecent(v);
    void navigate({ to: "/listings" });
  }

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
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(q);
            }}
            placeholder={lang === "km" ? "ស្វែងរកអ្នកធ្វើការ ការងារ..." : "Search workers, projects..."}
            className="h-10 w-full rounded-pill bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </header>

      <main className="flex-1">
        {recent.length > 0 && (
          <section className="bg-surface px-4 py-3">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {lang === "km" ? "ស្វែងរកថ្មីៗ" : "Recent searches"}
            </h2>
            <ul className="divide-y divide-border">
              {recent.map((term) => (
                <li key={term} className="flex items-center gap-3 py-2.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <button
                    onClick={() => submit(term)}
                    className="flex-1 text-left text-sm text-foreground"
                  >
                    {term}
                  </button>
                  <button
                    onClick={() => removeRecent(term)}
                    className="rounded-full p-1 text-muted-foreground active:bg-muted"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-2 bg-surface px-4 py-3">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {lang === "km" ? "ជំនាញពេញនិយម" : "Popular specialties"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {POPULAR.map((p) => (
              <button
                key={p.en}
                onClick={() => submit(lang === "km" ? p.km : p.en)}
                className="flex items-center gap-1.5 rounded-pill bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary active:scale-95"
              >
                <span>{p.icon}</span>
                <span>{lang === "km" ? p.km : p.en}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-2 bg-surface px-4 py-3">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {lang === "km" ? "រកមើលតាមប្រភេទ" : "Browse by type"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/home"
              className="flex flex-col items-center gap-1.5 rounded-xl bg-primary p-5 text-primary-foreground active:scale-[0.98]"
            >
              <HardHat className="h-8 w-8" />
              <span className="text-sm font-semibold">
                {lang === "km" ? "កម្មករ" : "Workers"}
              </span>
              <span className="text-[11px] opacity-80">
                {lang === "km" ? "រកអ្នកជំនាញ" : "Find skilled workers"}
              </span>
            </Link>
            <Link
              to="/listings"
              className="flex flex-col items-center gap-1.5 rounded-xl bg-primary p-5 text-primary-foreground active:scale-[0.98]"
            >
              <ClipboardList className="h-8 w-8" />
              <span className="text-sm font-semibold">
                {lang === "km" ? "ការងារ" : "Projects"}
              </span>
              <span className="text-[11px] opacity-80">
                {lang === "km" ? "រកការងារ" : "Find available work"}
              </span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
