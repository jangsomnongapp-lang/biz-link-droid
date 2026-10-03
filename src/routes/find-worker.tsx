import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Search,
  MapPin,
  ChevronRight,
  Shapes,
  Check,
  type LucideIcon,
} from "lucide-react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { CategoryImage, hasCategoryImage } from "@/components/CategoryImage";

export const Route = createFileRoute("/find-worker")({
  head: () => ({
    meta: [
      { title: "Find Skilled Construction Workers in Cambodia — BuildHub" },
      { name: "description", content: "Search for construction workers, team leaders, and specialists across Cambodia. Filter by trade, role, and location." },
      { property: "og:title", content: "Find Skilled Construction Workers in Cambodia — BuildHub" },
      { property: "og:description", content: "Search construction workers, teams, and specialists across Cambodia by trade, role, and location." },
      { property: "og:url", content: "https://buildhubkh.com/find-worker" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/find-worker" }],
  }),
  component: () => (
    <RequireAuth>
      <FindWorkerPage />
    </RequireAuth>
  ),
});

interface WorkerProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  about_me: string | null;
  is_provider: boolean;
  is_coordinator: boolean;
  is_organization: boolean;
}

interface Category {
  id: string;
  code: string;
  name_en: string;
  name_km: string;
}

function FindWorkerPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [workerCats, setWorkerCats] = useState<Record<string, Category[]>>({});
  const [availFilter, setAvailFilter] = useState<"all" | "available">("all");
  const [availableIds, setAvailableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from("categories")
      .select("id, code, name_en, name_km")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    (async () => {
      let userIds: string[] | null = null;
      if (selectedCat) {
        const { data: uc } = await supabase
          .from("user_categories")
          .select("user_id")
          .eq("category_id", selectedCat);
        userIds = (uc ?? []).map((r) => r.user_id);
        if (userIds.length === 0) {
          if (!cancelled) {
            setWorkers([]);
            setWorkerCats({});
            setLoading(false);
          }
          return;
        }
      }

      let q = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, about_me, is_provider, is_coordinator, is_organization")
        .or("is_provider.eq.true,is_coordinator.eq.true,is_organization.eq.true")
        .limit(100);

      if (userIds) q = q.in("id", userIds);

      const { data } = await q;
      let list = (data ?? []) as WorkerProfile[];
      if (query.trim()) {
        const needle = query.trim().toLowerCase();
        list = list.filter((w) =>
          (w.full_name ?? "").toLowerCase().includes(needle) ||
          (w.about_me ?? "").toLowerCase().includes(needle),
        );
      }

      if (cancelled) return;
      setWorkers(list);

      if (list.length > 0) {
        const ids = list.map((w) => w.id);
        void supabase
          .rpc("get_today_availability_bulk", { _uids: ids })
          .then(({ data: avail }) => {
            if (cancelled) return;
            const set = new Set<string>();
            for (const row of (avail ?? []) as { user_id: string; status: string }[]) {
              if (row.status === "available") set.add(row.user_id);
            }
            setAvailableIds(set);
          });
        const { data: ucs } = await supabase
          .from("user_categories")
          .select("user_id, categories(id, name_en, name_km)")
          .in("user_id", ids);
        const map: Record<string, Category[]> = {};
        for (const row of ucs ?? []) {
          const cat = row.categories as Category | null;
          if (!cat) continue;
          (map[row.user_id] ||= []).push(cat);
        }
        if (!cancelled) setWorkerCats(map);
      } else {
        setWorkerCats({});
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCat, query]);

  const roleLabel = (w: WorkerProfile) =>
    [
      w.is_provider ? t("role_provider") : null,
      w.is_coordinator ? t("role_coordinator") : null,
      w.is_organization ? t("role_organization") : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const visibleCats = useMemo(() => categories.slice(0, 30), [categories]);

  const visibleWorkers = useMemo(
    () =>
      availFilter === "all"
        ? workers
        : workers.filter((w) => availableIds.has(w.id)),
    [workers, availFilter, availableIds],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background pb-10">
      <header className="sticky top-0 z-30 bg-primary px-3 pb-3 pt-3 text-primary-foreground">
        <div className="mb-2 flex h-10 items-center">
          <button
            onClick={() => nav({ to: "/settings" })}
            className="rounded-full p-2 active:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">{t("find_worker")}</h1>
          <span className="w-9" />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2">
          <Search className="h-4 w-4 text-white/80" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("find_worker_search_ph")}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/70 focus:outline-none"
          />
        </div>
      </header>

      <div className="border-b border-border bg-surface px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          <CategoryTile
            active={selectedCat === null}
            onClick={() => setSelectedCat(null)}
            label={t("all")}
            Icon={Shapes}
            color="bg-shortcut-slate"
          />
          {visibleCats.map((c) => (
            <CategoryTile
              key={c.id}
              active={selectedCat === c.id}
              onClick={() => setSelectedCat(c.id)}
              label={lang === "km" ? c.name_km : c.name_en}
              code={hasCategoryImage(c.code) ? c.code : undefined}
              Icon={hasCategoryImage(c.code) ? undefined : Shapes}
              color="bg-shortcut-slate"
            />
          ))}
        </div>
      </div>

      <div className="border-b border-border bg-surface px-3 pb-2">
        <div className="flex gap-2 py-2">
          <Chip
            active={availFilter === "all"}
            onClick={() => setAvailFilter("all")}
            label={t("all")}
          />
          <Chip
            active={availFilter === "available"}
            onClick={() => setAvailFilter("available")}
            label={t("available_today_filter")}
          />
        </div>
      </div>

      <div className="px-3 py-2 text-xs text-muted-foreground">
        {loading ? t("loading") : t("workers_found", { n: visibleWorkers.length })}
      </div>

      <div className="flex flex-col gap-2 px-3">
        {!loading && visibleWorkers.length === 0 && (
          <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("no_workers_found")}
          </div>
        )}
        {visibleWorkers.map((w) => {
          const cats = workerCats[w.id] ?? [];
          return (
            <Link
              key={w.id}
              to="/users/$userId"
              params={{ userId: w.id }}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-card active:bg-muted"
            >
              <Avatar name={w.full_name} url={w.avatar_url} size={52} />
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-sm font-bold text-foreground">
                  {w.full_name ?? "—"}
                </div>
                <div className="truncate text-[11px] font-medium text-primary">
                  {roleLabel(w) || t("role_provider")}
                </div>
                <div className="mt-1"><AvailabilityBadge userId={w.id} /></div>

                {cats.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cats.slice(0, 3).map((c) => (
                      <span
                        key={c.id}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {lang === "km" ? c.name_km : c.name_en}
                      </span>
                    ))}
                  </div>
                )}
                {w.about_me && (
                  <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    {w.about_me}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CategoryTile({
  active,
  onClick,
  label,
  code,
  Icon,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  code?: string;
  Icon?: LucideIcon;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative aspect-[4/5] overflow-hidden rounded-2xl border transition active:scale-[0.98] ${
        active ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      {code ? (
        <span className="absolute inset-0 block">
          <CategoryImage code={code} name={label} />
        </span>
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center ${color ?? "bg-shortcut-slate"}`}
        >
          {Icon ? <Icon className="h-8 w-8 text-white" strokeWidth={2.2} /> : null}
        </span>
      )}
      {active && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <span className="absolute inset-x-1.5 bottom-1.5">
        <span className="block w-full rounded-full bg-surface/90 px-2 py-1 text-center text-[10px] font-semibold leading-tight text-foreground shadow-sm backdrop-blur-sm line-clamp-2">
          {label}
        </span>
      </span>
    </button>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground active:bg-border"
      }`}
    >
      {label}
    </button>
  );
}
