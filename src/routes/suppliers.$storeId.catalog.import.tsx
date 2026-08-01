import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowLeft, Upload, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { catalogCopy } from "@/lib/catalog-copy";
import { importCatalogPriceList } from "@/lib/catalog.functions";
import { prepareImageForRecognition } from "@/lib/image-resize";
import type { ParsedCatalogItem } from "@/lib/catalog.schema";

export const Route = createFileRoute("/suppliers/$storeId/catalog/import")({
  head: () => ({
    meta: [
      { title: "Import Price List — Supplier Catalogue | BuildHub" },
      {
        name: "description",
        content:
          "Upload an Excel sheet, PDF, WhatsApp screenshot or photo of a handwritten price list and BuildHub AI turns it into a digital catalogue.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Import Price List — Supplier Catalogue" },
      {
        property: "og:description",
        content: "AI converts any price list format into a structured product catalogue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ImportCatalogPage />
    </RequireAuth>
  ),
});

type Row = ParsedCatalogItem & { keep: boolean };

function ImportCatalogPage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);
  const runImport = useServerFn(importCatalogPriceList);
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const payload: {
        storeId: string;
        imageDataUrl?: string;
        fileDataUrl?: string;
        fileName?: string;
        text?: string;
      } = { storeId };
      if (file.type.startsWith("image/")) {
        payload.imageDataUrl = await prepareImageForRecognition(file);
      } else if (file.type === "application/pdf") {
        payload.fileDataUrl = await readDataUrl(file);
        payload.fileName = file.name;
      } else {
        payload.text = (await file.text()).slice(0, 18_000);
      }
      const result = await runImport({ data: payload });
      if (result.error === "import-failed") {
        toast.error(c("import_failed"));
        return;
      }
      if (!result.items.length) {
        toast.error(c("import_empty"));
        return;
      }
      setRows(result.items.map((item) => ({ ...item, keep: true })));
    } catch {
      toast.error(c("import_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const keep = rows.filter((row) => row.keep);
    if (!keep.length) return toast.error(c("select_at_least_one"));
    setSaving(true);
    try {
      const { data: cats } = await supabase.from("supplier_categories").select("id,code");
      const byCode = new Map((cats ?? []).map((cat) => [cat.code, cat.id]));
      const { error } = await supabase.from("supplier_catalog_items").insert(
        keep.map((row) => ({
          store_id: storeId,
          category_id: byCode.get(row.category_code) ?? null,
          name_en: row.name_en,
          name_km: row.name_km || null,
          unit: row.unit,
          price: row.price,
          currency: row.currency,
          stock_status: "in_stock",
          source: "import",
        })),
      );
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
        <h1 className="truncate text-[15px] font-semibold">{c("method_import")}</h1>
      </header>

      <div className="space-y-3 p-3">
        <div className="px-1">
          <h2 className="text-base font-bold text-foreground">{c("upload_title")}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {c("upload_sub")}
          </p>
        </div>

        <input
          ref={fileInput}
          type="file"
          hidden
          accept="image/*,.pdf,.csv,.txt,.xls,.xlsx"
          onChange={onPick}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-6 text-primary active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span className="text-sm font-semibold">{busy ? c("reading_file") : c("pick_file")}</span>
          {fileName && !busy && (
            <span className="max-w-full truncate text-[11px] text-muted-foreground">{fileName}</span>
          )}
        </button>

        {rows.length > 0 && (
          <div className="rounded-xl bg-surface p-3 shadow-card">
            <p className="text-sm font-bold text-foreground">
              {rows.filter((row) => row.keep).length} {c("import_found")}
            </p>
            <div className="mt-2 space-y-2">
              {rows.map((row, index) => (
                <div
                  key={index}
                  className={`rounded-lg border p-2.5 ${
                    row.keep ? "border-primary bg-primary/5" : "border-border opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, keep: !item.keep } : item)),
                        )
                      }
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        row.keep
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                      aria-label={c("remove")}
                    >
                      {row.keep ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                    <input
                      value={row.name_en}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, name_en: e.target.value } : item,
                          ),
                        )
                      }
                      className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-medium text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-7">
                    <input
                      value={row.price === null ? "" : String(row.price)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, "");
                        setRows((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, price: value ? Number(value) : null } : item,
                          ),
                        );
                      }}
                      inputMode="decimal"
                      placeholder={c("price")}
                      className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    />
                    <select
                      value={row.currency}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, currency: e.target.value === "KHR" ? "KHR" : "USD" }
                              : item,
                          ),
                        )
                      }
                      aria-label="currency"
                      className="h-9 rounded-lg border border-border bg-muted px-2 text-xs font-semibold outline-none"
                    >
                      <option value="USD">$ USD</option>
                      <option value="KHR">៛ KHR</option>
                    </select>
                    <input
                      value={row.unit}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, unit: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder={c("unit")}
                      className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="sticky bottom-0 border-t border-border bg-surface p-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? c("saving") : c("save_catalog")}
          </button>
        </div>
      )}
    </div>
  );
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
