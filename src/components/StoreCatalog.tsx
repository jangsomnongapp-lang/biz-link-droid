import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, MessageCircle, Bell, BellRing, Tag, Flag, Clock } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/price";
import { timeAgo } from "@/lib/format";
import { catalogCopy } from "@/lib/catalog-copy";

type StockStatus = "in_stock" | "low" | "out";

interface Cat {
  id: string;
  code: string;
  name_en: string;
  name_km: string | null;
}

interface Entry {
  kind: "item" | "post";
  id: string;
  name_en: string;
  name_km: string | null;
  note: string | null;
  unit: string | null;
  price: number | null;
  old_price: number | null;
  currency: string;
  stock_status: StockStatus | null;
  stock_updated_at: string | null;
  photo_url: string | null;
  offer_active: boolean;
  post_type: string | null;
  cat_id: string | null;
}

type SortMode = "default" | "price_asc" | "price_desc" | "name";
type SourceMode = "all" | "item" | "post";

const POST_TYPE_LABELS: Record<string, { en: string; km: string; cls: string }> = {
  novedad: { en: "New", km: "ថ្មី", cls: "bg-emerald-100 text-emerald-700" },
  stock: { en: "Stock", km: "ស្តុក", cls: "bg-sky-100 text-sky-700" },
  oferta: { en: "Offer", km: "ការផ្តល់ជូន", cls: "bg-amber-100 text-amber-700" },
  liquidacion: { en: "Clearance", km: "បោះតម្លៃ", cls: "bg-rose-100 text-rose-700" },
};

