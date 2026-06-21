import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, MapPin, Store as StoreIcon, Plus, MessageCircle, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/price";
import { ShopGridSkeleton, ListSkeleton } from "@/components/SkeletonFeed";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { CAMBODIA_PROVINCES } from "@/components/ProvinceSelect";


export const Route = createFileRoute("/suppliers/")({
  validateSearch: (params: Record<string, unknown>): { q?: string } => ({
    q: typeof params.q === "string" ? params.q.slice(0, 120) : undefined,
  }),
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
  const { q: scannedProduct } = Route.useSearch();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("shops");
  const [search, setSearch] = useState(scannedProduct ?? "");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [storeCards, setStoreCards] = useState<StoreCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSupplier, setIsSupplier] = useState(false);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [contactingId, setContactingId] = useState<string | null>(null);
  // rent
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [rentCat, setRentCat] = useState<RentCat>("all");
  const [loadingRent, setLoadingRent] = useState(true);
  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ location: "", categoryId: "", minPrice: "", maxPrice: "" });
  const [draft, setDraft] = useState({ location: "", categoryId: "", minPrice: "", maxPrice: "" });

  const km = lang === "km";
  const locationLabel = km ? "ទីតាំង" : "Location";
  const priceLabel = km ? "តម្លៃ (USD)" : "Price (USD)";
  const categoryLabel = km ? "ប្រភេទ" : "Category";
  const filterTitle = km ? "តម្រង" : "Filters";
  const applyLabel = km ? "អនុវត្ត" : "Apply";
  const clearLabel = km ? "សម្អាត" : "Clear";
  const allLabel = km ? "ទាំងអស់" : "All";

  const activeCount =
    (filters.location ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0);

  async function contactAboutProduct(p: ProductRow) {
    if (!user || !p.store_id) return;
    if (user.id === p.user_id) return;
    setContactingId(p.id);
    try {
      const { data: threadId, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { message: string } | null }>)(
        "start_product_chat",
        { _supplier_id: p.user_id, _post_id: p.id },
      );
      if (error) throw error;
      void supabase.rpc("increment_supplier_contact", { _store_id: p.store_id });
      nav({
        to: "/messages/$threadId",
        params: { threadId: threadId as string },
        search: { pin: `post:${p.id}` },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContactingId(null);
    }
  }

  useEffect(() => {
    void supabase
      .from("supplier_categories")
      .select("id, code, name_en, name_km")
      .order("name_en")
      .then(({ data }) => setCategories((data as SupplierCategory[] | null) ?? []));
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

      let postsQuery = supabase
        .from("posts")
        .select(
          "id, user_id, title, content, price, discount_price, currency, post_type, created_at, post_photos(photo_url)",
        )
        .eq("status", "approved")
        .in("post_type", ["novedad", "stock", "oferta", "liquidacion"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (scannedProduct) {
        const safeTerm = scannedProduct.replace(/[,%()]/g, " ").trim();
        if (safeTerm) {
          postsQuery = postsQuery.or(`title.ilike.%${safeTerm}%,content.ilike.%${safeTerm}%`);
        }
      }

      const [{ data: postsData }, { data: allStores }] = await Promise.all([
        postsQuery,
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
  }, [scannedProduct]);

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

  const filtered = useMemo(() => {
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;

    const filteredProducts = products
      .filter((p) => {
        if (filters.location && p.store_location !== filters.location) return false;
        if (filters.categoryId && !p.store_categories.some((c) => c.id === filters.categoryId)) return false;
        if (min != null && (p.price == null || p.price < min)) return false;
        if (max != null && (p.price == null || p.price > max)) return false;
        if (q) {
          const hay = `${p.title ?? ""} ${p.content ?? ""} ${p.store_name ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((p) => ({ kind: "product" as const, created_at: p.created_at, product: p }));

    const filteredStores = storeCards
      .filter((s) => {
        if (filters.location && s.location !== filters.location) return false;
        if (filters.categoryId && !s.categories.some((c) => c.id === filters.categoryId)) return false;
        if (q) {
          const hay = `${s.name} ${s.description ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((s) => ({ kind: "store" as const, created_at: s.created_at, store: s }));

    return [...filteredProducts, ...filteredStores].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [products, storeCards, filters, q]);

  const filteredRentals = useMemo(() => {
    return rentals.filter((r) => {
      if (rentCat !== "all" && r.category !== rentCat) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rentals, rentCat, search]);

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
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-11 flex-1 items-center gap-2 rounded-full bg-surface px-4 shadow-card">
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search_suppliers_ph")}
                className="h-full flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <button
              onClick={() => { setDraft(filters); setFilterOpen(true); }}
              aria-label={filterTitle}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-foreground shadow-card active:scale-[0.97]"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {activeCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {activeCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.location && (
                <FilterChip label={filters.location} onClear={() => setFilters({ ...filters, location: "" })} />
              )}
              {filters.categoryId && (
                <FilterChip
                  label={(() => {
                    const c = categories.find((c) => c.id === filters.categoryId);
                    return c ? (km ? c.name_km : c.name_en) : categoryLabel;
                  })()}
                  onClear={() => setFilters({ ...filters, categoryId: "" })}
                />
              )}
              {(filters.minPrice || filters.maxPrice) && (
                <FilterChip
                  label={`$${filters.minPrice || "0"} - $${filters.maxPrice || "∞"}`}
                  onClear={() => setFilters({ ...filters, minPrice: "", maxPrice: "" })}
                />
              )}
            </div>
          )}

          <div className="mt-4">
            {loading && <div className="mt-4"><ShopGridSkeleton count={6} /></div>}
            {!loading && filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("no_suppliers")}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item, idx) => {
                const eager = idx < 4;
                const imgLoading = eager ? "eager" : "lazy";
                const imgFetchPriority = eager ? "high" : "low";
                if (item.kind === "store") {
                  const s = item.store;
                  const cover = s.photos[0] ?? s.logo_url;
                  return (
                    <Link
                      key={`s-${s.id}`}
                      to="/suppliers/$storeId"
                      params={{ storeId: s.id }}
                      className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-card active:scale-[0.99] [content-visibility:auto] [contain-intrinsic-size:280px]"
                    >
                      <div className="relative h-44 w-full flex-shrink-0 bg-muted">
                        {cover ? (
                          <img
                            src={cover}
                            alt={s.name}
                            className="h-full w-full object-cover"
                            loading={imgLoading}
                            decoding="async"
                            fetchPriority={imgFetchPriority}
                          />

                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-bold text-primary">
                            {initials(s.name)}
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          {t("supplier_badge")}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-2.5">
                        <p className="line-clamp-1 text-sm font-bold text-foreground">{s.name}</p>
                        {s.location && (
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{s.location}</span>
                          </p>
                        )}
                        {s.categories.length > 0 && (
                          <p className="line-clamp-1 text-[10px] text-muted-foreground">
                            {s.categories.map((c) => (lang === "km" ? c.name_km : c.name_en)).join(" · ")}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                }
                const p = item.product;
                const meta = POST_TYPE_LABELS[p.post_type as keyof typeof POST_TYPE_LABELS];
                const heading = p.title || p.content?.split("\n")[0] || "Product";
                const isMine = user?.id === p.user_id;
                return (
                  <div key={`p-${p.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-card [content-visibility:auto] [contain-intrinsic-size:280px]">
                    <Link
                      to={p.store_id ? "/suppliers/$storeId" : "/suppliers"}
                      params={p.store_id ? { storeId: p.store_id } : undefined}
                      className="relative block h-44 w-full flex-shrink-0 bg-muted"
                    >
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt={heading}
                          className="h-full w-full object-cover"
                          loading={imgLoading}
                          decoding="async"
                          fetchPriority={imgFetchPriority}
                        />

                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          {lang === "km" ? "មិនមានរូប" : "No image"}
                        </div>
                      )}
                      {meta && (
                        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.fg}`}>
                          {lang === "km" ? meta.km : meta.en}
                        </span>
                      )}
                      {p.discount_price != null && p.price != null && (
                        <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          -{Math.max(1, Math.round((1 - p.discount_price / p.price) * 100))}%
                        </span>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                      <p className="line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-snug text-foreground">
                        {heading}
                      </p>
                      {p.price != null && (
                        <div className="flex items-baseline gap-1.5">
                          {p.discount_price != null ? (
                            <>
                              <span className="text-sm font-bold text-rose-600">{formatPrice(p.discount_price, p.currency)}</span>
                              <span className="text-[10px] text-muted-foreground line-through">{formatPrice(p.price, p.currency)}</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-success">{formatPrice(p.price, p.currency)}</span>
                          )}
                        </div>
                      )}
                      {p.store_id && (
                        <Link
                          to="/suppliers/$storeId"
                          params={{ storeId: p.store_id }}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
                        >
                          <StoreIcon className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{p.store_name}</span>
                        </Link>
                      )}
                      {!isMine && p.store_id && (
                        <button
                          onClick={() => void contactAboutProduct(p)}
                          disabled={contactingId === p.id}
                          className="mt-auto flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                        >
                          <MessageCircle className="h-3 w-3" />
                          {contactingId === p.id
                            ? (lang === "km" ? "កំពុង…" : "Opening…")
                            : (lang === "km" ? "សួរអំពីផលិតផល" : "Ask about this")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold">{filterTitle}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 p-4">
            <section>
              <h4 className="mb-2 text-sm font-semibold text-foreground">{locationLabel}</h4>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={!draft.location}
                  onClick={() => setDraft({ ...draft, location: "" })}
                  label={allLabel}
                />
                {CAMBODIA_PROVINCES.map((p) => (
                  <Chip
                    key={p.en}
                    active={draft.location === p.en}
                    onClick={() => setDraft({ ...draft, location: p.en })}
                    label={km ? p.km : p.en}
                  />
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold text-foreground">{priceLabel}</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={draft.minPrice}
                  onChange={(e) => setDraft({ ...draft, minPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                  inputMode="decimal"
                  placeholder={km ? "អប្បបរមា" : "Min"}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
                <input
                  value={draft.maxPrice}
                  onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                  inputMode="decimal"
                  placeholder={km ? "អតិបរមា" : "Max"}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { min: "", max: "100", label: "< $100" },
                  { min: "100", max: "500", label: "$100–500" },
                  { min: "500", max: "1000", label: "$500–1k" },
                  { min: "1000", max: "", label: "$1k+" },
                ].map((p) => (
                  <Chip
                    key={p.label}
                    active={draft.minPrice === p.min && draft.maxPrice === p.max}
                    onClick={() => setDraft({ ...draft, minPrice: p.min, maxPrice: p.max })}
                    label={p.label}
                  />
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold text-foreground">{categoryLabel}</h4>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={!draft.categoryId}
                  onClick={() => setDraft({ ...draft, categoryId: "" })}
                  label={allLabel}
                />
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    active={draft.categoryId === c.id}
                    onClick={() => setDraft({ ...draft, categoryId: c.id })}
                    label={km ? c.name_km : c.name_en}
                  />
                ))}
              </div>
            </section>
          </div>

          <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-border bg-surface p-3">
            <button
              onClick={() => { setDraft({ location: "", categoryId: "", minPrice: "", maxPrice: "" }); setFilters({ location: "", categoryId: "", minPrice: "", maxPrice: "" }); setFilterOpen(false); }}
              className="h-11 flex-1 rounded-xl border border-border bg-background text-sm font-semibold text-foreground active:scale-[0.99]"
            >
              {clearLabel}
            </button>
            <button
              onClick={() => { setFilters(draft); setFilterOpen(false); }}
              className="h-11 flex-[2] rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99]"
            >
              {applyLabel}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
          {loading && <div className="mt-4"><ListSkeleton count={3} /></div>}
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

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-surface text-foreground shadow-card"
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {label}
      <button onClick={onClear} className="ml-0.5 inline-flex items-center justify-center">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

