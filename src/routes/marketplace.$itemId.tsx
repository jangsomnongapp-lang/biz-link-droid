import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Trash2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/price";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ItemDetail {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  location: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  marketplace_item_photos: { photo_url: string }[];
}

export const Route = createFileRoute("/marketplace/$itemId")({
  component: () => (
    <RequireAuth>
      <MarketplaceItemPage />
    </RequireAuth>
  ),
});

function MarketplaceItemPage() {
  const { itemId } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const km = lang === "km";

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from("marketplace_items")
      .select("id, user_id, kind, title, description, price, currency, location, status, created_at, profiles(full_name, avatar_url), marketplace_item_photos(photo_url)")
      .eq("id", itemId)
      .maybeSingle()
      .then(({ data }) => {
        setItem((data as ItemDetail | null) ?? null);
        setLoading(false);
      });
  }, [itemId]);

  const isMine = user?.id === item?.user_id;
  const photos = item?.marketplace_item_photos ?? [];

  async function markSold() {
    if (!item || !isMine) return;
    setBusy(true);
    const { error } = await supabase
      .from("marketplace_items")
      .update({ status: item.status === "sold" ? "active" : "sold" })
      .eq("id", item.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItem({ ...item, status: item.status === "sold" ? "active" : "sold" });
  }

  async function deleteItem() {
    if (!item || !isMine) return;
    setBusy(true);
    const { error } = await supabase.from("marketplace_items").delete().eq("id", item.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(km ? "បានលុប" : "Deleted");
    nav({ to: "/suppliers", search: { mode: item.kind === "secondhand" ? "secondhand" : "retail" } });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-[#1a56a0] px-2 text-white">
        <Link
          to="/suppliers"
          search={{ mode: item?.kind === "secondhand" ? "secondhand" : "retail" }}
          className="rounded-full p-2 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {item?.kind === "secondhand" ? t("tab_secondhand") : t("tab_retails")}
        </h1>
        <div className="w-9" />
      </header>

      {loading ? (
        <div className="p-3">
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !item ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {km ? "រកមិនឃើញទំនិញ" : "Item not found"}
        </p>
      ) : (
        <div className="flex-1 pb-24">
          {photos.length > 0 && (
            <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {photos.map((p) => (
                <img
                  key={p.photo_url}
                  src={p.photo_url}
                  alt={item.title}
                  className="aspect-square w-full shrink-0 snap-center object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          )}

          <div className="space-y-3 p-3">
            <div className="rounded-2xl bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">{item.title}</h2>
                {item.status === "sold" && (
                  <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                    {t("sold_badge")}
                  </span>
                )}
              </div>
              {item.price != null && (
                <p className="mt-1 text-xl font-bold text-success">{formatPrice(item.price, item.currency)}</p>
              )}
              {item.location && (
                <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {item.location}
                </p>
              )}
            </div>

            {item.description && (
              <div className="rounded-2xl bg-surface p-4 shadow-card">
                <p className="whitespace-pre-line text-sm text-foreground">{item.description}</p>
              </div>
            )}

            <Link
              to="/users/$userId"
              params={{ userId: item.user_id }}
              className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card active:scale-[0.99]"
            >
              {item.profiles?.avatar_url ? (
                <img src={item.profiles.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  {item.profiles?.full_name ?? (km ? "អ្នកលក់" : "Seller")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {km ? "មើលប្រវត្តិអ្នកលក់" : "View seller profile"}
                </p>
              </div>
            </Link>

            {isMine && (
              <div className="flex gap-2">
                <button
                  onClick={() => void markSold()}
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-50"
                >
                  {item.status === "sold" ? (km ? "ដាក់លក់វិញ" : "Relist") : t("mark_as_sold")}
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-destructive active:scale-[0.99] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        title={km ? "លុបទំនិញនេះ?" : "Delete this item?"}
        description={km ? "សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ" : "This cannot be undone."}
        confirmLabel={km ? "លុប" : "Delete"}
        destructive
        onConfirm={() => void deleteItem()}
      />
    </div>
  );
}
