import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ProvinceSelect } from "@/components/ProvinceSelect";

type Kind = "retail" | "secondhand";

export const Route = createFileRoute("/marketplace/new")({
  validateSearch: (params: Record<string, unknown>): { kind: Kind } => ({
    kind: params.kind === "secondhand" ? "secondhand" : "retail",
  }),
  component: () => (
    <RequireAuth>
      <NewMarketplaceItemPage />
    </RequireAuth>
  ),
});

function NewMarketplaceItemPage() {
  const { kind } = Route.useSearch();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const km = lang === "km";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (photos.length >= 4) {
      toast.error(t("max_4_photos"));
      return;
    }
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/marketplace/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("rental-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("rental-photos").getPublicUrl(path);
      setPhotos((p) => [...p, pub.publicUrl]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("upload_failed"));
    }
  }

  async function submit() {
    if (!user) return;
    if (!title.trim() || !price) {
      toast.error(t("fill_required_fields"));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("marketplace_items")
        .insert({
          user_id: user.id,
          kind,
          title: title.trim(),
          description: description.trim() || null,
          price: Number(price),
          currency,
          location: location.trim() || null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (photos.length) {
        await supabase
          .from("marketplace_item_photos")
          .insert(photos.map((url, i) => ({ item_id: data.id, photo_url: url, sort_order: i })));
      }
      toast.success(km ? "បានដាក់លក់រួចរាល់" : "Your item is live");
      nav(kind === "secondhand" ? { to: "/market", search: { mode: "secondhand" } } : { to: "/suppliers", search: { mode: "retail" } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-[#1a56a0] px-2 text-white">
        {kind === "secondhand" ? (
          <Link to="/market" search={{ mode: "secondhand" }} className="rounded-full p-2 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        ) : (
          <Link to="/suppliers" search={{ mode: "retail" }} className="rounded-full p-2 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <h1 className="flex-1 text-center text-base font-semibold">
          {t("sell_item")} · {kind === "secondhand" ? t("tab_secondhand") : t("tab_retails")}
        </h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            {km ? "ចំណងជើង" : "Title"} *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={km ? "ឧ. ម៉ាស៊ីនខួងមួយទឹក" : "e.g. Used drill machine"}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            {km ? "ពិពណ៌នា" : "Description"}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={km ? "ស្ថានភាព ម៉ាក ឆ្នាំផលិត…" : "Condition, brand, year…"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            {t("item_price")} *
          </label>
          <div className="flex gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0.00"
              className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(["USD", "KHR"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`h-11 px-4 text-sm font-bold ${currency === c ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
                >
                  {c === "USD" ? "$" : "៛"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            {km ? "ទីតាំង" : "Location"}
          </label>
          <ProvinceSelect value={location} onChange={setLocation} />
        </div>

        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <label className="mb-2 block text-xs font-semibold text-muted-foreground">
            {km ? "រូបភាព (អតិបរមា 4)" : "Photos (max 4)"}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3 pb-safe-nav">
        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-50"
        >
          {submitting ? (km ? "កំពុងដាក់…" : "Posting…") : t("sell_item")}
        </button>
      </div>
    </div>
  );
}
