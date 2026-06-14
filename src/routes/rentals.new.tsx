import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Plus, X, Truck, HardHat, Wrench, Hammer } from "lucide-react";
import { ProvinceSelect } from "@/components/ProvinceSelect";

import { toast } from "sonner";
import { AutofillHint } from "@/components/AutofillHint";
import { smartAutofill } from "@/lib/smart-autofill.functions";

export const Route = createFileRoute("/rentals/new")({
  component: () => (
    <RequireAuth>
      <NewRentalPage />
    </RequireAuth>
  ),
});

type Cat = "vehicles" | "heavy" | "light" | "tools";

const CATS: {
  id: Cat;
  icon: typeof Truck;
  titleKey: "cat_vehicles" | "cat_heavy" | "cat_light_machinery" | "cat_tools";
  descKey: "cat_vehicles_desc" | "cat_heavy_desc" | "cat_light_desc" | "cat_tools_desc";
}[] = [
  { id: "vehicles", icon: Truck, titleKey: "cat_vehicles", descKey: "cat_vehicles_desc" },
  { id: "heavy", icon: HardHat, titleKey: "cat_heavy", descKey: "cat_heavy_desc" },
  { id: "light", icon: Wrench, titleKey: "cat_light_machinery", descKey: "cat_light_desc" },
  { id: "tools", icon: Hammer, titleKey: "cat_tools", descKey: "cat_tools_desc" },
];

function NewRentalPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Cat | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const [minDays, setMinDays] = useState("1");
  const [quantity, setQuantity] = useState("");
  const [availability, setAvailability] = useState<"now" | "from_date">("now");
  const [availableFrom, setAvailableFrom] = useState("");
  const [location, setLocation] = useState("");
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
      const result = await fillForm({ data: { flow: "rental", ...input } });
      if (!result || id !== requestId.current) return;
      const filled = new Set<string>();
      if (!title.trim() && result.name) {
        setTitle(result.name);
        filled.add("title");
      }
      if (!description.trim() && result.description) {
        setDescription(result.description);
        filled.add("description");
      }
      if (!category && CATS.some((c) => c.id === result.category)) {
        setCategory(result.category as Cat);
        filled.add("category");
      }
      if (!quantity && result.quantity) {
        setQuantity(result.quantity.replace(/\D/g, ""));
        filled.add("quantity");
      }
      if (minDays === "1" && result.durationDays) {
        setMinDays(result.durationDays.replace(/\D/g, "") || "1");
        filled.add("duration");
      }
      setAutofilled((previous) => new Set([...previous, ...filled]));
    } catch {
      // Silent fallback keeps manual entry available.
    } finally {
      if (id === requestId.current) setAutofilling(false);
    }
  }

  useEffect(() => {
    const text = [title, description].filter(Boolean).join(". ").trim();
    if (text.length < 3) return;
    const timer = window.setTimeout(() => void runAutofill({ text }), 800);
    return () => window.clearTimeout(timer);
  }, [title, description]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (photos.length >= 4) {
      toast.error(t("max_4_photos"));
      return;
    }
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      void runAutofill({ imageDataUrl, text: [title, description].filter(Boolean).join(". ") });
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
    if (!title.trim() || !category || !price || !location.trim()) {
      toast.error(t("fill_required_fields"));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("rental_listings")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description:
            [description.trim(), quantity ? `Quantity: ${quantity}` : ""]
              .filter(Boolean)
              .join("\n") || null,
          category,
          price_per_day: Number(price),
          currency,
          min_days: Number(minDays) || 1,
          availability,
          available_from: availability === "from_date" ? availableFrom || null : null,
          location: location.trim(),
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (photos.length) {
        await supabase
          .from("rental_photos")
          .insert(photos.map((url) => ({ listing_id: data.id, photo_url: url })));
      }
      toast.success(t("rental_review_notice"));
      nav({ to: "/profile" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-[#534AB7] px-2 text-white">
        <Link to="/profile" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("list_for_rent")}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        <Card>
          <Label>
            {t("photos")}{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{t("max_4")}</span>
          </Label>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} />
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={photos.length >= 4}
              className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-[#7F77DD] bg-[#EEEDFE] text-[#534AB7] active:scale-95 disabled:opacity-40"
            >
              <Plus className="h-5 w-5" />
            </button>
            {photos.map((src, i) => (
              <div key={i} className="relative aspect-square">
                <img src={src} className="h-full w-full rounded-lg object-cover" alt="" />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-foreground/70 p-0.5 text-background"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - photos.length) }).map((_, i) => (
              <div key={`ph-${i}`} className="aspect-square rounded-lg bg-[#EEEDFE]/60" />
            ))}
          </div>
        </Card>

        <Card>
          <Label>{t("details")}</Label>
          <div>
            <p className="mb-1 text-sm font-medium">
              {t("rental_name")} <span className="text-destructive">*</span>
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("rental_name_ph")}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[#534AB7]"
            />
            <AutofillHint loading={autofilling && !title} filled={autofilled.has("title")} />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">
              {t("description")}{" "}
              <span className="text-xs font-normal text-text-hint">{t("optional")}</span>
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("rental_desc_ph")}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-[#534AB7]"
            />
            <AutofillHint
              loading={autofilling && !description}
              filled={autofilled.has("description")}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">
              {t("category_label")} <span className="text-destructive">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATS.map((c) => {
                const sel = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      sel
                        ? "border-[1.5px] border-[#534AB7] bg-[#EEEDFE]"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{t(c.titleKey)}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{t(c.descKey)}</div>
                  </button>
                );
              })}
            </div>
            <AutofillHint loading={autofilling && !category} filled={autofilled.has("category")} />
          </div>
        </Card>

        <Card>
          <Label>{t("pricing_availability")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-sm font-medium">
                {t("price_per_day_label")} <span className="text-destructive">*</span>
              </p>
              <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-[#534AB7]">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value === "KHR" ? "KHR" : "USD")}
                  aria-label={t("currency")}
                  className="h-full border-r border-border bg-muted px-2 text-xs font-semibold text-foreground outline-none"
                >
                  <option value="USD">$ USD</option>
                  <option value="KHR">៛ KHR</option>
                </select>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">
                {t("min_days")}{" "}
                <span className="text-xs font-normal text-text-hint">{t("optional")}</span>
              </p>
              <input
                value={minDays}
                onChange={(e) => setMinDays(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="1"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[#534AB7]"
              />
              <AutofillHint loading={autofilling} filled={autofilled.has("duration")} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">
              {t("quantity")}{" "}
              <span className="text-xs font-normal text-text-hint">{t("optional")}</span>
            </p>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="1"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <AutofillHint loading={autofilling && !quantity} filled={autofilled.has("quantity")} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("available_from")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAvailability("now")}
                className={`h-11 rounded-lg border text-sm font-semibold transition ${
                  availability === "now"
                    ? "border-[#534AB7] bg-[#EEEDFE] text-[#26215C]"
                    : "border-border bg-background text-foreground"
                }`}
              >
                {t("now")}
              </button>
              <input
                type="date"
                value={availableFrom}
                onChange={(e) => {
                  setAvailableFrom(e.target.value);
                  setAvailability("from_date");
                }}
                placeholder={t("pick_a_date")}
                className={`h-11 rounded-lg border px-3 text-sm transition ${
                  availability === "from_date"
                    ? "border-[#534AB7] bg-[#EEEDFE]"
                    : "border-border bg-background"
                }`}
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">
              {t("location")} <span className="text-destructive">*</span>
            </p>
            <ProvinceSelect
              value={location}
              onChange={setLocation}
              accentClass="focus-within:border-[#534AB7]"
            />
          </div>
        </Card>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={submit}
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#534AB7] text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("publish_for_rent")}
        </button>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 rounded-xl bg-surface p-3 shadow-card">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-bold text-foreground">{children}</div>;
}
