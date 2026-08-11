import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, X, Sparkles, Box, Percent, AlertCircle, MessageSquare, Package } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { AutofillHint } from "@/components/AutofillHint";
import { smartAutofill } from "@/lib/smart-autofill.functions";

export const Route = createFileRoute("/posts/new")({
  component: () => (
    <RequireAuth>
      <NewProductPage />
    </RequireAuth>
  ),
});

type PostType = "general" | "novedad" | "stock" | "oferta" | "liquidacion";

const TYPES: Array<{
  id: PostType;
  title_en: string;
  title_km: string;
  sub_en: string;
  sub_km: string;
  icon: typeof Sparkles;
  bg: string;
  fg: string;
  ring: string;
}> = [
  {
    id: "general",
    title_en: "Normal product",
    title_km: "ផលិតផលធម្មតា",
    sub_en: "Regular product listing",
    sub_km: "ប្រកាសផលិតផលធម្មតា",
    icon: Package,
    bg: "bg-slate-50",
    fg: "text-slate-700",
    ring: "border-slate-300",
  },
  {
    id: "novedad",
    title_en: "New arrival",
    title_km: "ផលិតផលថ្មី",
    sub_en: "New product just arrived",
    sub_km: "ផលិតផលថ្មីទើបមកដល់",
    icon: Sparkles,
    bg: "bg-emerald-50",
    fg: "text-emerald-700",
    ring: "border-emerald-300",
  },
  {
    id: "stock",
    title_en: "Stock",
    title_km: "ស្តុក",
    sub_en: "Material available now",
    sub_km: "សម្ភារៈមានស្តុក",
    icon: Box,
    bg: "bg-sky-50",
    fg: "text-sky-700",
    ring: "border-sky-300",
  },
  {
    id: "oferta",
    title_en: "Offer",
    title_km: "ការផ្តល់ជូន",
    sub_en: "Special price — limited time",
    sub_km: "តម្លៃពិសេស — ពេលកំណត់",
    icon: Percent,
    bg: "bg-amber-50",
    fg: "text-amber-700",
    ring: "border-amber-300",
  },
  {
    id: "liquidacion",
    title_en: "Clearance",
    title_km: "បោះតម្លៃ",
    sub_en: "Minimum price — clear stock",
    sub_km: "តម្លៃទាប — សម្អាតស្តុក",
    icon: AlertCircle,
    bg: "bg-rose-50",
    fg: "text-rose-700",
    ring: "border-rose-300",
  },
];

type Cat =
  | "electrical"
  | "cement"
  | "steel"
  | "zinc"
  | "tools"
  | "timber"
  | "sanitary"
  | "paint"
  | "other";

const CATEGORIES: { id: Cat; en: string; km: string; emoji: string }[] = [
  { id: "electrical", en: "Electrical", km: "អគ្គិសនី", emoji: "⚡" },
  { id: "cement", en: "Cement", km: "ស៊ីម៉ងត៍", emoji: "🧱" },
  { id: "steel", en: "Steel", km: "ដែក", emoji: "🔩" },
  { id: "zinc", en: "Zinc", km: "ស័ង្កសី", emoji: "🏠" },
  { id: "tools", en: "Tools", km: "ឧបករណ៍", emoji: "🛠️" },
  { id: "timber", en: "Timber", km: "ឈើ", emoji: "🪵" },
  { id: "sanitary", en: "Sanitary", km: "បង្គន់", emoji: "🚿" },
  { id: "paint", en: "Paint", km: "ថ្នាំលាប", emoji: "🎨" },
  { id: "other", en: "Other", km: "ផ្សេងៗ", emoji: "📦" },
];

function NewProductPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [type, setType] = useState<PostType | null>(null);
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Cat | null>(null);
  const [marketPriceRange, setMarketPriceRange] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofilled, setAutofilled] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const fillForm = useServerFn(smartAutofill);
  const requestId = useRef(0);

  async function runAutofill(input: { text?: string; imageDataUrl?: string }) {
    const id = ++requestId.current;
    setAutofilling(true);
    try {
      const result = await fillForm({ data: { flow: "supplier", ...input } });
      if (!result || id !== requestId.current) return;
      const filled = new Set<string>();
      if (!title.trim() && result.name) {
        setTitle(result.name);
        filled.add("title");
      }
      if (!category && result.category && CATEGORIES.some((c) => c.id === result.category)) {
        setCategory(result.category as Cat);
        filled.add("category");
      }
      if (!description.trim() && result.description) {
        setDescription(result.description);
        filled.add("description");
      }
      if (result.marketPriceRange) setMarketPriceRange(result.marketPriceRange);
      setAutofilled((previous) => new Set([...previous, ...filled]));
    } catch {
      // Silent fallback keeps manual entry available.
    } finally {
      if (id === requestId.current) setAutofilling(false);
    }
  }

  useEffect(() => {
    const text = [title, category, description].filter(Boolean).join(". ").trim();
    if (text.length < 3) return;
    const timer = window.setTimeout(() => void runAutofill({ text }), 800);
    return () => window.clearTimeout(timer);
  }, [title, category, description]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(file)) return;
    const { resizeImageFile } = await import("@/lib/image-resize");
    const dataUrl = await resizeImageFile(file, { maxEdge: 1400, quality: 0.8 });
    void runAutofill({
      imageDataUrl: dataUrl,
      text: [title, category, description].filter(Boolean).join(". "),
    });
    try {
      const { uploadDataUrl } = await import("@/lib/media-upload");
      const url = await uploadDataUrl(user.id, "posts", dataUrl);
      setPhotos((p) => [...p, url].slice(0, 4));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function submit() {
    if (!user || !type) return;
    if (!title.trim()) {
      toast.error(lang === "km" ? "សូមបញ្ចូលឈ្មោះផលិតផល" : "Please enter product name");
      return;
    }
    if (!category) {
      toast.error(lang === "km" ? "សូមជ្រើសប្រភេទផលិតផល" : "Please select a category");
      return;
    }
    setSubmitting(true);
    try {
      const priceNum = price ? Number(price) : null;
      const discountNum = discountPrice ? Number(discountPrice) : null;
      if (discountNum != null && priceNum != null && discountNum >= priceNum) {
        toast.error(
          lang === "km"
            ? "តម្លៃបញ្ចុះតម្លៃត្រូវតិចជាងតម្លៃដើម"
            : "Discount must be lower than price",
        );
        setSubmitting(false);
        return;
      }
      const catLabel = category ? CATEGORIES.find((c) => c.id === category) : null;
      const content = [
        title.trim(),
        catLabel ? `Category: ${catLabel.en}` : "",
        description.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          post_type: type,
          category,
          title: title.trim(),
          price: priceNum,
          discount_price: discountNum,
          currency,
          content,
          status: "pending",
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      if (photos.length) {
        await supabase
          .from("post_photos")
          .insert(photos.map((url) => ({ post_id: data.id, photo_url: url })));
      }
      toast.success(
        lang === "km" ? "បានដាក់ស្នើ — រង់ចាំការអនុម័ត" : "Submitted — pending approval",
      );
      nav({ to: "/suppliers" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const selected = TYPES.find((tp) => tp.id === type);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/suppliers" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "ដាក់ផលិតផលរបស់ខ្ញុំ" : "Post my product"}
        </h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-28">
        <Link
          to="/announce"
          className="flex w-full items-center gap-3 rounded-xl border-2 border-border bg-background px-3 py-2.5 text-left transition active:scale-[0.98]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-primary">
              {lang === "km" ? "ប្រកាសធម្មតា" : "Normal post"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {lang === "km" ? "ប្រកាសព័ត៌មាន ឬអ្វីដែលអ្នកចង់ប្រាប់" : "Share news or anything you want to tell"}
            </p>
          </div>
        </Link>

        <div className="rounded-xl bg-surface p-3 shadow-card">
          <p className="text-sm font-semibold text-foreground">
            {lang === "km" ? "ប្រភេទប្រកាស" : "Post type"}
          </p>
          <div className="mt-3 space-y-2">
            {TYPES.map((tp) => {
              const Icon = tp.icon;
              const sel = type === tp.id;
              return (
                <button
                  key={tp.id}
                  onClick={() => setType(tp.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition ${
                    sel ? `${tp.ring} ${tp.bg}` : "border-border bg-background"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${tp.bg} ${tp.fg}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${tp.fg}`}>
                      {lang === "km" ? tp.title_km : tp.title_en}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {lang === "km" ? tp.sub_km : tp.sub_en}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <>
            <div className="rounded-xl bg-surface p-3 shadow-card">
              <Label required>{lang === "km" ? "ឈ្មោះផលិតផល" : "Product name"}</Label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={lang === "km" ? "ឧ. ស៊ីម៉ងត៍ 50kg" : "e.g. Cement 50kg"}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <AutofillHint loading={autofilling && !title} filled={autofilled.has("title")} />
            </div>

            <div className="rounded-xl bg-surface p-3 shadow-card">
              <Label required>{lang === "km" ? "ប្រភេទផលិតផល" : "Product category"}</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 transition ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <span className="text-xl leading-none">{c.emoji}</span>
                      <span className="text-[11px] font-semibold">
                        {lang === "km" ? c.km : c.en}
                      </span>
                    </button>
                  );
                })}
              </div>
              <AutofillHint
                loading={autofilling && !category}
                filled={autofilled.has("category")}
              />
            </div>

            <div className="space-y-3 rounded-xl bg-surface p-3 shadow-card">
              <div>
                <Label optional>{lang === "km" ? "រូបិយប័ណ្ណ" : "Currency"}</Label>
                <div className="flex gap-2">
                  {(["USD", "KHR"] as const).map((c) => {
                    const sel = currency === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-bold transition ${
                          sel
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {c === "USD" ? "$ USD" : "៛ KHR"}
                        <span className="ml-1 text-[10px] font-normal">
                          {c === "USD"
                            ? lang === "km"
                              ? "ដុល្លារ"
                              : "Dollar"
                            : lang === "km"
                              ? "រៀល"
                              : "Riel"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {marketPriceRange && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {lang === "km" ? "តម្លៃទីផ្សារយោង" : "Market reference"}: {marketPriceRange}
                  </p>
                )}
              </div>

              <div>
                <Label optional>{lang === "km" ? "តម្លៃដើម" : "Price"}</Label>
                <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                  <span className="ml-3 text-sm font-bold text-success">
                    {currency === "USD" ? "$" : "៛"}
                  </span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))}
                    inputMode="decimal"
                    placeholder={currency === "USD" ? "0.00" : "0"}
                    className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <Label optional>
                  {lang === "km" ? "តម្លៃបញ្ចុះ (ស្ទុក)" : "Discount price (clearance)"}
                </Label>
                <div className="flex h-11 items-center overflow-hidden rounded-lg border-2 border-dashed border-rose-300 bg-rose-50/50 focus-within:border-rose-500">
                  <span className="ml-3 text-sm font-bold text-rose-600">
                    {currency === "USD" ? "$" : "៛"}
                  </span>
                  <input
                    value={discountPrice}
                    onChange={(e) =>
                      setDiscountPrice(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
                    }
                    inputMode="decimal"
                    placeholder={lang === "km" ? "ស្រេចចិត្ត" : "Optional sale price"}
                    className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {lang === "km"
                    ? "បន្ថែមតម្លៃបញ្ចុះដើម្បីបង្ហាញតម្លៃធ្លាក់ចុះ"
                    : "Add a sale price to show a strike-through on the original"}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-surface p-3 shadow-card">
              <Label optional>{lang === "km" ? "ប​រិយាយ​" : "Description"}</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                rows={4}
                placeholder={lang === "km" ? "បរិយាយផលិតផល…" : "Describe the product…"}
                className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              />
              <AutofillHint
                loading={autofilling && !description}
                filled={autofilled.has("description")}
              />
            </div>

            <div className="rounded-xl bg-surface p-3 shadow-card">
              <Label optional>{lang === "km" ? "រូបភាព" : "Photos"}</Label>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} />
              <div className="grid grid-cols-3 gap-2">
                {photos.length < 4 && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground active:bg-muted"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px]">{lang === "km" ? "បន្ថែម" : "Add photo"}</span>
                  </button>
                )}
                {photos.map((src, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={src} className="h-full w-full rounded-lg object-cover" alt="" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-foreground/70 p-0.5 text-background"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="sticky bottom-0 border-t border-border bg-surface p-3">
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            {lang === "km"
              ? "ប្រកាសត្រូវរង់ចាំការអនុម័តមុនពេលបង្ហាញ"
              : "Your post will be reviewed before going live"}
          </p>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? "…" : lang === "km" ? "ដាក់ស្នើ" : "Submit for review"}
          </button>
        </div>
      )}
    </div>
  );
}

function Label({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="mb-2 text-sm font-semibold text-foreground">
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
      {optional && <span className="ml-1 text-xs font-normal text-text-hint">optional</span>}
    </div>
  );
}

export const POST_TYPE_META: Record<PostType, { en: string; km: string; bg: string; fg: string }> =
  {
    general: { en: "Product", km: "ផលិតផល", bg: "bg-slate-100", fg: "text-slate-700" },
    novedad: { en: "New", km: "ថ្មី", bg: "bg-emerald-100", fg: "text-emerald-700" },
    stock: { en: "Stock", km: "ស្តុក", bg: "bg-sky-100", fg: "text-sky-700" },
    oferta: { en: "Offer", km: "ការផ្តល់ជូន", bg: "bg-amber-100", fg: "text-amber-700" },
    liquidacion: { en: "Clearance", km: "បោះតម្លៃ", bg: "bg-rose-100", fg: "text-rose-700" },
  };
