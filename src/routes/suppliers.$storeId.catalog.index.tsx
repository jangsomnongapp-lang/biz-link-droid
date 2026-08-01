import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ClipboardList, FileSpreadsheet, Camera, Info } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { catalogCopy } from "@/lib/catalog-copy";

export const Route = createFileRoute("/suppliers/$storeId/catalog/")({
  head: () => ({
    meta: [
      { title: "Supplier Catalogue — Add Products | BuildHub" },
      {
        name: "description",
        content:
          "Build your construction store catalogue on BuildHub: pick from the common Cambodian product list, import a price list, or add products by photo.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Supplier Catalogue — Add Products | BuildHub" },
      {
        property: "og:description",
        content: "Add products to your BuildHub supplier catalogue in three easy ways.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <CatalogMethodsPage />
    </RequireAuth>
  ),
});

function CatalogMethodsPage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);
  const [items, setItems] = useState<{ id: string; name_en: string; name_km: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: store } = await supabase
        .from("supplier_stores")
        .select("user_id")
        .eq("id", storeId)
        .maybeSingle();
      if (!cancelled && store && user && store.user_id !== user.id) {
        nav({ to: "/suppliers/$storeId", params: { storeId } });
        return;
      }
      const { data } = await supabase
        .from("supplier_catalog_items")
        .select("id,name_en,name_km")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (!cancelled) {
        setItems(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, user, nav]);

  const label = (item: { name_en: string; name_km: string | null }) =>
    lang === "km" && item.name_km ? item.name_km : item.name_en;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-primary px-3 py-3 text-primary-foreground">
        <Link
          to="/suppliers/$storeId"
          params={{ storeId }}
          className="rounded-full p-1.5 active:bg-white/10"
          aria-label={c("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold">{c("catalog_add_title")}</h1>
          <p className="truncate text-[11px] opacity-80">{c("catalog_add_sub")}</p>
        </div>
      </header>

      <div className="space-y-3 p-3">
        <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {c("choose_method")}
        </p>

        <MethodCard
          to="/suppliers/$storeId/catalog/list"
          storeId={storeId}
          icon={<ClipboardList className="h-5 w-5" />}
          title={c("method_list")}
          desc={c("method_list_desc")}
          badge={c("recommended_first")}
          highlight
        />
        <MethodCard
          to="/suppliers/$storeId/catalog/import"
          storeId={storeId}
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title={c("method_import")}
          desc={c("method_import_desc")}
        />
        <MethodCard
          to="/suppliers/$storeId/catalog/photo"
          storeId={storeId}
          icon={<Camera className="h-5 w-5" />}
          title={c("method_photo")}
          desc={c("method_photo_desc")}
        />

        <div className="flex gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">{c("methods_note")}</p>
        </div>

        <div className="rounded-xl bg-surface p-3 shadow-card">
          <p className="text-sm font-bold text-foreground">
            {c("my_catalog")}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {items.length} {c("catalog_items")}
            </span>
          </p>
          {loading ? (
            <div className="mt-2 space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-6 w-2/3 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
          ) : items.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {items.slice(0, 8).map((item) => (
                <span
                  key={item.id}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  ✓ {label(item)}
                </span>
              ))}
              {items.length > 8 && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  +{items.length - 8}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{c("empty_catalog")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodCard({
  to,
  storeId,
  icon,
  title,
  desc,
  badge,
  highlight,
}: {
  to: "/suppliers/$storeId/catalog/list" | "/suppliers/$storeId/catalog/import" | "/suppliers/$storeId/catalog/photo";
  storeId: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      params={{ storeId }}
      className={`flex items-start gap-3 rounded-xl bg-surface p-3 shadow-card transition active:scale-[0.99] ${
        highlight ? "border-[1.5px] border-primary" : "border border-border"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{desc}</span>
        {badge && (
          <span className="mt-1.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            {badge}
          </span>
        )}
      </span>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
