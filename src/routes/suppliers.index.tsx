import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon, MapPin, Store as StoreIcon, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
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

interface RentalRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  price_per_day: number;
  location: string;
  availability: string;
  available_from: string | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  rental_photos: { photo_url: string }[];
}

type Mode = "shops" | "rent";
type RentCat = "all" | "vehicles" | "heavy" | "light" | "tools";

function SuppliersListPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("shops");
  const [cats, setCats] = useState<SupplierCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSupplier, setIsSupplier] = useState(false);
  // rent
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [rentCat, setRentCat] = useState<RentCat>("all");
  const [loadingRent, setLoadingRent] = useState(true);

  useEffect(() => {
    void supabase
      .from("supplier_categories")
      .select("id, code, name_en, name_km")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCats(data ?? []));
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("supplier_stores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setIsSupplier((count ?? 0) > 0));
  }, [user]);

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

  useEffect(() => {
    if (mode !== "rent") return;
    setLoadingRent(true);
    void supabase
      .from("rental_listings")
      .select("id, user_id, title, description, category, price_per_day, location, availability, available_from, profiles(full_name, avatar_url), rental_photos(photo_url)")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setRentals((data as RentalRow[] | null) ?? []);
        setLoadingRent(false);
      });
  }, [mode]);

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

  const filteredRentals = rentals.filter((r) => {
    if (rentCat !== "all" && r.category !== rentCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="px-3 py-3">
      {/* Mode toggle */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => { setMode("shops"); setSearch(""); }}
          className={`h-11 rounded-xl text-sm font-bold transition ${
            mode === "shops" ? "bg-[#1a56a0] text-white" : "bg-surface text-foreground shadow-card"
          }`}
        >
          {t("tab_shops")}
        </button>
        <button
          onClick={() => { setMode("rent"); setSearch(""); }}
          className={`h-11 rounded-xl text-sm font-bold transition ${
            mode === "rent" ? "bg-[#1a56a0] text-white" : "bg-surface text-foreground shadow-card"
          }`}
        >
          {t("tab_rent")}
        </button>
      </div>

      {mode === "shops" ? (
        <>
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

          <div className="mt-2 flex h-11 items-center gap-2 rounded-full bg-surface px-4 shadow-card">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_suppliers_ph")}
              className="h-full flex-1 bg-transparent text-sm outline-none"
            />
          </div>

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
        </>
      ) : (
        <RentMode
          search={search}
          setSearch={setSearch}
          rentCat={rentCat}
          setRentCat={setRentCat}
          rentals={filteredRentals}
          loading={loadingRent}
          t={t}
          lang={lang}
        />
      )}
    </div>
  );
}

const RENT_CATS: { id: RentCat; key: "filter_all" | "filter_vehicles" | "filter_heavy" | "filter_light" | "filter_tools" }[] = [
  { id: "all", key: "filter_all" },
  { id: "vehicles", key: "filter_vehicles" },
  { id: "heavy", key: "filter_heavy" },
  { id: "light", key: "filter_light" },
  { id: "tools", key: "filter_tools" },
];

type RentSubMode = "for_rent" | "looking_for";

interface RentalRequestRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  location: string;
  budget_per_day: number | null;
  needed_from: string | null;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
}

