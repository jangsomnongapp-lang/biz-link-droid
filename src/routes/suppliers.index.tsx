import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon, MapPin, Store as StoreIcon, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/price";


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

interface ProductRow {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  price: number | null;
  discount_price: number | null;
  currency: string;
  post_type: string;
  created_at: string;
  photo_url: string | null;
  store_id: string | null;
  store_name: string | null;
  store_logo: string | null;
  store_location: string | null;
  store_categories: SupplierCategory[];
}

interface StoreCardRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  location: string | null;
  created_at: string;
  categories: SupplierCategory[];
  photos: string[];
}

type FeedItem =
  | { kind: "store"; created_at: string; store: StoreCardRow }
  | { kind: "product"; created_at: string; product: ProductRow };

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

const POST_TYPE_LABELS: Record<string, { en: string; km: string; bg: string; fg: string }> = {
  novedad:     { en: "New",       km: "ថ្មី",        bg: "bg-emerald-100", fg: "text-emerald-700" },
  stock:       { en: "Stock",     km: "ស្តុក",       bg: "bg-sky-100",     fg: "text-sky-700" },
  oferta:      { en: "Offer",     km: "ការផ្តល់ជូន",  bg: "bg-amber-100",   fg: "text-amber-700" },
  liquidacion: { en: "Clearance", km: "បោះតម្លៃ",    bg: "bg-rose-100",    fg: "text-rose-700" },
};

function SuppliersListPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("shops");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [storeCards, setStoreCards] = useState<StoreCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSupplier, setIsSupplier] = useState(false);
  // rent
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [rentCat, setRentCat] = useState<RentCat>("all");
  const [loadingRent, setLoadingRent] = useState(true);

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

      const [{ data: postsData }, { data: allStores }] = await Promise.all([
        supabase
          .from("posts")
          .select("id, user_id, title, content, price, discount_price, currency, post_type, created_at, post_photos(photo_url)")
          .eq("status", "approved")
          .in("post_type", ["novedad", "stock", "oferta", "liquidacion"])
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("supplier_stores")
          .select("id, user_id, name, description, location, logo_url, created_at")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      const storeByUser = new Map<string, { id: string; name: string; location: string | null; logo_url: string | null }>();
      for (const s of (allStores ?? []) as Array<{ id: string; user_id: string; name: string; location: string | null; logo_url: string | null }>) {
        storeByUser.set(s.user_id, { id: s.id, name: s.name, location: s.location, logo_url: s.logo_url });
      }

      const storeIds = ((allStores ?? []) as Array<{ id: string }>).map((s) => s.id);
      const [{ data: scs2 }, { data: storePhotos }] = await Promise.all([
        storeIds.length
          ? supabase
              .from("supplier_store_categories")
              .select("store_id, supplier_categories(id, code, name_en, name_km)")
              .in("store_id", storeIds)
          : Promise.resolve({ data: [] }),
        storeIds.length
          ? supabase
              .from("supplier_store_photos")
              .select("store_id, photo_url")
              .in("store_id", storeIds)
              .order("sort_order")
          : Promise.resolve({ data: [] }),
      ]);

      const catsByStore = new Map<string, SupplierCategory[]>();
      for (const r of (scs2 ?? []) as Array<{ store_id: string; supplier_categories: SupplierCategory }>) {
        const arr = catsByStore.get(r.store_id) ?? [];
        if (r.supplier_categories) arr.push(r.supplier_categories);
        catsByStore.set(r.store_id, arr);
      }
      const photosByStore = new Map<string, string[]>();
      for (const p of (storePhotos ?? []) as Array<{ store_id: string; photo_url: string }>) {
        const arr = photosByStore.get(p.store_id) ?? [];
        arr.push(p.photo_url);
        photosByStore.set(p.store_id, arr);
      }

      const storeList: StoreCardRow[] = ((allStores ?? []) as Array<{ id: string; user_id: string; name: string; description: string | null; location: string | null; logo_url: string | null; created_at: string }>).map((s) => ({
        ...s,
        categories: catsByStore.get(s.id) ?? [],
        photos: (photosByStore.get(s.id) ?? []).slice(0, 3),
      }));

      const list: ProductRow[] = ((postsData ?? []) as Array<{ id: string; user_id: string; title: string | null; content: string | null; price: number | null; discount_price: number | null; currency: string | null; post_type: string | null; created_at: string; post_photos: Array<{ photo_url: string }> }>).map((p) => {
        const st = storeByUser.get(p.user_id);
        return {
          id: p.id,
          user_id: p.user_id,
          title: p.title,
          content: p.content,
          price: p.price,
          discount_price: p.discount_price,
          currency: p.currency ?? "USD",
          post_type: p.post_type ?? "general",
          created_at: p.created_at,
          photo_url: p.post_photos?.[0]?.photo_url ?? null,
          store_id: st?.id ?? null,
          store_name: st?.name ?? null,
          store_logo: st?.logo_url ?? null,
          store_location: st?.location ?? null,
          store_categories: st ? catsByStore.get(st.id) ?? [] : [],
        };
      });
      setProducts(list);
      setStoreCards(storeList);
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

  const q = search.toLowerCase();
  const filteredProducts: FeedItem[] = products
    .filter((p) => {
      if (q) {
        const hay = `${p.title ?? ""} ${p.content ?? ""} ${p.store_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((p) => ({ kind: "product" as const, created_at: p.created_at, product: p }));
  const filteredStores: FeedItem[] = storeCards
    .filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((s) => ({ kind: "store" as const, created_at: s.created_at, store: s }));
  const filtered: FeedItem[] = [...filteredProducts, ...filteredStores].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

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
    <div className="relative px-3 py-3">
      {mode === "shops" && isSupplier && (
        <Link
          to="/posts/new"
          className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          {lang === "km" ? "ដាក់ផលិតផល" : "Post my product"}
        </Link>
      )}
      {mode === "rent" && isSupplier && (
        <Link
          to="/rentals/new"
          className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-[#534AB7] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#534AB7]/30 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          {lang === "km" ? "បង្ហោះជួល" : "Post my rental"}
        </Link>
      )}
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
            {filtered.map((item) => {
              if (item.kind === "store") {
                const s = item.store;
                return (
                  <Link
                    key={`s-${s.id}`}
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
                        {s.photos.map((ph, i) => (
                          <div key={i} className="aspect-square overflow-hidden rounded-md bg-muted">
                            <img src={ph} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {s.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                    )}
                  </Link>
                );
              }
              const p = item.product;
              const meta = POST_TYPE_LABELS[p.post_type as keyof typeof POST_TYPE_LABELS];
              const heading = p.title || p.content?.split("\n")[0] || "Product";
              return (
                <div key={`p-${p.id}`} className="rounded-2xl bg-surface p-3 shadow-card">
                  {p.store_id && (
                    <Link
                      to="/suppliers/$storeId"
                      params={{ storeId: p.store_id }}
                      className="flex items-center gap-2 pb-2"
                    >
                      {p.store_logo ? (
                        <img src={p.store_logo} alt={p.store_name ?? ""} className="h-8 w-8 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                          {initials(p.store_name ?? "?")}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">{p.store_name}</p>
                        {p.store_location && (
                          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" /> {p.store_location}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {t("supplier_badge")}
                      </span>
                    </Link>
                  )}

                  <div className="flex gap-3">
                    {p.photo_url && (
                      <img src={p.photo_url} alt="" className="h-24 w-24 shrink-0 rounded-lg bg-muted object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {meta && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.fg}`}>
                            {lang === "km" ? meta.km : meta.en}
                          </span>
                        )}
                        <p className="truncate text-sm font-bold text-foreground">{heading}</p>
                      </div>
                      {p.price != null && (
                        <div className="mt-1 flex items-baseline gap-1.5">
                          {p.discount_price != null ? (
                            <>
                              <span className="text-base font-bold text-rose-600">{formatPrice(p.discount_price, p.currency)}</span>
                              <span className="text-xs text-muted-foreground line-through">{formatPrice(p.price, p.currency)}</span>
                            </>
                          ) : (
                            <span className="text-base font-bold text-success">{formatPrice(p.price, p.currency)}</span>
                          )}
                        </div>
                      )}
                      {p.content && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.content}</p>
                      )}
                    </div>
                  </div>

                  {p.store_id && (
                    <Link
                      to="/suppliers/$storeId"
                      params={{ storeId: p.store_id }}
                      className="mt-2 flex h-9 w-full items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground active:scale-[0.98]"
                    >
                      {t("contact_supplier")}
                    </Link>
                  )}
                </div>
              );
            })}
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
            <p className="py-10 text-center text-sm text-muted-foreground">{t("no_rental_requests")}</p>
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

