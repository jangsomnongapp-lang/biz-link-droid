import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  AlertTriangle,
  Flame,
  Eye,
  MessageCircle,
  Pencil,
  Tag,
  Trash2,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { catalogCopy } from "@/lib/catalog-copy";

export const Route = createFileRoute("/suppliers/$storeId/catalog/manage")({
  head: () => ({
    meta: [
      { title: "My Catalogue — Supplier Panel | BuildHub" },
      {
        name: "description",
        content:
          "Private supplier panel: track catalogue views, chats, weekly requests, market prices and stock status for every product in your BuildHub store.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "My Catalogue — Supplier Panel | BuildHub" },
      {
        property: "og:description",
        content: "Manage your BuildHub catalogue: stock, prices and demand insights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <CatalogManagePage />
    </RequireAuth>
  ),
});

type StockStatus = "in_stock" | "low" | "out";

interface PanelItem {
  id: string;
  name_en: string;
  name_km: string | null;
  unit: string | null;
  price: number | null;
  currency: string | null;
  stock_status: StockStatus;
  photo_url: string | null;
  category_id: string | null;
  market_min: number | null;
  market_max: number | null;
  views: number;
  chats: number;
  requests_week: number;
  offer_active: boolean;
  offer_price: number | null;
}

interface PanelStats {
  total_products: number;
  category_count: number;
  in_stock: number;
  out_of_stock: number;
  requests_week: number;
  requests_prev_week: number;
  most_requested: { id: string; name: string; requests: number } | null;
  alert: { id: string; name: string; requests: number } | null;
  items: Array<{ id: string; views: number; chats: number; requests_week: number }>;
}

const NEXT_STATUS: Record<StockStatus, StockStatus> = {
  in_stock: "low",
  low: "out",
  out: "in_stock",
};

function CatalogManagePage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);

  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState<PanelItem[]>([]);
  const [cats, setCats] = useState<Array<{ id: string; name_en: string; name_km: string | null }>>([]);
  const [stats, setStats] = useState<PanelStats | null>(null);
  const [market, setMarket] = useState<Array<{ term: string; search_count: number }>>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [sortByRequests, setSortByRequests] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: store } = await supabase
        .from("supplier_stores")
        .select("user_id,name,location")
        .eq("id", storeId)
        .maybeSingle();
      if (cancelled) return;
      if (store && user && store.user_id !== user.id) {
        nav({ to: "/suppliers/$storeId", params: { storeId } });
        return;
      }
      setStoreName(store?.name ?? "");

      const rpc = supabase.rpc as unknown as (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const [itemsRes, statsRes, marketRes] = await Promise.all([
        supabase
          .from("supplier_catalog_items")
          .select(
            "id,name_en,name_km,unit,price,currency,stock_status,in_stock,photo_url,category_id,catalog_products(market_price_min,market_price_max),supplier_categories(id,name_en,name_km)",
          )
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
        rpc("catalog_panel_stats", { _store_id: storeId }),
        rpc("catalog_market_searches", { _province: store?.location ?? null, _limit: 6 }),
      ]);
      if (cancelled) return;

      const s = (statsRes.data as PanelStats | null) ?? null;
      const perItem = new Map(
        (s?.items ?? []).map((row) => [row.id, row] as const),
      );
      const rows = (itemsRes.data ?? []) as unknown as Array<{
        id: string;
        name_en: string;
        name_km: string | null;
        unit: string | null;
        price: number | null;
        currency: string | null;
        stock_status: string | null;
        in_stock: boolean | null;
        photo_url: string | null;
        category_id: string | null;
        catalog_products: { market_price_min: number | null; market_price_max: number | null } | null;
        supplier_categories: { id: string; name_en: string; name_km: string | null } | null;
      }>;

      setItems(
        rows.map((row) => {
          const metrics = perItem.get(row.id);
          return {
            id: row.id,
            name_en: row.name_en,
            name_km: row.name_km,
            unit: row.unit,
            price: row.price,
            currency: row.currency ?? "USD",
            stock_status:
              (row.stock_status as StockStatus | null) ?? (row.in_stock ? "in_stock" : "out"),
            photo_url: row.photo_url,
            category_id: row.category_id,
            market_min: row.catalog_products?.market_price_min ?? null,
            market_max: row.catalog_products?.market_price_max ?? null,
            views: metrics?.views ?? 0,
            chats: metrics?.chats ?? 0,
            requests_week: metrics?.requests_week ?? 0,
          };
        }),
      );
      const catMap = new Map<string, { id: string; name_en: string; name_km: string | null }>();
      rows.forEach((row) => {
        if (row.supplier_categories) catMap.set(row.supplier_categories.id, row.supplier_categories);
      });
      setCats([...catMap.values()]);
      setStats(s);
      setMarket((marketRes.data as Array<{ term: string; search_count: number }> | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, user, nav]);

  const label = (item: { name_en: string; name_km: string | null }) =>
    lang === "km" && item.name_km ? item.name_km : item.name_en;

  const visible = useMemo(() => {
    const list = activeCat ? items.filter((i) => i.category_id === activeCat) : items;
    return [...list].sort((a, b) =>
      sortByRequests
        ? b.requests_week - a.requests_week || a.name_en.localeCompare(b.name_en)
        : a.name_en.localeCompare(b.name_en),
    );
  }, [items, activeCat, sortByRequests]);

  async function cycleStock(item: PanelItem) {
    const next = NEXT_STATUS[item.stock_status];
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock_status: next } : i)));
    const { error } = await supabase
      .from("supplier_catalog_items")
      .update({ stock_status: next, in_stock: next !== "out" })
      .eq("id", item.id);
    if (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, stock_status: item.stock_status } : i)),
      );
      toast.error(error.message);
    }
  }

  async function removeItem(item: PanelItem) {
    if (!window.confirm(c("remove_confirm"))) return;
    const { error } = await supabase.from("supplier_catalog_items").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.success(c("removed"));
  }

  const diff = (stats?.requests_week ?? 0) - (stats?.requests_prev_week ?? 0);
  const maxSearch = market.length ? Math.max(...market.map((m) => m.search_count)) : 0;

  return (
    <div className="min-h-screen bg-[#0f1420] pb-28 text-white">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-[#0f1420]/95 px-3 py-3 backdrop-blur">
        <Link
          to="/suppliers/$storeId"
          params={{ storeId }}
          className="rounded-full p-1.5 active:bg-white/10"
          aria-label={c("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold">{c("my_catalogue")}</h1>
          <p className="truncate text-[11px] text-white/60">{storeName}</p>
        </div>
        <Link
          to="/suppliers/$storeId/catalog"
          params={{ storeId }}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" /> {c("add_product")}
        </Link>
      </header>

      <div className="space-y-3 p-3">
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard
            label={c("total_products")}
            value={loading ? "—" : String(stats?.total_products ?? 0)}
            hint={c("across_categories").replace("{n}", String(stats?.category_count ?? 0))}
          />
          <MetricCard
            label={c("requests_this_week")}
            value={loading ? "—" : String(stats?.requests_week ?? 0)}
            hint={
              diff > 0
                ? `↑ ${c("vs_last_week_up").replace("{n}", String(diff))}`
                : diff < 0
                  ? `↓ ${c("vs_last_week_down").replace("{n}", String(-diff))}`
                  : c("vs_last_week_same")
            }
            hintClass={diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-white/50"}
          />
          <MetricCard
            label={c("in_stock_card")}
            value={loading ? "—" : String(stats?.in_stock ?? 0)}
            hint={c("out_of_stock_count").replace("{n}", String(stats?.out_of_stock ?? 0))}
          />
          <MetricCard
            label={c("most_requested")}
            value={stats?.most_requested?.name ?? "—"}
            valueSmall
            hint={
              stats?.most_requested
                ? `↑ ${c("requests_this_week_short").replace("{n}", String(stats.most_requested.requests))}`
                : c("no_market_data")
            }
            hintClass="text-emerald-400"
          />
        </div>

        {/* Out-of-stock alert */}
        {stats?.alert && (
          <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-[12px] leading-relaxed text-amber-200">
              {c("stock_alert")
                .replace("{name}", stats.alert.name)
                .replace("{n}", String(stats.alert.requests))}
            </p>
          </div>
        )}

        {/* Market intelligence */}
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold">
            <Flame className="h-4 w-4 text-orange-400" /> {c("most_searched_week")}
          </h2>
          {market.length ? (
            <ul className="mt-2.5 space-y-2">
              {market.map((row) => (
                <li key={row.term} className="flex items-center gap-2">
                  <span className="w-[42%] truncate text-[11px] capitalize text-white/80">
                    {row.term}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(6, (row.search_count / maxSearch) * 100)}%` }}
                    />
                  </span>
                  <span className="w-6 text-right text-[11px] font-bold text-white/70">
                    {row.search_count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/50">
              <BarChart3 className="h-3.5 w-3.5" /> {c("no_market_data")}
            </p>
          )}
        </section>

        {/* Category filter */}
        {cats.length > 0 && (
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 scrollbar-none">
            <Chip active={!activeCat} onClick={() => setActiveCat(null)}>
              {c("all_label")} ({items.length})
            </Chip>
            {cats.map((cat) => (
              <Chip
                key={cat.id}
                active={activeCat === cat.id}
                onClick={() => setActiveCat(cat.id)}
              >
                {label(cat)} ({items.filter((i) => i.category_id === cat.id).length})
              </Chip>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">
            {c("products_label")}
          </p>
          <button
            type="button"
            onClick={() => setSortByRequests((v) => !v)}
            className="text-[11px] font-semibold text-primary"
          >
            {sortByRequests ? c("sort_by_requests") : c("sort_by_name")}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        ) : visible.length ? (
          <ul className="space-y-2.5">
            {visible.map((item) => (
              <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={label(item)} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
                        {lang === "km" ? "គ្មានរូប" : "No photo"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{label(item)}</p>
                    <p className="mt-0.5 text-[12px] text-white/70">
                      {item.price != null
                        ? `${item.currency === "KHR" ? "៛" : "$"}${item.price}${item.unit ? ` / ${item.unit}` : ""}`
                        : "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => void cycleStock(item)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${stockClass(item.stock_status)}`}
                    >
                      {stockLabel(item.stock_status, lang)}
                    </button>
                    <span className="text-[10px] text-white/45">
                      {item.requests_week} {lang === "km" ? "សំណើ" : "requests"}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[11px] text-white/65">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {c("views_short")}: {item.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {c("chats_short")}: {item.chats}
                  </span>
                  <MarketDelta item={item} onRangeLabel={c("on_range")} noDataLabel={c("no_market")} prefix={c("vs_market")} />
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <Link
                    to="/suppliers/$storeId/catalog/list"
                    params={{ storeId }}
                    className="flex items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-[11px] font-bold active:scale-[0.98]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {c("edit")}
                  </Link>
                  <Link
                    to="/posts/new"
                    className="flex items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-[11px] font-bold active:scale-[0.98]"
                  >
                    <Tag className="h-3.5 w-3.5" /> {c("offer")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeItem(item)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-rose-500/20 py-2 text-[11px] font-bold text-rose-300 active:scale-[0.98]"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {c("remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center text-[12px] text-white/60">
            {c("empty_catalog")}
          </p>
        )}

        <div className="pt-1 text-center">
          <Link
            to="/suppliers/$storeId/catalog/stats"
            params={{ storeId }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
          >
            <BarChart3 className="h-3.5 w-3.5" /> {c("view_stats")}
          </Link>
        </div>

        <p className="pt-1 text-center text-[10px] text-white/35">{c("internal_panel_note")}</p>
      </div>
    </div>
  );
}

function MarketDelta({
  item,
  prefix,
  onRangeLabel,
  noDataLabel,
}: {
  item: PanelItem;
  prefix: string;
  onRangeLabel: string;
  noDataLabel: string;
}) {
  if (item.price == null || item.market_min == null || item.market_max == null) {
    return <span className="text-white/40">{`${prefix}: ${noDataLabel}`}</span>;
  }
  if (item.price < item.market_min) {
    return (
      <span className="font-bold text-emerald-400">
        {prefix}: -${(item.market_min - item.price).toFixed(2)}
      </span>
    );
  }
  if (item.price > item.market_max) {
    return (
      <span className="font-bold text-rose-400">
        {prefix}: +${(item.price - item.market_max).toFixed(2)}
      </span>
    );
  }
  return <span className="text-white/55">{`${prefix}: ${onRangeLabel}`}</span>;
}

function stockClass(status: StockStatus) {
  if (status === "in_stock") return "bg-emerald-500/20 text-emerald-300";
  if (status === "low") return "bg-amber-500/20 text-amber-300";
  return "bg-rose-500/20 text-rose-300";
}

function stockLabel(status: StockStatus, lang: string) {
  const map = {
    in_stock: { en: "In stock", km: "មានស្តុក" },
    low: { en: "Low stock", km: "ស្តុកតិច" },
    out: { en: "Out of stock", km: "អស់ស្តុក" },
  } as const;
  return lang === "km" ? map[status].km : map[status].en;
}

function MetricCard({
  label,
  value,
  hint,
  hintClass = "text-white/50",
  valueSmall,
}: {
  label: string;
  value: string;
  hint: string;
  hintClass?: string;
  valueSmall?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
      <p className={`mt-1 font-bold ${valueSmall ? "line-clamp-2 text-[12px] leading-snug" : "text-2xl"}`}>
        {value}
      </p>
      <p className={`mt-1 text-[10px] ${hintClass}`}>{hint}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
        active ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70"
      }`}
    >
      {children}
    </button>
  );
}
