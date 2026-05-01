import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon, MapPin, Store as StoreIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/suppliers/")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <SuppliersListPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface SupplierCategory {
  id: string;
  code: string;
  name_en: string;
  name_km: string;
}

interface StoreRow {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  logo_url: string | null;
  categories: SupplierCategory[];
  photos: string[];
}

function SuppliersListPage() {
  const { t, lang } = useI18n();
  const [cats, setCats] = useState<SupplierCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from("supplier_categories")
      .select("id, code, name_en, name_km")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCats(data ?? []));
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: storesData } = await supabase
        .from("supplier_stores")
        .select("id, name, location, description, logo_url")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      const ids = (storesData ?? []).map((s) => s.id);
      const [{ data: scs }, { data: photos }] = await Promise.all([
        ids.length
          ? supabase
              .from("supplier_store_categories")
              .select("store_id, supplier_categories(id, code, name_en, name_km)")
              .in("store_id", ids)
          : Promise.resolve({ data: [] }),
        ids.length
          ? supabase
              .from("supplier_store_photos")
              .select("store_id, photo_url")
              .in("store_id", ids)
              .order("sort_order")
          : Promise.resolve({ data: [] }),
      ]);

      const catsByStore = new Map<string, SupplierCategory[]>();
      for (const r of (scs ?? []) as Array<{ store_id: string; supplier_categories: SupplierCategory }>) {
        const arr = catsByStore.get(r.store_id) ?? [];
        if (r.supplier_categories) arr.push(r.supplier_categories);
        catsByStore.set(r.store_id, arr);
      }
      const photosByStore = new Map<string, string[]>();
      for (const p of (photos ?? []) as Array<{ store_id: string; photo_url: string }>) {
        const arr = photosByStore.get(p.store_id) ?? [];
        arr.push(p.photo_url);
        photosByStore.set(p.store_id, arr);
      }

      const list: StoreRow[] = (storesData ?? []).map((s) => ({
        ...s,
        categories: catsByStore.get(s.id) ?? [],
        photos: (photosByStore.get(s.id) ?? []).slice(0, 3),
      }));
      setStores(list);
      setLoading(false);
    })();
  }, []);

  const filtered = stores.filter((s) => {
    if (activeCat && !s.categories.some((c) => c.id === activeCat)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.description ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="px-3 py-3">
      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
            activeCat === null ? "bg-primary text-primary-foreground" : "bg-surface text-foreground shadow-card"
          }`}
        >
          {t("filter_all")}
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-surface text-foreground shadow-card"
            }`}
          >
            {lang === "km" ? c.name_km : c.name_en}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-2 flex h-11 items-center gap-2 rounded-full bg-surface px-4 shadow-card">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_suppliers_ph")}
          className="h-full flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {/* Store cards */}
      <div className="mt-4 space-y-3">
        {loading && <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>}
        {!loading && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("no_suppliers")}</p>
        )}
        {filtered.map((s) => (
          <Link
            key={s.id}
            to="/suppliers/$storeId"
            params={{ storeId: s.id }}
            className="block rounded-2xl bg-surface p-3 shadow-card active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              {s.logo_url ? (
                <img src={s.logo_url} alt={s.name} className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {initials(s.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-foreground">{s.name}</p>
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {t("supplier_badge")}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  {s.location && (
                    <>
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{s.location}</span>
                    </>
                  )}
                  {s.categories.length > 0 && (
                    <span className="truncate">
                      {" · "}
                      {s.categories.map((c) => (lang === "km" ? c.name_km : c.name_en)).join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {s.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {s.photos.map((p, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-md bg-muted">
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            {s.description && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{s.description}</p>
                <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  {t("contact_supplier")}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Avoid unused-import lint
void StoreIcon;
