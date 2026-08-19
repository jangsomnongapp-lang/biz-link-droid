import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MoreHorizontal, MapPin, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { ShareButton } from "@/components/ShareButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StoreCatalog } from "@/components/StoreCatalog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/price";
import { catalogCopy } from "@/lib/catalog-copy";
import { getSupplierSeo } from "@/lib/seo-fetchers.functions";



export const Route = createFileRoute("/suppliers/$storeId")({
  // SEO metadata is only needed for the server-rendered HTML crawlers see.
  // Skipping it in the browser removes a blocking round-trip on every navigation.
  staleTime: 5 * 60_000,
  loader: async ({ params }) => {
    if (typeof window !== "undefined") return { seo: null };
    try {
      const seo = await getSupplierSeo({ data: { id: params.storeId } });
      return { seo };
    } catch {
      return { seo: null };
    }
  },
  head: ({ params, loaderData }) => {
    const seo = loaderData?.seo ?? null;
    const name = seo?.name?.trim();
    const title = name
      ? `${name.slice(0, 45)} — Construction Supplier`
      : "Construction Supplier Store — BuildHub";
    const rawDesc = seo?.description?.trim();
    const locSuffix = seo?.location ? ` in ${seo.location}` : " in Cambodia";
    let description = rawDesc && rawDesc.length > 20
      ? rawDesc.slice(0, 155)
      : name
        ? `${name} — construction material and equipment supplier${locSuffix}. Browse products and request quotes on BuildHub.`
        : "View this supplier's store, products, and location on BuildHub — Cambodia's construction marketplace.";
    if (description.length < 60) description = `${description} Verified on BuildHub Cambodia.`;
    const url = `https://buildhubkh.com/suppliers/${params.storeId}`;
    const image = seo?.logo ?? null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        ...(image ? [{ property: "og:image", content: image } as const, { name: "twitter:image", content: image } as const] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: name || "Construction supplier",
            url,
            description: rawDesc || description,
            ...(image ? { image } : {}),
            ...(seo?.location ? { address: { "@type": "PostalAddress", addressLocality: seo.location, addressCountry: "KH" } } : {}),
            areaServed: "KH",
          }),
        },
      ],
    };
  },
  component: SupplierRoute,
});

function SupplierRoute() {
  const { storeId } = Route.useParams();
  const location = useLocation();

  return (
    <RequireAuth>
      {location.pathname === `/suppliers/${storeId}` ? <SupplierProfilePage /> : <Outlet />}
    </RequireAuth>
  );
}

interface SupplierCategory {
  id: string;
  name_en: string;
  name_km: string;
}

interface StoreDetail {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  description: string | null;
  logo_url: string | null;
  view_count: number;
  contact_count: number;
  phone: string | null;
  fast_response: boolean | null;
  delivery_available: boolean | null;
  min_order: number | null;
}


interface RecentPost {
  id: string;
  content: string | null;
  title: string | null;
  price: number | null;
  discount_price: number | null;
  currency: string;
  post_type: string;
  created_at: string;
  photo_url: string | null;
  view_count: number;
}