export function StoreCatalog({
  storeId,
  isOwner,
  onAsk,
  onAskPost,
}: {
  storeId: string;
  isOwner: boolean;
  onAsk: (item: { id: string; name: string }) => void;
  onAskPost?: (postId: string) => void;
}) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [catMap, setCatMap] = useState<Map<string, Cat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [source, setSource] = useState<SourceMode>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [showSort, setShowSort] = useState(false);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [reportItem, setReportItem] = useState<Entry | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ data: catRows }, { data: store }, { data: itemRows }] = await Promise.all([
        supabase.from("supplier_categories").select("id,code,name_en,name_km"),
        supabase.from("supplier_stores").select("user_id").eq("id", storeId).maybeSingle(),
        supabase
          .from("supplier_catalog_items")
          .select(
            "id,name_en,name_km,note,unit,price,currency,stock_status,stock_updated_at,in_stock,photo_url,offer_active,offer_price,category_id",
          )
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const cm = new Map<string, Cat>();
      const byCode = new Map<string, Cat>();
      ((catRows ?? []) as Cat[]).forEach((r) => {
        cm.set(r.id, r);
        byCode.set(r.code, r);
      });
      setCatMap(cm);

      const items: Entry[] = (
        (itemRows ?? []) as unknown as Array<{
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
        }>
      ).map((r) => {
        const offer = (r.offer_active ?? false) && r.offer_price != null;
        return {
          kind: "item" as const,
          id: r.id,
          name_en: r.name_en,
          name_km: r.name_km,
          note: r.note,
          unit: r.unit,
          price: offer ? r.offer_price : r.price,
          old_price: offer ? r.price : null,
          currency: r.currency ?? "USD",
          stock_status: (r.stock_status as StockStatus | null) ?? (r.in_stock ? "in_stock" : "out"),
          stock_updated_at: r.stock_updated_at,
          photo_url: r.photo_url,
          offer_active: r.offer_active ?? false,
          post_type: null,
          cat_id: r.category_id,
        };
      });

      let posts: Entry[] = [];
      if (store?.user_id) {
        const { data: postRows } = await supabase
          .from("posts")
          .select(
            "id,title,content,price,discount_price,currency,post_type,category,created_at,post_photos(photo_url)",
          )
          .eq("user_id", store.user_id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(100);
        if (cancelled) return;
        posts = (
          (postRows ?? []) as unknown as Array<{
            id: string;
            title: string | null;
            content: string | null;
            price: number | null;
            discount_price: number | null;
            currency: string | null;
            post_type: string | null;
            category: string | null;
            created_at: string;
            post_photos: Array<{ photo_url: string }>;
          }>
        )
          .filter((p) => p.title || p.price != null || p.category)
          .map((p) => ({
            kind: "post" as const,
            id: p.id,
            name_en: p.title || p.content?.split("\n")[0] || "Product",
            name_km: null,
            note: p.title ? (p.content?.split("\n")[0] ?? null) : null,
            unit: null,
            price: p.discount_price ?? p.price,
            old_price: p.discount_price != null ? p.price : null,
            currency: p.currency ?? "USD",
            stock_status: null,
            stock_updated_at: p.created_at,
            photo_url: p.post_photos?.[0]?.photo_url ?? null,
            offer_active: p.discount_price != null,
            post_type: p.post_type,
            cat_id: p.category ? (byCode.get(p.category)?.id ?? null) : null,
          }));
      }

      // Older product posts were copied into the catalogue, so hide the duplicate post entry
      const itemNames = new Set(items.map((i) => i.name_en.trim().toLowerCase()));
      const dedupedPosts = posts.filter((p) => {
        const base = p.name_en.split(" - ")[0].trim().toLowerCase();
        return !itemNames.has(base) && !itemNames.has(p.name_en.trim().toLowerCase());
      });

      setEntries([...items, ...dedupedPosts]);
      setLoading(false);

      if (user && !isOwner && items.length) {
        void supabase.from("catalog_item_events").insert(
          items.slice(0, 60).map((i) => ({
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

  const label = (i: { name_en: string; name_km: string | null }) =>
    lang === "km" && i.name_km ? i.name_km : i.name_en;

  const sourceFiltered = useMemo(
    () => (source === "all" ? entries : entries.filter((e) => e.kind === source)),
    [entries, source],
  );

  const cats = useMemo(() => {
    const map = new Map<string, { cat: Cat; n: number }>();
    sourceFiltered.forEach((e) => {
      if (!e.cat_id) return;
      const cat = catMap.get(e.cat_id);
      if (!cat) return;
      map.set(cat.id, { cat, n: (map.get(cat.id)?.n ?? 0) + 1 });
    });
    return [...map.values()].sort((a, b) => b.n - a.n);
  }, [sourceFiltered, catMap]);

  const counts = useMemo(
    () => ({
      all: entries.length,
      item: entries.filter((e) => e.kind === "item").length,
      post: entries.filter((e) => e.kind === "post").length,
    }),
    [entries],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sourceFiltered;
    if (activeCat) list = list.filter((i) => i.cat_id === activeCat);
    if (q) {
      list = list.filter(
        (i) =>
          i.name_en.toLowerCase().includes(q) ||
          (i.name_km ?? "").toLowerCase().includes(q) ||
          (i.note ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return label(a).localeCompare(label(b));
      if (sort === "price_asc" || sort === "price_desc") {
        const pa = a.price;
        const pb = b.price;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return sort === "price_asc" ? pa - pb : pb - pa;
      }
      const rank = (s: StockStatus | null) => (s === "out" ? 1 : 0);
      return rank(a.stock_status) - rank(b.stock_status);
    });
  }, [sourceFiltered, query, activeCat, sort, lang]);

  async function toggleNotify(item: Entry) {
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

  if (!entries.length) return null;

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

      {/* Source toggle: catalogue vs posts */}
      {counts.item > 0 && counts.post > 0 && (
        <div className="mt-3 flex gap-1.5">
          {(
            [
              ["all", `${c("all_label")} (${counts.all})`],
              ["item", `${lang === "km" ? "កាតាឡុក" : "Catalogue"} (${counts.item})`],
              ["post", `${lang === "km" ? "ការបង្ហោះ" : "Posts"} (${counts.post})`],
            ] as Array<[SourceMode, string]>
          ).map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setSource(mode);
                setActiveCat(null);
              }}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition ${
                source === mode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* Category tabs */}
      <div className="-mx-5 mt-3 overflow-x-auto px-5 scrollbar-none">
        <div className="flex gap-1.5">
          <Tab active={activeCat === null} onClick={() => setActiveCat(null)}>
            {c("all_label")} ({sourceFiltered.length})
          </Tab>
          {cats.map(({ cat, n }) => (
            <Tab key={cat.id} active={activeCat === cat.id} onClick={() => setActiveCat(cat.id)}>
              {label(cat)} ({n})
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
          const isPost = item.kind === "post";
          const meta = item.post_type ? POST_TYPE_LABELS[item.post_type] : undefined;
          const media = item.photo_url ? (
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
          );
          return (
            <div
              key={`${item.kind}-${item.id}`}
              className={`flex gap-3 rounded-xl border border-border bg-card p-2.5 ${out ? "opacity-60" : ""}`}
            >
              {isPost ? (
                <Link to="/posts/$postId" params={{ postId: item.id }} className="shrink-0 active:opacity-80">
                  {media}
                </Link>
              ) : (
                media
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  {isPost ? (
                    <Link
                      to="/posts/$postId"
                      params={{ postId: item.id }}
                      className="min-w-0 flex-1 text-[13px] font-bold text-foreground active:underline"
                    >
                      {label(item)}
                    </Link>
                  ) : (
                    <p className="min-w-0 flex-1 text-[13px] font-bold text-foreground">{label(item)}</p>
                  )}
                  {meta ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                      {lang === "km" ? meta.km : meta.en}
                    </span>
                  ) : (
                    item.offer_active && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <Tag className="h-3 w-3" />
                        {c("offer")}
                      </span>
                    )
                  )}
                </div>
                {item.note && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.note}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {item.price != null ? (
                    <p className="text-sm font-bold text-foreground">
                      {formatPrice(item.price, item.currency)}
                      {item.old_price != null && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground line-through">
                          {formatPrice(item.old_price, item.currency)}
                        </span>
                      )}
                      {item.unit && (
                        <span className="text-[11px] font-normal text-muted-foreground"> / {item.unit}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">{c("ask_price")}</p>
                  )}
                  {item.stock_status && <StockBadge status={item.stock_status} lang={lang} />}
                  {!isOwner &&
                    (out ? (
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
                        onClick={() =>
                          isPost
                            ? onAskPost?.(item.id)
                            : onAsk({ id: item.id, name: label(item) })
                        }
                        className="ml-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground active:scale-[0.97]"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {c("ask")}
                      </button>
                    ))}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {item.stock_updated_at && !isPost && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {c("stock_updated").replace("{v}", timeAgo(item.stock_updated_at, t))}
                    </span>
                  )}
                  {!isOwner && !isPost && (
                    <button
                      type="button"
                      onClick={() => setReportItem(item)}
                      className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 active:underline"
                      aria-label={c("report_title")}
                    >
                      <Flag className="h-3 w-3" />
                      {c("report_issue")}
                    </button>
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

      {reportItem && (
        <ReportDialog
          item={reportItem}
          storeId={storeId}
          name={label(reportItem)}
          c={c}
          canReport={!!user}
          onClose={() => setReportItem(null)}
        />
      )}
    </div>
  );
}

function ReportDialog({
  item,
  storeId,
  name,
  c,
  canReport,
  onClose,
}: {
  item: { id: string };
  storeId: string;
  name: string;
  c: (key: Parameters<typeof catalogCopy>[1]) => string;
  canReport: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("unavailable");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const reasons: Array<[string, string]> = [
    ["unavailable", c("report_reason_unavailable")],
    ["price", c("report_reason_price")],
    ["closed", c("report_reason_closed")],
    ["other", c("report_reason_other")],
  ];

  async function submit() {
    if (!user) {
      toast.error(c("report_login"));
      return;
    }
    setSending(true);
    const { error } = await supabase.from("catalog_stock_reports").insert({
      item_id: item.id,
      store_id: storeId,
      user_id: user.id,
      reason,
      note: note.trim() || null,
    });
    setSending(false);
    if (error) {
      toast.error(error.code === "23505" ? c("report_already") : error.message);
      return;
    }
    toast.success(c("report_sent"));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={c("report_title")}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold text-foreground">{c("report_title")}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{name}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{c("report_hint")}</p>

        <div className="mt-3 space-y-1.5">
          {reasons.map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReason(key)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-[12px] font-semibold ${
                reason === key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 400))}
          placeholder={c("report_note_placeholder")}
          aria-label={c("report_note_placeholder")}
          rows={2}
          className="mt-3 w-full rounded-xl border border-border bg-background p-2.5 text-[12px] outline-none"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-muted py-2.5 text-[12px] font-bold text-foreground"
          >
            {c("cancel_label")}
          </button>
          <button
            type="button"
            disabled={sending || !canReport}
            onClick={() => void submit()}
            className="flex-1 rounded-xl bg-primary py-2.5 text-[12px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {c("report_send")}
          </button>
        </div>
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
