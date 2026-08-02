import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, MessageCircle, Bell, BellRing, Tag, Flag, Clock } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/price";
import { timeAgo } from "@/lib/format";
import { catalogCopy } from "@/lib/catalog-copy";

type StockStatus = "in_stock" | "low" | "out";

interface Item {
  id: string;
  name_en: string;
  name_km: string | null;
  note: string | null;
  unit: string | null;
  price: number | null;
  currency: string;
  stock_status: StockStatus;
  stock_updated_at: string | null;
  photo_url: string | null;
  offer_active: boolean;
  offer_price: number | null;
  category_id: string | null;
  category: { id: string; name_en: string; name_km: string | null } | null;
}

type SortMode = "default" | "price_asc" | "price_desc" | "name";

export function StoreCatalog({
  storeId,
  isOwner,
  onAsk,
}: {
  storeId: string;
  isOwner: boolean;
  onAsk: (item: { id: string; name: string }) => void;
}) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("default");
  const [showSort, setShowSort] = useState(false);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("supplier_catalog_items")
        .select(
          "id,name_en,name_km,note,unit,price,currency,stock_status,stock_updated_at,in_stock,photo_url,offer_active,offer_price,category_id,supplier_categories(id,name_en,name_km)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        name_en: string;
        name_km: string | null;
        note: string | null;
        unit: string | null;
        price: number | null;
        currency: string | null;
        stock_status: string | null;
        stock_updated_at: string | null;
        in_stock: boolean | null;
        photo_url: string | null;
        offer_active: boolean | null;
        offer_price: number | null;
        category_id: string | null;
        supplier_categories: { id: string; name_en: string; name_km: string | null } | null;
      }>;
      const mapped: Item[] = rows.map((r) => ({
        id: r.id,
        name_en: r.name_en,
        name_km: r.name_km,
        note: r.note,
        unit: r.unit,
        price: r.price,
        currency: r.currency ?? "USD",
        stock_status: (r.stock_status as StockStatus | null) ?? (r.in_stock ? "in_stock" : "out"),
        stock_updated_at: r.stock_updated_at,
        photo_url: r.photo_url,
        offer_active: r.offer_active ?? false,
        offer_price: r.offer_price,
        category_id: r.category_id,
        category: r.supplier_categories,
      }));
      setItems(mapped);
      setLoading(false);

      if (user && !isOwner && mapped.length) {
        void supabase.from("catalog_item_events").insert(
          mapped.slice(0, 60).map((i) => ({
            item_id: i.id,
            store_id: storeId,
            user_id: user.id,
            event_type: "view",
          })),
        );
        const { data: subs } = await supabase
          .from("catalog_stock_notifications")
          .select("item_id")
          .eq("store_id", storeId)
          .eq("user_id", user.id);
        if (!cancelled) {
          setSubscribed(new Set(((subs ?? []) as Array<{ item_id: string }>).map((s) => s.item_id)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, user, isOwner]);

  const cats = useMemo(() => {
    const map = new Map<string, { id: string; name_en: string; name_km: string | null; n: number }>();
    items.forEach((i) => {
      if (!i.category) return;
      const prev = map.get(i.category.id);
      map.set(i.category.id, { ...i.category, n: (prev?.n ?? 0) + 1 });
    });
    return [...map.values()];
  }, [items]);

  const label = (i: { name_en: string; name_km: string | null }) =>
    lang === "km" && i.name_km ? i.name_km : i.name_en;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (activeCat) list = list.filter((i) => i.category_id === activeCat);
    if (q) {
      list = list.filter(
        (i) =>
          i.name_en.toLowerCase().includes(q) ||
          (i.name_km ?? "").toLowerCase().includes(q) ||
          (i.note ?? "").toLowerCase().includes(q),
      );
    }
    const effective = (i: Item) => (i.offer_active && i.offer_price != null ? i.offer_price : i.price);
    return [...list].sort((a, b) => {
      if (sort === "name") return label(a).localeCompare(label(b));
      if (sort === "price_asc" || sort === "price_desc") {
        const pa = effective(a);
        const pb = effective(b);
        if (pa == null) return 1;
        if (pb == null) return -1;
        return sort === "price_asc" ? pa - pb : pb - pa;
      }
      // default: available first
      const rank = (s: StockStatus) => (s === "out" ? 1 : 0);
      return rank(a.stock_status) - rank(b.stock_status);
    });
  }, [items, query, activeCat, sort, lang]);

  async function toggleNotify(item: Item) {
    if (!user) return;
    if (subscribed.has(item.id)) {
      await supabase
        .from("catalog_stock_notifications")
        .delete()
        .eq("item_id", item.id)
        .eq("user_id", user.id);
      setSubscribed((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      return;
    }
    const { error } = await supabase
      .from("catalog_stock_notifications")
      .insert({ item_id: item.id, store_id: storeId, user_id: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubscribed((prev) => new Set(prev).add(item.id));
    toast.success(c("notify_saved"));
  }

  if (loading) {
    return (
      <div className="border-b border-border bg-surface px-5 py-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="border-b border-border bg-surface px-5 py-4">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={c("search_in_store")}
          aria-label={c("search_in_store")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Category tabs */}
      <div className="-mx-5 mt-3 overflow-x-auto px-5 scrollbar-none">
        <div className="flex gap-1.5">
          <Tab active={activeCat === null} onClick={() => setActiveCat(null)}>
            {c("all_label")} ({items.length})
          </Tab>
          {cats.map((cat) => (
            <Tab key={cat.id} active={activeCat === cat.id} onClick={() => setActiveCat(cat.id)}>
              {label(cat)} ({cat.n})
            </Tab>
          ))}
        </div>
      </div>

      {/* Count + filter */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {visible.length} {c("products_count")}
        </p>
        <button
          type="button"
          onClick={() => setShowSort((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground active:scale-[0.97]"
        >
          <SlidersHorizontal className="h-3 w-3" />
          {c("filter_label")}
        </button>
      </div>

      {showSort && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              ["default", c("sort_available_first")],
              ["price_asc", c("sort_price_low")],
              ["price_desc", c("sort_price_high")],
              ["name", c("sort_by_name")],
            ] as Array<[SortMode, string]>
          ).map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSort(mode)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                sort === mode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* Product cards */}
      <div className="mt-3 space-y-2">
        {visible.map((item) => {
          const out = item.stock_status === "out";
          const showOffer = item.offer_active;
          const price =
            showOffer && item.offer_price != null ? item.offer_price : item.price;
          return (
            <div
              key={item.id}
              className={`flex gap-3 rounded-xl border border-border bg-card p-2.5 ${out ? "opacity-60" : ""}`}
            >
              {item.photo_url ? (
                <img
                  src={item.photo_url}
                  alt={label(item)}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                  📦
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  <p className="min-w-0 flex-1 text-[13px] font-bold text-foreground">{label(item)}</p>
                  {showOffer && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      <Tag className="h-3 w-3" />
                      {c("offer")}
                    </span>
                  )}
                </div>
                {item.note && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.note}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {price != null ? (
                    <p className="text-sm font-bold text-foreground">
                      {formatPrice(price, item.currency)}
                      {item.unit && (
                        <span className="text-[11px] font-normal text-muted-foreground"> / {item.unit}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">{c("ask_price")}</p>
                  )}
                  <StockBadge status={item.stock_status} lang={lang} />
                  {!isOwner && (
                    out ? (
                      <button
                        type="button"
                        onClick={() => void toggleNotify(item)}
                        className={`ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          subscribed.has(item.id)
                            ? "bg-amber-100 text-amber-700"
                            : "bg-muted text-foreground"
                        } active:scale-[0.97]`}
                      >
                        {subscribed.has(item.id) ? (
                          <BellRing className="h-3 w-3" />
                        ) : (
                          <Bell className="h-3 w-3" />
                        )}
                        {subscribed.has(item.id) ? c("notify_on") : c("notify_me")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAsk({ id: item.id, name: label(item) })}
                        className="ml-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground active:scale-[0.97]"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {c("ask")}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!visible.length && (
          <p className="py-6 text-center text-xs text-muted-foreground">{c("no_results")}</p>
        )}
      </div>
    </div>
  );
}

function Tab({
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
      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-background text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function StockBadge({ status, lang }: { status: StockStatus; lang: string }) {
  const map = {
    in_stock: {
      cls: "bg-emerald-100 text-emerald-700",
      text: lang === "km" ? "មានស្តុក" : "In stock",
    },
    low: { cls: "bg-amber-100 text-amber-700", text: lang === "km" ? "ស្តុកតិច" : "Low stock" },
    out: { cls: "bg-rose-100 text-rose-700", text: lang === "km" ? "អស់ស្តុក" : "Out of stock" },
  } as const;
  const m = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}>{m.text}</span>
  );
}
