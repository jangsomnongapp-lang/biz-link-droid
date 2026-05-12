import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MoreHorizontal, MapPin, Phone, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { ShareButton } from "@/components/ShareButton";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/suppliers/$storeId")({
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
  phone: string | null;
  view_count: number;
  contact_count: number;
}

interface RecentPost {
  id: string;
  content: string | null;
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
  const [contacting, setContacting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);

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
        .select("id, user_id, name, location, description, logo_url, phone, view_count, contact_count")
        .eq("id", storeId)
        .maybeSingle();
      setStore(s ?? null);
      if (!s) return;

      const [{ data: scs }, { data: ph }, { count }, { data: pp }] = await Promise.all([
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
          .select("id, content, created_at, view_count, post_photos(photo_url)")
          .eq("user_id", s.user_id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setCats(
        ((scs ?? []) as Array<{ supplier_categories: SupplierCategory }>)
          .map((r) => r.supplier_categories)
          .filter(Boolean),
      );
      setPhotos(((ph ?? []) as Array<{ photo_url: string }>).map((p) => p.photo_url));
      setPostsCount(count ?? 0);
      setPosts(
        ((pp ?? []) as Array<{ id: string; content: string | null; created_at: string; view_count: number | null; post_photos: Array<{ photo_url: string }> }>).map((p) => ({
          id: p.id,
          content: p.content,
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

  async function startConversation() {
    if (!user || !store) return;
    if (user.id === store.user_id) return;
    setContacting(true);
    try {
      const [a, b] = [user.id, store.user_id].sort();
      const { data: existing } = await supabase
        .from("message_threads")
        .select("id")
        .eq("participant_a", a)
        .eq("participant_b", b)
        .maybeSingle();
      let threadId = existing?.id;
      if (!threadId) {
        const { data: created, error } = await supabase
          .from("message_threads")
          .insert({ participant_a: a, participant_b: b })
          .select("id")
          .single();
        if (error) throw error;
        threadId = created.id;
      }
      void supabase.rpc("increment_supplier_contact", { _store_id: storeId });
      nav({ to: "/messages/$threadId", params: { threadId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContacting(false);
    }
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
          <h2 className="text-base font-semibold">Supplier Profile</h2>
          <div className="flex items-center gap-1">
            <ShareButton
              path={`/suppliers/${storeId}`}
              title={store.name}
              className="rounded-full p-1 active:bg-white/10"
            />
            {isOwner ? (
              <Link
                to="/suppliers/$storeId/edit"
                params={{ storeId }}
                className="rounded-full p-1 active:bg-white/10"
                aria-label={t("edit_store")}
              >
                <Pencil className="h-5 w-5" />
              </Link>
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
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-b border-border bg-surface">
        <Stat value={postsCount} label={t("posts_label")} />
        <Stat value={store.view_count ?? 0} label={t("views_label")} divider />
        <Stat value={store.contact_count ?? 0} label={t("contacts_label")} divider />
      </div>

      {/* About */}
      {(store.description || store.phone) && (
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-foreground">{t("about_label")}</p>
          {store.description && (
            <p className="mt-1.5 text-sm text-muted-foreground">{store.description}</p>
          )}
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary"
            >
              <Phone className="h-4 w-4" /> {store.phone}
            </a>
          )}
        </div>
      )}

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

      {/* Recent posts */}
      {posts.length > 0 && (
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-foreground">{t("recent_posts")}</p>
          <div className="mt-3 space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {p.content?.split("\n")[0] || "Post"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(p.created_at, lang)} · {p.view_count} {lang === "km" ? "មើល" : `view${p.view_count === 1 ? "" : "s"}`}
                  </p>
                </div>
                {p.photo_url && (
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact button */}
      {!isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] border-t border-border bg-surface px-5 py-3">
          <button
            onClick={startConversation}
            disabled={contacting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            {t("contact_supplier")}
          </button>
        </div>
      )}
    </div>
  );
}

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
