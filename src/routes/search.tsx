import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Search as SearchIcon,
  Clock,
  X,
  Store,
  ClipboardList,
  FileText,
  Users,
  LayoutGrid,
  MapPin,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/search")({
  component: () => (
    <RequireAuth>
      <SearchPage />
    </RequireAuth>
  ),
});

type Tab = "all" | "people" | "suppliers" | "projects" | "posts";

interface PersonRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  about_me: string | null;
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
interface PostRow {
  id: string;
  content: string | null;
  user_id: string;
  created_at: string;
  author?: PersonRow | null;
}

function SearchPage() {
  const { lang } = useI18n();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [people, setPeople] = useState<PersonRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);

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
    setQ(v);
    setSubmitted(v);
    saveRecent(v);
  }

  useEffect(() => {
    if (!submitted) return;
    let cancelled = false;
    setLoading(true);
    const needle = `%${submitted}%`;
    (async () => {
      const [pe, su, li, po] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, about_me")
          .or(`full_name.ilike.${needle},about_me.ilike.${needle}`)
          .limit(20),
        supabase
          .from("supplier_stores")
          .select("id, name, description, logo_url, location")
          .eq("status", "approved")
          .or(`name.ilike.${needle},description.ilike.${needle},location.ilike.${needle}`)
          .limit(20),
        supabase
          .from("listings")
          .select("id, title, description, location, budget")
          .eq("status", "approved")
          .or(`title.ilike.${needle},description.ilike.${needle},location.ilike.${needle}`)
          .limit(20),
        supabase
          .from("posts")
          .select("id, content, user_id, created_at")
          .eq("status", "approved")
          .ilike("content", needle)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      setPeople((pe.data ?? []) as PersonRow[]);
      setSuppliers((su.data ?? []) as SupplierRow[]);
      setListings((li.data ?? []) as ListingRow[]);

      const postRows = (po.data ?? []) as PostRow[];
      if (postRows.length > 0) {
        const ids = Array.from(new Set(postRows.map((p) => p.user_id)));
        const { data: authors } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, about_me")
          .in("id", ids);
        const map = new Map((authors ?? []).map((a) => [a.id, a as PersonRow]));
        setPosts(postRows.map((p) => ({ ...p, author: map.get(p.user_id) ?? null })));
      } else {
        setPosts([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [submitted]);

  const tabs: { id: Tab; en: string; km: string; icon: typeof Users }[] = [
    { id: "all", en: "All", km: "ទាំងអស់", icon: LayoutGrid },
    { id: "people", en: "People", km: "មនុស្ស", icon: Users },
    { id: "suppliers", en: "Suppliers", km: "ហាង", icon: Store },
    { id: "projects", en: "Projects", km: "ការងារ", icon: ClipboardList },
    { id: "posts", en: "Posts", km: "ប្រកាស", icon: FileText },
  ];

  const totalCount =
    people.length + suppliers.length + listings.length + posts.length;

  const showEmpty = useMemo(() => {
    if (!submitted || loading) return false;
    if (tab === "all") return totalCount === 0;
    if (tab === "people") return people.length === 0;
    if (tab === "suppliers") return suppliers.length === 0;
    if (tab === "projects") return listings.length === 0;
    if (tab === "posts") return posts.length === 0;
    return false;
  }, [submitted, loading, tab, totalCount, people, suppliers, listings, posts]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 bg-primary px-3 pb-0 pt-3 text-primary-foreground">
        <div className="flex h-10 items-center gap-2">
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
              placeholder={lang === "km" ? "ស្វែងរក..." : "Search..."}
              className="h-10 w-full rounded-pill bg-white pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {q && (
              <button
                onClick={() => {
                  setQ("");
                  setSubmitted("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground active:bg-muted"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <Link
          to="/ai-search"
          className="group relative mt-3 flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-white shadow-[0_8px_24px_-8px_rgba(236,72,153,0.55)] ring-1 ring-white/15 transition-transform active:scale-[0.98]"
          style={{
            background:
              "linear-gradient(110deg, #6366f1 0%, #a855f7 35%, #ec4899 70%, #f59e0b 100%)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -left-12 top-0 h-full w-16 -skew-x-12 bg-white/25 blur-md opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.25), transparent 50%), radial-gradient(80% 60% at 100% 100%, rgba(255,255,255,0.12), transparent 60%)",
            }}
          />
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold leading-tight tracking-tight">
                {lang === "km" ? "សាកល្បង AI ស្វែងរក" : "Try AI search"}
              </span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-white/30">
                New
              </span>
            </div>
            <div className="truncate text-[11px] leading-tight text-white/85">
              {lang === "km"
                ? "ពិពណ៌នាអ្វីដែលអ្នកត្រូវការតាមពាក្យរបស់អ្នក"
                : "Describe what you need in your own words"}
            </div>
          </div>
          <ChevronRight className="relative h-4 w-4 shrink-0 opacity-90 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {submitted && (
          <div className="-mx-3 mt-2 overflow-x-auto">
            <div className="flex gap-1 px-3">
              {tabs.map((tb) => {
                const active = tab === tb.id;
                return (
                  <button
                    key={tb.id}
                    onClick={() => setTab(tb.id)}
                    className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-background text-primary"
                        : "text-white/80 active:bg-white/10"
                    }`}
                  >
                    {lang === "km" ? tb.km : tb.en}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {!submitted ? (
          <DiscoverView
            recent={recent}
            onSubmit={submit}
            onRemoveRecent={removeRecent}
            lang={lang}
          />
        ) : loading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {lang === "km" ? "កំពុងស្វែងរក..." : "Searching..."}
          </div>
        ) : showEmpty ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            {lang === "km"
              ? `មិនមានលទ្ធផលសម្រាប់ "${submitted}"`
              : `No results for "${submitted}"`}
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-2">
            {(tab === "all" || tab === "people") && people.length > 0 && (
              <Section
                title={lang === "km" ? "មនុស្ស" : "People"}
                count={people.length}
                showAll={tab === "all" && people.length > 3}
                onShowAll={() => setTab("people")}
                lang={lang}
              >
                {(tab === "all" ? people.slice(0, 3) : people).map((p) => (
                  <PersonItem key={p.id} p={p} />
                ))}
              </Section>
            )}

            {(tab === "all" || tab === "suppliers") && suppliers.length > 0 && (
              <Section
                title={lang === "km" ? "ហាង" : "Suppliers"}
                count={suppliers.length}
                showAll={tab === "all" && suppliers.length > 3}
                onShowAll={() => setTab("suppliers")}
                lang={lang}
              >
                {(tab === "all" ? suppliers.slice(0, 3) : suppliers).map((s) => (
                  <SupplierItem key={s.id} s={s} />
                ))}
              </Section>
            )}

            {(tab === "all" || tab === "projects") && listings.length > 0 && (
              <Section
                title={lang === "km" ? "ការងារ" : "Projects"}
                count={listings.length}
                showAll={tab === "all" && listings.length > 3}
                onShowAll={() => setTab("projects")}
                lang={lang}
              >
                {(tab === "all" ? listings.slice(0, 3) : listings).map((l) => (
                  <ListingItem key={l.id} l={l} lang={lang} />
                ))}
              </Section>
            )}

            {(tab === "all" || tab === "posts") && posts.length > 0 && (
              <Section
                title={lang === "km" ? "ប្រកាស" : "Posts"}
                count={posts.length}
                showAll={tab === "all" && posts.length > 3}
                onShowAll={() => setTab("posts")}
                lang={lang}
              >
                {(tab === "all" ? posts.slice(0, 3) : posts).map((p) => (
                  <PostItem key={p.id} p={p} term={submitted} />
                ))}
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  count,
  children,
  showAll,
  onShowAll,
  lang,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  showAll: boolean;
  onShowAll: () => void;
  lang: "km" | "en";
}) {
  return (
    <section className="bg-surface">
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-sm font-bold text-foreground">
          {title} <span className="text-muted-foreground">({count})</span>
        </h2>
        {showAll && (
          <button
            onClick={onShowAll}
            className="text-xs font-semibold text-primary active:opacity-70"
          >
            {lang === "km" ? "មើលទាំងអស់" : "See all"}
          </button>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function PersonItem({ p }: { p: PersonRow }) {
  return (
    <Link
      to="/users/$userId"
      params={{ userId: p.id }}
      className="flex items-center gap-3 px-4 py-3 active:bg-muted"
    >
      <Avatar name={p.full_name} url={p.avatar_url} size={48} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {p.full_name ?? "—"}
        </div>
        {p.about_me && (
          <div className="line-clamp-1 text-xs text-muted-foreground">
            {p.about_me}
          </div>
        )}
      </div>
    </Link>
  );
}

function SupplierItem({ s }: { s: SupplierRow }) {
  return (
    <Link
      to="/suppliers/$storeId"
      params={{ storeId: s.id }}
      className="flex items-center gap-3 px-4 py-3 active:bg-muted"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
        {s.logo_url ? (
          <img src={s.logo_url} alt={s.name} className="h-full w-full object-cover" />
        ) : (
          <Store className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{s.name}</div>
        {s.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{s.location}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function ListingItem({ l, lang }: { l: ListingRow; lang: "km" | "en" }) {
  return (
    <Link
      to="/listings/$listingId"
      params={{ listingId: l.id }}
      className="flex items-start gap-3 px-4 py-3 active:bg-muted"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <ClipboardList className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-semibold text-foreground">
          {l.title}
        </div>
        {l.description && (
          <div className="line-clamp-1 text-xs text-muted-foreground">
            {l.description}
          </div>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {l.location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {l.location}
            </span>
          )}
          {l.budget != null && (
            <span className="font-semibold text-primary">
              {lang === "km" ? "ថវិកា" : "Budget"}: ${l.budget}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PostItem({ p, term }: { p: PostRow; term: string }) {
  return (
    <Link
      to="/users/$userId"
      params={{ userId: p.user_id }}
      className="flex items-start gap-3 px-4 py-3 active:bg-muted"
    >
      <Avatar name={p.author?.full_name ?? null} url={p.author?.avatar_url ?? null} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-foreground">
          {p.author?.full_name ?? "—"}
        </div>
        <div className="line-clamp-2 text-sm text-foreground">
          {highlight(p.content ?? "", term)}
        </div>
      </div>
    </Link>
  );
}

function highlight(text: string, term: string) {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-foreground">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}

const POPULAR = [
  { en: "Electrician", km: "ជាងអគ្គិសនី", icon: "⚡" },
  { en: "Bricklayer", km: "ជាងឥដ្ឋ", icon: "🧱" },
  { en: "Carpenter", km: "ជាងឈើ", icon: "🪚" },
  { en: "Painter", km: "ជាងលាប", icon: "🎨" },
  { en: "Plumber", km: "ជាងបំពង់ទឹក", icon: "🔧" },
  { en: "Welder", km: "ជាងផ្សារ", icon: "🪛" },
];

function DiscoverView({
  recent,
  onSubmit,
  onRemoveRecent,
  lang,
}: {
  recent: string[];
  onSubmit: (s: string) => void;
  onRemoveRecent: (s: string) => void;
  lang: "km" | "en";
}) {
  return (
    <>
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
                  onClick={() => onSubmit(term)}
                  className="flex-1 text-left text-sm text-foreground"
                >
                  {term}
                </button>
                <button
                  onClick={() => onRemoveRecent(term)}
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
              onClick={() => onSubmit(lang === "km" ? p.km : p.en)}
              className="flex items-center gap-1.5 rounded-pill bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary active:scale-95"
            >
              <span>{p.icon}</span>
              <span>{lang === "km" ? p.km : p.en}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
