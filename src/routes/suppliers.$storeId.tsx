import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Phone, MessageCircle } from "lucide-react";
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
}

function SupplierProfilePage() {
  const { storeId } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [cats, setCats] = useState<SupplierCategory[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase
        .from("supplier_stores")
        .select("id, user_id, name, location, description, logo_url, phone")
        .eq("id", storeId)
        .maybeSingle();
      setStore(s ?? null);
      const [{ data: scs }, { data: ph }] = await Promise.all([
        supabase
          .from("supplier_store_categories")
          .select("supplier_categories(id, name_en, name_km)")
          .eq("store_id", storeId),
        supabase
          .from("supplier_store_photos")
          .select("photo_url")
          .eq("store_id", storeId)
          .order("sort_order"),
      ]);
      setCats(
        ((scs ?? []) as Array<{ supplier_categories: SupplierCategory }>)
          .map((r) => r.supplier_categories)
          .filter(Boolean),
      );
      setPhotos(((ph ?? []) as Array<{ photo_url: string }>).map((p) => p.photo_url));
    })();
  }, [storeId]);

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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Blue header */}
      <div className="bg-primary px-5 pb-8 pt-5 text-primary-foreground">
        <div className="flex items-center justify-between">
          <Link to="/suppliers" className="rounded-full p-1 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-base font-semibold">{store.name}</h2>
          <span className="w-7" />
        </div>
        <div className="mt-6 flex flex-col items-center">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-24 w-24 rounded-2xl bg-white object-cover shadow-card"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white text-xl font-bold text-primary shadow-card">
              {initials(store.name)}
            </div>
          )}
          <h1 className="mt-3 text-lg font-bold">{store.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold">
              {t("supplier_badge")} ✓
            </span>
            {cats.map((c) => (
              <span key={c.id} className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium">
                {lang === "km" ? c.name_km : c.name_en}
              </span>
            ))}
          </div>
          {store.location && (
            <p className="mt-2 flex items-center gap-1 text-xs opacity-90">
              <MapPin className="h-3 w-3" /> {store.location}
            </p>
          )}
        </div>
      </div>

      {/* About */}
      {store.description && (
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-xs font-semibold text-foreground">{t("about_label")}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{store.description}</p>
          {store.phone && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
              <Phone className="h-4 w-4" /> {store.phone}
            </p>
          )}
        </div>
      )}

      {/* Featured products */}
      {photos.length > 0 && (
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-xs font-semibold text-foreground">
            {t("featured_products")} ({photos.length})
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-md bg-muted">
                <img src={p} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact button */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-5 py-3">
        <button
          onClick={startConversation}
          disabled={contacting || user?.id === store.user_id}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
        >
          <MessageCircle className="h-4 w-4" />
          {t("contact_supplier")}
        </button>
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
