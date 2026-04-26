import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, DollarSign, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/listings/new")({
  component: () => (
    <RequireAuth>
      <NewListingPage />
    </RequireAuth>
  ),
});

interface CategoryRow {
  id: string;
  name_en: string;
  name_km: string;
  group_en: string;
  code: string;
}

function NewListingPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setPhotos((p) => [...p, dataUrl]);
  }

  useEffect(() => {
    void supabase
      .from("categories")
      .select("id, name_en, name_km, group_en, code")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  async function submit() {
    if (!user) return;
    if (!title.trim()) {
      toast.error(lang === "km" ? "សូមបញ្ចូលចំណងជើង" : "Please enter a title");
      return;
    }
    if (selected.size === 0) {
      toast.error(lang === "km" ? "សូមជ្រើសរើសជំនាញ" : "Please select a specialty");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("listings")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          budget: budget ? Number(budget) : null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = Array.from(selected).map((cid) => ({ listing_id: data.id, category_id: cid }));
      if (rows.length) await supabase.from("listing_categories").insert(rows);
      if (photos.length) {
        await supabase
          .from("listing_photos")
          .insert(photos.map((url) => ({ listing_id: data.id, photo_url: url })));
      }
      toast.success(lang === "km" ? "បានបង្ហោះ!" : "Posted!");
      nav({ to: "/listings" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/listings" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("post_listing")}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        <Card>
          <Label required>{t("listing_title")}</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("listing_title_ph")}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Card>

        <Card>
          <Label optional>{t("description")}</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("desc_ph")}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
        </Card>

        <Card>
          <Label required>{t("specialty_needed")}</Label>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.code !== "D4")
              .map((c) => {
                const sel = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const n = new Set(selected);
                      if (n.has(c.id)) n.delete(c.id);
                      else n.add(c.id);
                      setSelected(n);
                    }}
                    className={`rounded-pill border px-3.5 py-1.5 text-xs font-medium transition ${
                      sel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    {lang === "km" ? c.name_km : c.name_en}
                  </button>
                );
              })}
          </div>
        </Card>

        <Card>
          <Label optional>{t("photos")}</Label>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} />
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground active:bg-muted"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px]">{t("add_photo")}</span>
            </button>
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
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <Label optional>{t("location")}</Label>
            <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
              <MapPin className="ml-2 h-4 w-4 text-destructive" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("location_ph")}
                className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
              />
            </div>
          </Card>
          <Card>
            <Label optional>{t("budget")}</Label>
            <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
              <DollarSign className="ml-2 h-4 w-4 text-success" />
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder={t("budget_ph")}
                className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={submit}
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("post_listing")}
        </button>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">{children}</div>;
}
function Label({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <div className="text-sm font-semibold text-foreground">
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
      {optional && <span className="ml-1 text-xs font-normal text-text-hint">optional</span>}
    </div>
  );
}
