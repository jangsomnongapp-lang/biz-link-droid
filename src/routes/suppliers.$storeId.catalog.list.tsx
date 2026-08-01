import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { catalogCopy } from "@/lib/catalog-copy";

export const Route = createFileRoute("/suppliers/$storeId/catalog/list")({
  head: () => ({
    meta: [
      { title: "Select Products From List — Supplier Catalogue | BuildHub" },
      {
        name: "description",
        content:
          "Pick the categories you sell and mark the most common Cambodian construction products with your prices — catalogue setup in minutes.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Select Products From List — Supplier Catalogue" },
      {
        property: "og:description",
        content: "Fast catalogue setup: choose categories, mark products, set prices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <SelectFromListPage />
    </RequireAuth>
  ),
});

interface Category {
  id: string;
  code: string;
  name_en: string;
  name_km: string;
}
interface Product {
  id: string;
  category_id: string;
  name_en: string;
  name_km: string;
  unit: string;
}
interface Picked {
  price: string;
  currency: "USD" | "KHR";
  inStock: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  cement: "🧱",
  steel: "🔧",
  bricks: "🧱",
  tiles: "🪟",
  paint: "🎨",
  plumbing: "🚰",
  electrical: "⚡",
  roofing: "🏠",
  wood: "🪵",
  glass_aluminum: "🪟",
  doors_windows: "🚪",
  sanitary: "🚽",
  hardware: "🛠️",
  machinery: "🚜",
  other: "📦",
};

function SelectFromListPage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catRes, prodRes, itemRes] = await Promise.all([
        supabase
          .from("supplier_categories")
          .select("id,code,name_en,name_km")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("catalog_products")
          .select("id,category_id,name_en,name_km,unit")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("supplier_catalog_items")
          .select("product_id")
          .eq("store_id", storeId)
          .not("product_id", "is", null),
      ]);
      if (cancelled) return;
      setCats(catRes.data ?? []);
      setProducts(prodRes.data ?? []);
      setExisting(new Set((itemRes.data ?? []).map((row) => row.product_id as string)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const countByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.category_id, (map.get(product.category_id) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const visibleCats = useMemo(
    () => cats.filter((cat) => (countByCat.get(cat.id) ?? 0) > 0),
    [cats, countByCat],
  );

  const stepProducts = useMemo(
    () => products.filter((product) => selectedCats.has(product.category_id)),
    [products, selectedCats],
  );

  const pickedIds = Object.keys(picked);
  const name = (row: { name_en: string; name_km: string }) =>
    lang === "km" && row.name_km ? row.name_km : row.name_en;

  function toggleCat(id: string) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePick(product: Product) {
    setPicked((prev) => {
      const next = { ...prev };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = { price: "", currency: "USD", inStock: true };
      return next;
    });
  }

  async function save() {
    if (!user || !pickedIds.length) return;
    setSaving(true);
    try {
      const rows = pickedIds.map((productId) => {
        const product = products.find((p) => p.id === productId)!;
        const entry = picked[productId];
        return {
          store_id: storeId,
          product_id: productId,
          category_id: product.category_id,
          name_en: product.name_en,
          name_km: product.name_km,
          unit: product.unit,
          price: entry.price ? Number(entry.price) : null,
          currency: entry.currency,
          in_stock: entry.inStock,
          source: "list",
        };
      });
      const { error } = await supabase
        .from("supplier_catalog_items")
        .upsert(rows, { onConflict: "store_id,product_id" });
      if (error) throw error;
      toast.success(c("saved"));
      nav({ to: "/suppliers/$storeId/catalog", params: { storeId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-primary px-3 py-3 text-primary-foreground">
        {step === 1 ? (
          <Link
            to="/suppliers/$storeId/catalog"
            params={{ storeId }}
            className="rounded-full p-1.5 active:bg-white/10"
            aria-label={c("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-full p-1.5 active:bg-white/10"
            aria-label={c("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold">{c("method_list")}</h1>
          <p className="truncate text-[11px] opacity-80">
            {c("step_of").replace("{n}", String(step))}
          </p>
        </div>
      </header>

      <div className="h-1 w-full bg-muted">
        <div
          className="h-1 bg-primary transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="space-y-3 p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : step === 1 ? (
          <>
            <SectionHead title={c("step1_title")} sub={c("step1_sub")} />
            <div className="grid grid-cols-2 gap-2">
              {visibleCats.map((cat) => {
                const on = selectedCats.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCat(cat.id)}
                    className={`rounded-xl p-3 text-left transition active:scale-[0.98] ${
                      on
                        ? "border-[1.5px] border-primary bg-primary/10"
                        : "border border-border bg-surface"
                    }`}
                  >
                    <span className="text-xl">{CATEGORY_ICONS[cat.code] ?? "📦"}</span>
                    <span className="mt-1.5 block text-sm font-semibold text-foreground">
                      {name(cat)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {countByCat.get(cat.id)} {c("products_count")}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : step === 2 ? (
          <>
            <SectionHead title={c("step2_title")} sub={c("step2_sub")} />
            {visibleCats
              .filter((cat) => selectedCats.has(cat.id))
              .map((cat) => {
                const list = stepProducts.filter((product) => product.category_id === cat.id);
                return (
                  <div key={cat.id} className="rounded-xl bg-surface p-3 shadow-card">
                    <p className="text-sm font-bold text-foreground">
                      {CATEGORY_ICONS[cat.code] ?? "📦"} {name(cat)}
                    </p>
                    {list.length === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {c("no_products_for_category")}
                      </p>
                    )}
                    <div className="mt-2 space-y-2">
                      {list.map((product) => {
                        const entry = picked[product.id];
                        return (
                          <div
                            key={product.id}
                            className={`rounded-lg border p-2.5 transition ${
                              entry ? "border-primary bg-primary/5" : "border-border"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => togglePick(product)}
                              className="flex w-full items-center gap-2.5 text-left"
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                  entry
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border"
                                }`}
                              >
                                {entry && <Check className="h-3.5 w-3.5" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {name(product)}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  /{product.unit}
                                  {existing.has(product.id) ? " · ✓" : ""}
                                </span>
                              </span>
                            </button>
                            {entry && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex h-10 flex-1 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                                  <select
                                    value={entry.currency}
                                    onChange={(e) =>
                                      setPicked((prev) => ({
                                        ...prev,
                                        [product.id]: {
                                          ...prev[product.id],
                                          currency: e.target.value === "KHR" ? "KHR" : "USD",
                                        },
                                      }))
                                    }
                                    aria-label="currency"
                                    className="h-full border-r border-border bg-muted px-2 text-xs font-semibold outline-none"
                                  >
                                    <option value="USD">$</option>
                                    <option value="KHR">៛</option>
                                  </select>
                                  <input
                                    value={entry.price}
                                    onChange={(e) =>
                                      setPicked((prev) => ({
                                        ...prev,
                                        [product.id]: {
                                          ...prev[product.id],
                                          price: e.target.value.replace(/[^0-9.]/g, ""),
                                        },
                                      }))
                                    }
                                    inputMode="decimal"
                                    placeholder={c("price")}
                                    className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPicked((prev) => ({
                                      ...prev,
                                      [product.id]: {
                                        ...prev[product.id],
                                        inStock: !prev[product.id].inStock,
                                      },
                                    }))
                                  }
                                  className={`h-10 shrink-0 rounded-lg px-3 text-xs font-semibold ${
                                    entry.inStock
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {entry.inStock ? c("in_stock") : c("out_of_stock")}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </>
        ) : (
          <>
            <SectionHead title={c("step3_title")} sub={c("step3_sub")} />
            <div className="rounded-xl bg-surface p-3 shadow-card">
              {pickedIds.map((productId) => {
                const product = products.find((p) => p.id === productId)!;
                const entry = picked[productId];
                return (
                  <div
                    key={productId}
                    className="flex items-center justify-between border-b border-border py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{name(product)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        /{product.unit} · {entry.inStock ? c("in_stock") : c("out_of_stock")}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-foreground">
                      {entry.price
                        ? `${entry.currency === "KHR" ? "៛" : "$"}${entry.price}`
                        : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <p className="mb-2 text-center text-[11px] font-semibold text-emerald-700">
          {step === 1
            ? `✓ ${selectedCats.size} ${c("selected_categories")}`
            : `✓ ${pickedIds.length} ${c("selected_products")}`}
        </p>
        <button
          type="button"
          onClick={() => {
            if (step === 1) {
              if (!selectedCats.size) return toast.error(c("select_at_least_one"));
              setStep(2);
            } else if (step === 2) {
              if (!pickedIds.length) return toast.error(c("select_at_least_one"));
              setStep(3);
            } else {
              void save();
            }
          }}
          disabled={saving}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {step === 3 ? (saving ? c("saving") : c("save_catalog")) : `${c("continue")} →`}
        </button>
      </div>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-1">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}
