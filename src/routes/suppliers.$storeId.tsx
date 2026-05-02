import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Phone, MessageCircle, Pencil, ShieldCheck, Store as StoreIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/suppliers/$storeId")({
  component: () => (
    <RequireAuth>
      <SupplierProfilePage />
    </RequireAuth>
  ),
});

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
          .select("id, content, created_at, post_photos(photo_url)")
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
        ((pp ?? []) as Array<{ id: string; content: string | null; created_at: string; post_photos: Array<{ photo_url: string }> }>).map((p) => ({
          id: p.id,
          content: p.content,
          created_at: p.created_at,
          photo_url: p.post_photos?.[0]?.photo_url ?? null,
        })),
      );

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
    <div className="min-h-screen bg-[#0d1424] pb-28">
      {/* Dramatic dark hero with amber gradient glow */}
      <div className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a2542] via-[#0f1a33] to-[#0d1424]" />
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-500/25 blur-3xl" />
        <div className="absolute -right-16 top-10 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative px-5 pb-14 pt-5 text-white">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <Link to="/suppliers" className="rounded-full bg-white/10 p-2 backdrop-blur active:bg-white/20">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/30">
              <StoreIcon className="h-3 w-3" /> {t("supplier_badge")}
            </span>
            {isOwner ? (
              <Link
                to="/suppliers/$storeId/edit"
                params={{ storeId }}
                className="rounded-full bg-white/10 p-2 backdrop-blur active:bg-white/20"
                aria-label={t("edit_store")}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            ) : (
              <span className="w-8" />
            )}
          </div>

          {/* Logo with gold ring */}
          <div className="mt-6 flex flex-col items-center">
            <div className="relative">
              {/* Decorative gold ring */}
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700" />
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 blur-md opacity-60" />
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="relative h-28 w-28 rounded-3xl bg-white object-cover"
                />
              ) : (
                <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-white text-3xl font-black text-[#0d1424]">
                  {initials(store.name)}
                </div>
              )}
              {/* Verified check badge */}
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 ring-4 ring-[#0f1a33]">
                <ShieldCheck className="h-4 w-4 text-[#0d1424]" />
              </div>
            </div>

            <h1 className="mt-5 text-center text-2xl font-black tracking-tight">{store.name}</h1>

            {store.location && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-white/70">
                <MapPin className="h-3 w-3 text-amber-300" /> {store.location}
              </p>
            )}

            {/* Categories */}
            {cats.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                {cats.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-200"
                  >
                    {lang === "km" ? c.name_km : c.name_en}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Diagonal divider with stat strip */}
        <div className="relative -mb-px">
          <svg
            className="block h-6 w-full text-background"
            viewBox="0 0 100 6"
            preserveAspectRatio="none"
          >
            <polygon points="0,6 100,0 100,6" fill="currentColor" />
          </svg>
        </div>
      </div>

      {/* Floating stats card */}
      <div className="-mt-8 px-4">
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          <Stat value={postsCount} label={t("posts_label")} />
          <Stat value={store.view_count ?? 0} label={t("views_label")} divider />
          <Stat value={store.contact_count ?? 0} label={t("contacts_label")} divider />
        </div>
      </div>

      {/* About */}
      {(store.description || store.phone) && (
        <Section icon="info" title={t("about_label")}>
          {store.description && (
            <p className="text-sm leading-relaxed text-foreground">{store.description}</p>
          )}
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-sm font-bold text-amber-700 ring-1 ring-amber-400/40 active:scale-95"
            >
              <Phone className="h-4 w-4" /> {store.phone}
            </a>
          )}
        </Section>
      )}

      {/* Featured products bento */}
      {photos.length > 0 && (
        <Section
          icon="star"
          title={t("featured_products")}
          count={photos.length}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p, i) => {
              // First photo spans 2x2 for hero feel
              const span = i === 0 && photos.length >= 3 ? "col-span-2 row-span-2 aspect-square" : "aspect-square";
              return (
                <div
                  key={i}
                  className={`${span} group relative overflow-hidden rounded-xl bg-muted ring-1 ring-black/5`}
                >
                  <img src={p} alt="" className="h-full w-full object-cover transition group-active:scale-105" />
                  {i === 0 && photos.length >= 3 && (
                    <div className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0d1424]">
                      ★ Featured
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Recent posts */}
      {posts.length > 0 && (
        <Section icon="post" title={t("recent_posts")}>
          <div className="space-y-2">
            {posts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition active:scale-[0.99]"
              >
                {p.photo_url ? (
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-black/5">
                    <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-foreground">
                    {p.content?.split("\n")[0] || "Post"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(p.created_at, lang)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Contact button */}
      {!isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <button
            onClick={startConversation}
            disabled={contacting}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/30 active:scale-[0.98] disabled:opacity-50"
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
      <p className="text-2xl font-black text-foreground">{formatN(value)}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count?: number;
  icon: "info" | "star" | "post";
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 px-4">
      <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-amber-400" />
          <h3 className="text-sm font-bold text-foreground">
            {title}
            {typeof count === "number" && (
              <span className="ml-1.5 font-medium text-muted-foreground">({count})</span>
            )}
          </h3>
        </div>
        {children}
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

function formatN(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
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