function SupplierProfilePage() {
  const { storeId } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [cats, setCats] = useState<SupplierCategory[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [catalogCount, setCatalogCount] = useState(0);
  const cc = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);

  const [contacting, setContacting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user || !store || user.id !== store.user_id) return;
    void supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "material_request")
      .is("read_at", null)
      .then(({ count }) => setPendingRequests(count ?? 0));
  }, [user, store]);

  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase
        .from("supplier_stores")
        .select(
          "id, user_id, name, location, description, logo_url, view_count, contact_count, phone, fast_response, delivery_available, min_order",
        )
        .eq("id", storeId)
        .maybeSingle();
      setStore(s ?? null);
      if (!s) return;

      const [{ data: scs }, { data: ph }, { count }, { data: pp }, { count: catCount }] = await Promise.all([
        supabase
          .from("supplier_store_categories")
          .select("supplier_categories(id, name_en, name_km)")
          .eq("store_id", storeId),
        supabase
          .from("supplier_store_photos")
          .select("photo_url")
          .eq("store_id", storeId)
          .order("sort_order"),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", s.user_id)
          .eq("status", "approved"),
        supabase
          .from("posts")
          .select("id, content, title, price, discount_price, currency, post_type, created_at, view_count, post_photos(photo_url)")
          .eq("user_id", s.user_id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("supplier_catalog_items")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId),
      ]);
      setCatalogCount(catCount ?? 0);


      setCats(
        ((scs ?? []) as Array<{ supplier_categories: SupplierCategory }>)
          .map((r) => r.supplier_categories)
          .filter(Boolean),
      );
      setPhotos(((ph ?? []) as Array<{ photo_url: string }>).map((p) => p.photo_url));
      setPostsCount(count ?? 0);
      setPosts(
        ((pp ?? []) as unknown as Array<{ id: string; content: string | null; title: string | null; price: number | null; discount_price: number | null; currency: string | null; post_type: string | null; created_at: string; view_count: number | null; post_photos: Array<{ photo_url: string }> }>).map((p) => ({
          id: p.id,
          content: p.content,
          title: p.title,
          price: p.price,
          discount_price: p.discount_price,
          currency: p.currency ?? "USD",
          post_type: p.post_type ?? "general",
          created_at: p.created_at,
          photo_url: p.post_photos?.[0]?.photo_url ?? null,
          view_count: p.view_count ?? 0,
        })),
      );


      // Increment view count if not owner
      if (user && user.id !== s.user_id) {
        void supabase.rpc("increment_supplier_view", { _store_id: storeId });
      }
    })();
  }, [storeId, user]);

  async function startConversation(postId?: string) {
    if (!user || !store) return;
    if (user.id === store.user_id) return;
    setContacting(true);
    try {
      const { data: threadId, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { message: string } | null }>)(
        "start_product_chat",
        { _supplier_id: store.user_id, _post_id: postId ?? null },
      );
      if (error) throw error;
      void supabase.rpc("increment_supplier_contact", { _store_id: storeId });
      nav({
        to: "/messages/$threadId",
        params: { threadId: threadId as string },
        search: postId ? { pin: `post:${postId}` } : { pin: `store:${storeId}` },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContacting(false);
    }
  }

  async function deleteStore() {
    if (!store) return;
    const { error } = await supabase.from("supplier_stores").delete().eq("id", store.id);
    if (error) {
      toast.error(t("delete_failed"));
      return;
    }
    toast.success(t("deleted"));
    nav({ to: "/suppliers" });
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  const isOwner = user?.id === store.user_id;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Blue header */}
      <div className="bg-primary px-5 pb-8 pt-5 text-primary-foreground">
        <div className="flex items-center justify-between">
          <Link to="/suppliers" className="rounded-full p-1 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-base font-semibold">{t("supplier_profile")}</h2>
          <div className="flex items-center gap-1">
            <ShareButton
              path={`/suppliers/${storeId}`}
              title={store.name}
              className="rounded-full p-1 active:bg-white/10"
            />
            {isOwner ? (
              <>
                <Link
                  to="/suppliers/$storeId/edit"
                  params={{ storeId }}
                  className="rounded-full p-1 active:bg-white/10"
                  aria-label={t("edit_store")}
                >
                  <Pencil className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleting(true)}
                  className="rounded-full p-1 active:bg-white/10"
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </>
            ) : (
              <button className="rounded-full p-1 active:bg-white/10" aria-label="more">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-24 w-24 rounded-2xl bg-white object-cover shadow-card"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-primary shadow-card">
              {initials(store.name)}
            </div>
          )}
          <h1 className="mt-3 text-lg font-bold">{store.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold">
              {t("supplier_badge")} ✓
            </span>
            {store.fast_response && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium">
                ⚡ {cc("fast_response")}
              </span>
            )}
            {store.delivery_available && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium">
                🚚 {cc("delivery_available")}
              </span>
            )}
            {catalogCount > 0 && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium">
                {catalogCount} {cc("products_count")}
              </span>
            )}
            {store.min_order != null && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium">
                {cc("min_order").replace("{v}", formatPrice(store.min_order, "USD"))}
              </span>
            )}
            {cats.map((c) => (
              <span key={c.id} className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium">
                {lang === "km" ? c.name_km : c.name_en}
              </span>
            ))}
          </div>
          {store.location && (
            <p className="mt-2 flex items-center gap-1 text-xs opacity-90">
              📍 {store.location}
            </p>
          )}

          {/* Chat / Call / Location */}
          <div className="mt-4 grid w-full grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => (isOwner ? undefined : void startConversation())}
              disabled={isOwner || contacting}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-[12px] font-bold text-primary active:scale-[0.98] disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
              {cc("chat")}
            </button>
            <a
              href={store.phone ? `tel:${store.phone}` : undefined}
              aria-disabled={!store.phone}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/10 text-[12px] font-bold ${
                store.phone ? "active:scale-[0.98]" : "pointer-events-none opacity-50"
              }`}
            >
              <Phone className="h-4 w-4" />
              {cc("call")}
            </a>
            <a
              href={
                store.location
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.location)}`
                  : undefined
              }
              target="_blank"
              rel="noreferrer"
              aria-disabled={!store.location}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/10 text-[12px] font-bold ${
                store.location ? "active:scale-[0.98]" : "pointer-events-none opacity-50"
              }`}
            >
              <MapPin className="h-4 w-4" />
              {cc("location")}
            </a>
          </div>

        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-b border-border bg-surface">
        <Stat value={postsCount} label={t("posts_label")} />
        <Stat value={store.view_count ?? 0} label={t("views_label")} divider />
        <Stat value={store.contact_count ?? 0} label={t("contacts_label")} divider />
      </div>

      {/* Catalogue (public) */}
      <div className="border-b border-border bg-surface px-5 py-3">
        <Link
          to="/suppliers/$storeId/catalog/products"
          params={{ storeId }}
          className="flex items-center justify-between rounded-xl border border-primary bg-primary/5 px-4 py-3 text-sm font-bold text-primary active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            🧾 {lang === "km" ? "កាតាឡុក" : "Catalogue"}
          </span>
          <span className="text-xs font-semibold opacity-80">
            {catalogCount} {cc("products_count")}
          </span>
        </Link>
      </div>




      {/* Online orders (owner only) */}
      {isOwner && (
        <div className="border-b border-border bg-surface px-5 py-3 space-y-2">
          <Link
            to="/suppliers/$storeId/catalog"
            params={{ storeId }}
            className="flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              🧾 {lang === "km" ? "កាតាឡុកផលិតផល" : "Catalogue"}
            </span>
            <span className="text-xs font-semibold opacity-90">
              {lang === "km" ? "បន្ថែមផលិតផល" : "Add products"}
            </span>
          </Link>
          <Link
            to="/suppliers/$storeId/catalog/manage"
            params={{ storeId }}
            className="flex items-center justify-between rounded-xl bg-[#0f1420] px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              📊 {lang === "km" ? "កាតាឡុករបស់ខ្ញុំ" : "My catalogue"}
            </span>
            <span className="text-xs font-semibold opacity-80">
              {lang === "km" ? "ស្ថិតិ និងស្តុក" : "Stats & stock"}
            </span>
          </Link>

          <Link

            to="/online-orders"
            className="flex items-center justify-between rounded-xl bg-[#c87000] px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              📦 {lang === "km" ? "ការបញ្ជាទិញតាមអ៊ីនធឺណិត" : "Online orders"}
            </span>
            {pendingRequests > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#c87000]">
                {pendingRequests}
              </span>
            )}
          </Link>
          <Link
            to="/rentals/new"
            className="flex items-center justify-between rounded-xl bg-[#534AB7] px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              🔧 {lang === "km" ? "បង្ហោះសម្រាប់ជួល" : "List for rent"}
            </span>
          </Link>
        </div>
      )}

      {/* About */}
      {store.description && (
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-foreground">{t("about_label")}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{store.description}</p>
        </div>
      )}

      {/* Public catalogue */}
      <StoreCatalog
        storeId={storeId}
        isOwner={isOwner}
        onAskPost={(postId) => void startConversation(postId)}
        onAsk={(item) => {
          if (user) {
            void supabase.from("catalog_item_events").insert({
              item_id: item.id,
              store_id: storeId,
              user_id: user.id,
              event_type: "chat",
            });
          }
          void startConversation();
        }}
      />



      {/* Featured products */}
      {photos.length > 0 && (
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-foreground">
            {t("featured_products")} ({photos.length})
          </p>
          <div className="mt-3 -mx-5 overflow-x-auto px-5 snap-x snap-mandatory scrollbar-none">
            <div className="flex gap-2">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className="aspect-square w-[70%] shrink-0 snap-start overflow-hidden rounded-md bg-muted"
                >
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent posts / products */}
      {posts.length > 0 && (
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-foreground">{t("recent_posts")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {posts.map((p) => {
              const meta = POST_TYPE_LABELS[p.post_type as keyof typeof POST_TYPE_LABELS];
              const heading = p.title || p.content?.split("\n")[0] || "Post";
              return (
                <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <Link to="/posts/$postId" params={{ postId: p.id }} className="block active:opacity-80">
                    {p.photo_url ? (
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                        {lang === "km" ? "គ្មានរូប" : "No image"}
                      </div>
                    )}
                    <div className="p-2">
                      {meta && (
                        <span className={`inline-block rounded-pill px-1.5 py-0.5 text-[9px] font-bold ${meta.bg} ${meta.fg}`}>
                          {lang === "km" ? meta.km : meta.en}
                        </span>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-foreground">{heading}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {p.price != null && (
                          <span className="inline-flex items-baseline gap-1">
                            {p.discount_price != null ? (
                              <>
                                <span className="font-bold text-rose-600">{formatPrice(p.discount_price, p.currency)}</span>
                                <span className="text-[9px] text-muted-foreground line-through">{formatPrice(p.price, p.currency)}</span>
                              </>
                            ) : (
                              <span className="font-bold text-success">{formatPrice(p.price, p.currency)}</span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                  {!isOwner && (
                    <div className="px-2 pb-2">
                      <button
                        onClick={() => void startConversation(p.id)}
                        disabled={contacting}
                        className="flex h-7 w-full items-center justify-center gap-1 rounded-md bg-primary/10 text-[10px] font-bold text-primary active:scale-[0.98] disabled:opacity-50"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {lang === "km" ? "សួរឥឡូវ" : "Ask now"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contact button */}
      {!isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] border-t border-border bg-surface px-5 py-3">
          <button
            onClick={() => void startConversation()}
            disabled={contacting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            {t("contact_supplier")}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        title={t("delete")}
        description={t("delete_confirm_desc")}
        destructive
        onConfirm={() => void deleteStore()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

const POST_TYPE_LABELS: Record<string, { en: string; km: string; bg: string; fg: string }> = {
  novedad:     { en: "New",       km: "ថ្មី",        bg: "bg-emerald-100", fg: "text-emerald-700" },
  stock:       { en: "Stock",     km: "ស្តុក",       bg: "bg-sky-100",     fg: "text-sky-700" },
  oferta:      { en: "Offer",     km: "ការផ្តល់ជូន",  bg: "bg-amber-100",   fg: "text-amber-700" },
  liquidacion: { en: "Clearance", km: "បោះតម្លៃ",    bg: "bg-rose-100",    fg: "text-rose-700" },
};

function Stat({ value, label, divider }: { value: number; label: string; divider?: boolean }) {
  return (
    <div className={`py-4 text-center ${divider ? "border-l border-border" : ""}`}>
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
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

function timeAgo(iso: string, lang: "km" | "en") {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return lang === "km" ? `${d} ថ្ងៃមុន` : `${d} day${d > 1 ? "s" : ""} ago`;
  const h = Math.floor(diff / 3600000);
  if (h >= 1) return lang === "km" ? `${h} ម៉ោងមុន` : `${h}h ago`;
  const m = Math.floor(diff / 60000);
  return lang === "km" ? `${Math.max(m, 1)} នាទីមុន` : `${Math.max(m, 1)}m ago`;
}
