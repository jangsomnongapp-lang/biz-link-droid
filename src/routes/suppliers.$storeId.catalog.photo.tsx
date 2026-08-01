import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { catalogCopy } from "@/lib/catalog-copy";
import { recognizeCatalogProduct } from "@/lib/catalog.functions";
import { prepareImageForRecognition } from "@/lib/image-resize";

export const Route = createFileRoute("/suppliers/$storeId/catalog/photo")({
  head: () => ({
    meta: [
      { title: "Add Product By Photo — Supplier Catalogue | BuildHub" },
      {
        name: "description",
        content:
          "Photograph a construction product and BuildHub AI fills in the name, category and description — you only confirm price and stock.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Add Product By Photo — Supplier Catalogue" },
      {
        property: "og:description",
        content: "AI recognises the product from a photo so you only confirm price and stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <CatalogPhotoPage />
    </RequireAuth>
  ),
});

function CatalogPhotoPage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);
  const recognize = useServerFn(recognizeCatalogProduct);
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameKm, setNameKm] = useState("");
  const [unit, setUnit] = useState("unit");
  const [categoryCode, setCategoryCode] = useState("other");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const [inStock, setInStock] = useState(true);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setBusy(true);
    try {
      const dataUrl = await prepareImageForRecognition(file);
      setPreview(dataUrl);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/catalog/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const upload = await supabase.storage
        .from("supplier-stores")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (!upload.error) {
        const { data } = supabase.storage.from("supplier-stores").getPublicUrl(path);
        setPhotoUrl(data.publicUrl);
      }
      const result = await recognize({ data: { storeId, imageDataUrl: dataUrl } });
      if (!result.product) {
        toast.error(c("not_recognized"));
        return;
      }
      setNameEn(result.product.name_en);
      setNameKm(result.product.name_km);
      setUnit(result.product.unit || "unit");
      setCategoryCode(result.product.category_code);
      setDescription(result.product.description);
    } catch {
      toast.error(c("not_recognized"));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!nameEn.trim()) return toast.error(c("product_name"));
    setSaving(true);
    try {
      const { data: cat } = await supabase
        .from("supplier_categories")
        .select("id")
        .eq("code", categoryCode)
        .maybeSingle();
      const { error } = await supabase.from("supplier_catalog_items").insert({
        store_id: storeId,
        category_id: cat?.id ?? null,
        name_en: nameEn.trim(),
        name_km: nameKm.trim() || null,
        unit: unit.trim() || "unit",
        price: price ? Number(price) : null,
        currency,
        in_stock: inStock,
        note: description.trim() || null,
        photo_url: photoUrl,
        source: "photo",
      });
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
        <Link
          to="/suppliers/$storeId/catalog"
          params={{ storeId }}
          className="rounded-full p-1.5 active:bg-white/10"
          aria-label={c("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate text-[15px] font-semibold">{c("method_photo")}</h1>
      </header>

      <div className="space-y-3 p-3">
        <div className="px-1">
          <h2 className="text-base font-bold text-foreground">{c("photo_title")}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{c("photo_sub")}</p>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onPick}
        />
        {preview ? (
          <button type="button" onClick={() => fileInput.current?.click()} className="block w-full">
            <img
              src={preview}
              alt={nameEn || c("photo_title")}
              className="aspect-square w-full rounded-xl object-cover"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-8 text-primary active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            <span className="text-sm font-semibold">{busy ? c("identifying") : c("take_photo")}</span>
          </button>
        )}

        {busy && preview && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {c("identifying")}
          </p>
        )}

        {nameEn && (
          <div className="space-y-3 rounded-xl bg-surface p-3 shadow-card">
            <Field label={c("product_name")}>
              <input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            {nameKm && (
              <Field label="ខ្មែរ">
                <input
                  value={nameKm}
                  onChange={(e) => setNameKm(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={c("price")}>
                <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value === "KHR" ? "KHR" : "USD")}
                    aria-label="currency"
                    className="h-full border-r border-border bg-muted px-2 text-xs font-semibold outline-none"
                  >
                    <option value="USD">$</option>
                    <option value="KHR">៛</option>
                  </select>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="0"
                    className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
                  />
                </div>
              </Field>
              <Field label={c("unit")}>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
            </div>
            <Field label={c("description")}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <button
              type="button"
              onClick={() => setInStock((value) => !value)}
              className={`h-10 w-full rounded-lg text-xs font-semibold ${
                inStock ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
              }`}
            >
              {inStock ? c("in_stock") : c("out_of_stock")}
            </button>
          </div>
        )}
      </div>

      {nameEn && (
        <div className="sticky bottom-0 border-t border-border bg-surface p-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? c("saving") : c("add_product")}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}
