import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { StoreCatalog } from "@/components/StoreCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { catalogCopy } from "@/lib/catalog-copy";

export const Route = createFileRoute("/suppliers/$storeId/catalog/products")({
  head: () => ({
    meta: [
      { title: "Supplier Catalogue — All Products | BuildHub" },
      {
        name: "description",
        content:
          "Browse every product in this supplier's catalogue on BuildHub Cambodia. Filter by category, compare prices and check stock before you contact them.",
      },
      { property: "og:title", content: "Supplier Catalogue — All Products | BuildHub" },
      {
        property: "og:description",
        content:
          "Browse every product in this supplier's catalogue on BuildHub Cambodia. Filter by category, compare prices and check stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogProductsPage,
});

function CatalogProductsPage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);
  const [store, setStore] = useState<{ id: string; name: string; user_id: string } | null>(null);

  useEffect(() => {
    void supabase
      .from("supplier_stores")
      .select("id, name, user_id")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => setStore(data ?? null));
  }, [storeId]);

  const isOwner = !!user && !!store && user.id === store.user_id;

  async function startConversation() {
    if (!user || !store) {
      nav({ to: "/login" });
      return;
    }
    if (user.id === store.user_id) return;
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
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-primary px-2 text-primary-foreground">
        <Link
          to="/suppliers/$storeId"
          params={{ storeId }}
          className="rounded-full p-2 active:bg-white/10"
          aria-label={lang === "km" ? "ត្រឡប់" : "Back"}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">
            {lang === "km" ? "កាតាឡុកផលិតផល" : "Catalogue"}
          </h1>
          {store?.name && <p className="truncate text-[11px] text-white/80">{store.name}</p>}
        </div>
      </header>

      <div className="flex-1 pb-24">
        <StoreCatalog
          storeId={storeId}
          isOwner={isOwner}
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
      </div>
    </div>
  );
}
