import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Camera, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { catalogCopy } from "@/lib/catalog-copy";
import { recognizeCatalogProduct } from "@/lib/catalog.functions";
import { prepareImageForRecognition } from "@/lib/image-resize";

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
        content: "Fast catalogue setup: choose categories, mark products, set prices and stock.",
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
  market_price_min: number | null;
  market_price_max: number | null;
  market_currency: string;
}
type StockStatus = "in_stock" | "low" | "out";
interface Picked {
  price: string;
  currency: "USD" | "KHR";
  stock: StockStatus;
  nameEn: string;
  nameKm: string;
  description: string;
  photoUrl: string | null;
  photoPreview: string | null;
  autoFilled: boolean;
  busy: boolean;
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
  furniture: "🛋️",
  other: "📦",
};

function SelectFromListPage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);
  const recognize = useServerFn(recognizeCatalogProduct);
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<string | null>(null);

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
          .select("id,category_id,name_en,name_km,unit,market_price_min,market_price_max,market_currency")
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

  const chosenCats = useMemo(
    () => visibleCats.filter((cat) => selectedCats.has(cat.id)),
    [visibleCats, selectedCats],
  );

  const pickedIds = Object.keys(picked);
  const pickedProducts = useMemo(
    () =>
      pickedIds
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product)),
    [pickedIds.join("|"), products],
  );
  const pickedCatIds = useMemo(
    () => new Set(pickedProducts.map((product) => product.category_id)),
    [pickedProducts],
  );
  const priceCats = useMemo(
    () => chosenCats.filter((cat) => pickedCatIds.has(cat.id)),
    [chosenCats, pickedCatIds],
  );
  const shownProducts = useMemo(
    () => pickedProducts.filter((product) => !activeCat || product.category_id === activeCat),
    [pickedProducts, activeCat],
  );

  const name = (row: { name_en: string; name_km: string }) =>
    lang === "km" && row.name_km ? row.name_km : row.name_en;

  function update(id: string, patch: Partial<Picked>) {
    setPicked((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }

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
      else
        next[product.id] = {
          price: "",
          currency: "USD",
          stock: "in_stock",
          nameEn: product.name_en,
          nameKm: product.name_km,
          description: "",
          photoUrl: null,
          photoPreview: null,
          autoFilled: false,
          busy: false,
        };
      return next;
    });
  }

  async function onPickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const id = photoTarget.current;
    photoTarget.current = null;
    if (!file || !id || !user) return;
    update(id, { busy: true });
    try {
      const dataUrl = await prepareImageForRecognition(file);
      update(id, { photoPreview: dataUrl });
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/catalog/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const upload = await supabase.storage
        .from("supplier-stores")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (!upload.error) {
        const { data } = supabase.storage.from("supplier-stores").getPublicUrl(path);
        update(id, { photoUrl: data.publicUrl });
      }
      const result = await recognize({ data: { storeId, imageDataUrl: dataUrl } });
      if (result.product?.name_en) {
        update(id, {
          nameEn: result.product.name_en,
          nameKm: result.product.name_km || "",
          description: result.product.description,
          autoFilled: true,
        });
      }
    } catch {
      toast.error(c("not_recognized"));
    } finally {
      update(id, { busy: false });
    }
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
          name_en: entry.nameEn.trim() || product.name_en,
          name_km: entry.nameKm.trim() || product.name_km,
          unit: product.unit,
          price: entry.price ? Number(entry.price) : null,
          currency: entry.currency,
          stock_status: entry.stock,
          in_stock: entry.stock !== "out",
          note: entry.description.trim() || null,
          photo_url: entry.photoUrl,
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
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPickPhoto} />

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
          <h1 className="truncate text-[15px] font-semibold">
            {step === 3 ? c("step3_header") : c("method_list")}
          </h1>
          <p className="truncate text-[11px] opacity-80">
            {c("step_of").replace("{n}", String(step))}
            {step === 3 ? ` — ${c("almost_done")}` : ""}
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
            {chosenCats.map((cat) => {
              const list = products.filter((product) => product.category_id === cat.id);
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
                  <div className="mt-2 space-y-1.5">
                    {list.map((product) => {
                      const on = Boolean(picked[product.id]);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => togglePick(product)}
                          className={`flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition ${
                            on ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {on && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {name(product)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              per {product.unit}
                              {existing.has(product.id) ? " · ✓" : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {c("step3_section")}
            </p>
            <SectionHead title={c("set_your_prices")} sub={c("set_your_prices_sub")} />

            {priceCats.length > 1 && (
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                <Chip active={!activeCat} onClick={() => setActiveCat(null)}>
                  {lang === "km" ? "ទាំងអស់" : "All"}
                </Chip>
                {priceCats.map((cat) => (
                  <Chip
                    key={cat.id}
                    active={activeCat === cat.id}
                    onClick={() => setActiveCat(cat.id)}
                  >
                    {name(cat)}
                  </Chip>
                ))}
              </div>
            )}

            {shownProducts.map((product) => {
              const entry = picked[product.id];
              const hasPhoto = Boolean(entry.photoPreview);
              return (
                <div key={product.id} className="space-y-3 rounded-xl bg-surface p-3 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <input
                        value={entry.nameEn}
                        onChange={(e) =>
                          update(product.id, { nameEn: e.target.value, autoFilled: false })
                        }
                        className="w-full border-b border-transparent bg-transparent text-sm font-bold text-foreground outline-none focus:border-primary"
                      />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">per {product.unit}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        hasPhoto
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {hasPhoto ? c("photo_added") : c("optional")}
                    </span>
                  </div>

                  {/* Optional product photo — tap toggles between empty and added */}
                  <div className="flex gap-2.5 rounded-lg border border-border p-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        photoTarget.current = product.id;
                        photoInput.current?.click();
                      }}
                      className={`relative flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border text-[10px] font-semibold active:scale-95 ${
                        hasPhoto
                          ? "border-emerald-500 text-emerald-700"
                          : "border-dashed border-primary/50 bg-primary/5 text-primary"
                      }`}
                    >
                      {hasPhoto ? (
                        <>
                          <img
                            src={entry.photoPreview as string}
                            alt={entry.nameEn}
                            className="absolute inset-0 h-full w-full object-cover opacity-30"
                          />
                          <Check className="relative h-4 w-4" />
                          <span className="relative">{c("added")}</span>
                        </>
                      ) : entry.busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          <span>{c("add_photo")}</span>
                        </>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
                        <Camera className="h-3.5 w-3.5" /> {c("product_photo")}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {hasPhoto ? c("photo_hint_done") : c("photo_hint")}
                      </p>
                      {entry.autoFilled ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Sparkles className="h-3 w-3" /> {c("autofilled_tap_edit")}
                        </span>
                      ) : (
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {c("optional")}
                        </span>
                      )}
                      {entry.autoFilled && entry.description && (
                        <textarea
                          value={entry.description}
                          onChange={(e) =>
                            update(product.id, { description: e.target.value, autoFilled: false })
                          }
                          rows={2}
                          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background p-2 text-[12px] outline-none focus:border-primary"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        {c("your_price")}
                      </p>
                      <div className="flex h-10 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                        <select
                          value={entry.currency}
                          onChange={(e) =>
                            update(product.id, {
                              currency: e.target.value === "KHR" ? "KHR" : "USD",
                            })
                          }
                          aria-label={`${c("price")} currency`}
                          className="h-full border-r border-border bg-muted px-2 text-xs font-semibold outline-none"
                        >
                          <option value="USD">$</option>
                          <option value="KHR">៛</option>
                        </select>
                        <input
                          value={entry.price}
                          onChange={(e) =>
                            update(product.id, { price: e.target.value.replace(/[^0-9.]/g, "") })
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        {c("availability")}
                      </p>
                      <div className="flex h-10 gap-1">
                        <StockButton
                          active={entry.stock === "in_stock"}
                          tone="ok"
                          onClick={() => update(product.id, { stock: "in_stock" })}
                        >
                          {c("in_stock")}
                        </StockButton>
                        <StockButton
                          active={entry.stock === "low"}
                          tone="warn"
                          onClick={() => update(product.id, { stock: "low" })}
                        >
                          {c("low_stock")}
                        </StockButton>
                        <StockButton
                          active={entry.stock === "out"}
                          tone="bad"
                          onClick={() => update(product.id, { stock: "out" })}
                        >
                          {c("out_label")}
                        </StockButton>
                      </div>
                    </div>
                  </div>

                  {product.market_price_min !== null && product.market_price_max !== null && (
                    <p className="text-[10px] text-muted-foreground">
                      {c("market_range")}: {product.market_currency === "KHR" ? "៛" : "$"}
                      {product.market_price_min.toFixed(2)} –{" "}
                      {product.market_currency === "KHR" ? "៛" : "$"}
                      {product.market_price_max.toFixed(2)} / {product.unit}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        {step === 3 ? (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
            <span className="text-[11px] font-semibold text-primary">{c("catalog_ready")}</span>
            <span className="text-[11px] text-muted-foreground">
              {pickedIds.length} {c("products_count")} · {pickedCatIds.size}{" "}
              {pickedCatIds.size === 1 ? c("category_one") : c("selected_categories")}
            </span>
          </div>
        ) : (
          <p className="mb-2 text-center text-[11px] font-semibold text-emerald-700">
            {step === 1
              ? `✓ ${selectedCats.size} ${c("selected_categories")}`
              : `✓ ${pickedIds.length} ${c("selected_products")}`}
          </p>
        )}
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
          {step === 3 ? (saving ? c("saving") : `${c("publish_catalog")} ↗`) : `${c("continue")} →`}
        </button>
      </div>
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
      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function StockButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "ok" | "warn" | "bad";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass =
    tone === "ok"
      ? "border-emerald-500 bg-emerald-100 text-emerald-700"
      : tone === "warn"
        ? "border-amber-500 bg-amber-100 text-amber-700"
        : "border-destructive bg-destructive/10 text-destructive";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full flex-1 rounded-lg border text-[11px] font-semibold transition active:scale-95 ${
        active ? activeClass : "border-border bg-background text-muted-foreground"
      }`}
    >
      {children}
    </button>
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