function RentMode({
  search,
  setSearch,
  rentCat,
  setRentCat,
  rentals,
  loading,
  t,
  lang,
}: {
  search: string;
  setSearch: (s: string) => void;
  rentCat: RentCat;
  setRentCat: (c: RentCat) => void;
  rentals: RentalRow[];
  loading: boolean;
  t: ReturnType<typeof useI18n>["t"];
  lang: string;
}) {
  void lang;
  const [subMode, setSubMode] = useState<RentSubMode>("for_rent");
  const [requests, setRequests] = useState<RentalRequestRow[]>([]);
  const [loadingReq, setLoadingReq] = useState(false);

  useEffect(() => {
    if (subMode !== "looking_for") return;
    setLoadingReq(true);
    void supabase
      .from("rental_requests")
      .select("id, user_id, title, description, category, location, budget_per_day, needed_from, created_at, profiles(full_name, avatar_url)")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setRequests((data as RentalRequestRow[] | null) ?? []);
        setLoadingReq(false);
      });
  }, [subMode]);

  const filteredRequests = requests.filter((r) => {
    if (rentCat !== "all" && r.category !== rentCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <>
      {/* Sub-mode toggle: For Rent vs Looking For */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => setSubMode("for_rent")}
          className={`h-10 rounded-xl text-xs font-bold transition ${
            subMode === "for_rent" ? "bg-[#534AB7] text-white" : "bg-surface text-foreground shadow-card"
          }`}
        >
          {t("for_rent")}
        </button>
        <button
          onClick={() => setSubMode("looking_for")}
          className={`h-10 rounded-xl text-xs font-bold transition ${
            subMode === "looking_for" ? "bg-[#534AB7] text-white" : "bg-surface text-foreground shadow-card"
          }`}
        >
          {t("looking_for")}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {RENT_CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setRentCat(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              rentCat === c.id ? "bg-[#534AB7] text-white" : "bg-surface text-foreground shadow-card"
            }`}
          >
            {t(c.key)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex h-11 items-center gap-2 rounded-full bg-surface px-4 shadow-card">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={subMode === "for_rent" ? t("rent_search_ph") : "Search requests…"}
          className="h-full flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {subMode === "for_rent" ? (
        <div className="mt-4 space-y-3">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>}
          {!loading && rentals.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("no_rentals_listed")}</p>
          )}
          {rentals.map((r) => (
            <Link
              key={r.id}
              to="/rentals/$rentalId"
              params={{ rentalId: r.id }}
              className="block rounded-2xl border border-[#7F77DD] bg-surface p-3 shadow-card active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground">{r.title}</p>
                    <span className="rounded-pill bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-semibold text-[#26215C]">
                      {catLabel(r.category)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{r.location}</span>
                    {r.profiles?.full_name && <span className="truncate"> · {r.profiles.full_name}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-[#534AB7]">${r.price_per_day}</div>
                  <div className="text-[10px] text-muted-foreground">{t("per_day")}</div>
                </div>
              </div>
              {r.rental_photos.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {r.rental_photos.slice(0, 4).map((p, i) => (
                    <img
                      key={i}
                      src={p.photo_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-md bg-muted object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  {r.availability === "now" ? (
                    <span className="self-start rounded-pill bg-[#e8f8f0] px-2 py-0.5 text-[10px] font-semibold text-[#27ae60]">
                      {t("available_label")}
                    </span>
                  ) : (
                    <span className="self-start rounded-pill bg-[#fff8e1] px-2 py-0.5 text-[10px] font-semibold text-[#b07d00]">
                      {t("booked_until")} {r.available_from ?? ""}
                    </span>
                  )}
                  {r.description && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{r.description}</p>
                  )}
                </div>
                <span className="rounded-lg bg-[#534AB7] px-3 py-1.5 text-xs font-semibold text-white">
                  {t("contact")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">


          {loadingReq && <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>}
          {!loadingReq && filteredRequests.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No requests yet. Be the first to post.</p>
          )}
          {filteredRequests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-dashed border-[#7F77DD] bg-surface p-3 shadow-card">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground">{r.title}</p>
                    <span className="rounded-pill bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-semibold text-[#26215C]">
                      {catLabel(r.category)}
                    </span>
                    <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Looking
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{r.location}</span>
                    {r.profiles?.full_name && <span className="truncate"> · {r.profiles.full_name}</span>}
                  </div>
                </div>
                {r.budget_per_day != null && (
                  <div className="text-right">
                    <div className="text-base font-bold text-[#534AB7]">≤ ${r.budget_per_day}</div>
                    <div className="text-[10px] text-muted-foreground">{t("per_day")}</div>
                  </div>
                )}
              </div>
              {r.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
              )}
              {r.needed_from && (
                <p className="mt-1 text-[11px] text-muted-foreground">Needed from {r.needed_from}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}


function catLabel(cat: string) {
  switch (cat) {
    case "vehicles": return "Vehicles";
    case "heavy": return "Heavy";
    case "light": return "Light";
    case "tools": return "Tools";
    default: return cat;
  }
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

void StoreIcon;
