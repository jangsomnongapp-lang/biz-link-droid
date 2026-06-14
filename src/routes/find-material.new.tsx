import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, MapPin, Globe2 } from "lucide-react";
import { SignedImage } from "@/components/SignedImage";
import { AutofillHint } from "@/components/AutofillHint";
import { smartAutofill } from "@/lib/smart-autofill.functions";

export const Route = createFileRoute("/find-material/new")({
  component: () => (
    <RequireAuth>
      <NewMaterialPage />
    </RequireAuth>
  ),
});

type Cat =
  | "electrical" | "cement" | "steel" | "zinc" | "tools"
  | "timber" | "sanitary" | "paint" | "other";

const CATEGORIES: { id: Cat; en: string; km: string; emoji: string }[] = [
  { id: "electrical", en: "Electrical", km: "អគ្គិសនី", emoji: "⚡" },
  { id: "cement",     en: "Cement",     km: "ស៊ីម៉ងត៍",  emoji: "🧱" },
  { id: "steel",      en: "Steel",      km: "ដែក",       emoji: "🔩" },
  { id: "zinc",       en: "Zinc",       km: "ស័ង្កសី",   emoji: "🏠" },
  { id: "tools",      en: "Tools",      km: "ឧបករណ៍",   emoji: "🛠️" },
  { id: "timber",     en: "Timber",     km: "ឈើ",        emoji: "🪵" },
  { id: "sanitary",   en: "Sanitary",   km: "បង្គន់",   emoji: "🚿" },
  { id: "paint",      en: "Paint",      km: "ថ្នាំលាប",  emoji: "🎨" },
  { id: "other",      en: "Other",      km: "ផ្សេងៗ",    emoji: "📦" },
];

function NewMaterialPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [activeCount, setActiveCount] = useState(0);
  const [category, setCategory] = useState<Cat | null>(null);
  const [itemName, setItemName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [autofilling, setAutofilling] = useState(false);
  const [autofilled, setAutofilled] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState<"near_me" | "anywhere">("near_me");
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fillForm = useServerFn(smartAutofill);
  const requestId = useRef(0);

  async function runAutofill(input: { text?: string; imageDataUrl?: string }) {
    const id = ++requestId.current;
    setAutofilling(true);
    try {
      const result = await fillForm({ data: { flow: "material", ...input } });
      if (!result || id !== requestId.current) return;
      const filled = new Set<string>();
      if (!itemName.trim() && result.name) { setItemName(result.name); filled.add("name"); }
      if (!category && CATEGORIES.some((c) => c.id === result.category)) { setCategory(result.category as Cat); filled.add("category"); }
      if (!note.trim() && result.description) { setNote(result.description.slice(0, 200)); filled.add("description"); }
      if (!quantity && result.quantity) { setQuantity(result.quantity.replace(/\D/g, "")); filled.add("quantity"); }
      setSuggestions([...result.related, ...result.alternatives].filter(Boolean).slice(0, 6));
      setAutofilled((previous) => new Set([...previous, ...filled]));
    } catch {
      // Silent fallback: every field remains manually editable.
    } finally {
      if (id === requestId.current) setAutofilling(false);
    }
  }

  useEffect(() => {
    const text = [itemName, note].filter(Boolean).join(". ").trim();
    if (text.length < 3) return;
    const timer = window.setTimeout(() => void runAutofill({ text }), 800);
    return () => window.clearTimeout(timer);
  }, [itemName, note]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("material_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .then(({ count }) => setActiveCount(count ?? 0));
  }, [user]);

  const limitReached = activeCount >= 10;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (photos.length >= 3) { toast.error(lang === "km" ? "អតិបរមា ៣ រូប" : "Max 3 photos"); return; }
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(file)) return;
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      void runAutofill({ imageDataUrl, text: [itemName, note].filter(Boolean).join(". ") });
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("material-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      // Store the storage PATH (not a public URL); bucket is private and reads use signed URLs.
      setPhotos((p) => [...p, path]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function getGeo(): Promise<{ lat: number; lng: number } | null> {
    if (locationFilter !== "near_me") return null;
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: false },
      );
    });
  }

  async function submit() {
    if (!user) return;
    if (!category) { toast.error(lang === "km" ? "ជ្រើសប្រភេទ" : "Select a category"); return; }
    if (photos.length < 1) { toast.error(lang === "km" ? "ត្រូវការយ៉ាងហោចណាស់ ១ រូប" : "At least 1 photo required"); return; }
    if (!quantity || Number(quantity) <= 0) { toast.error(lang === "km" ? "បញ្ចូលចំនួន" : "Enter quantity"); return; }
    setSubmitting(true);
    try {
      const geo = await getGeo();
      const { data, error } = await supabase
        .from("material_requests")
        .insert({
          user_id: user.id,
          category,
          quantity: Number(quantity),
          note: [itemName.trim(), note.trim()].filter(Boolean).join(" — ") || null,
          location_filter: locationFilter,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
        })
        .select("id")
        .single();
      if (error) {
        if (error.message?.includes("active_request_limit_reached")) {
          toast.error(lang === "km"
            ? "អ្នកមានការស្វែងរក ១០ រួចហើយ។ បោះបង់មួយដើម្បីបន្ត។"
            : "You have 10 active searches. Cancel one to start a new search.");
          return;
        }
        throw error;
      }
      if (photos.length) {
        await supabase
          .from("material_request_photos")
          .insert(photos.map((url, i) => ({ request_id: data.id, photo_url: url, sort_order: i })));
      }
      toast.success(lang === "km" ? "បានផ្ញើទៅអ្នកផ្គត់ផ្គង់" : "Sent to suppliers");
      nav({ to: "/find-material/mine" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  if (limitReached) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="m-4 rounded-2xl bg-surface p-6 text-center shadow-card">
          <p className="text-sm font-semibold text-foreground">
            {lang === "km"
              ? "អ្នកបានឈានដល់ដែនកំណត់ ១០ ការស្វែងរកសកម្ម។ សូមបោះបង់មួយដើម្បីចាប់ផ្តើមការស្វែងរកថ្មី។"
              : "You have reached your limit of 10 active searches. Please cancel one to start a new search."}
          </p>
          <Link
            to="/find-material/mine"
            className="mt-4 inline-block rounded-xl bg-[#c87000] px-4 py-2 text-sm font-semibold text-white"
          >
            {lang === "km" ? "គ្រប់គ្រងការស្វែងរក" : "Manage my searches"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-32">
      <Header />

      <section className="mt-3 bg-surface p-4 shadow-card">
        <label className="mb-2 block text-sm font-semibold text-foreground">
          {lang === "km" ? "ប្រភេទ *" : "Category *"}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-xs font-semibold transition-colors ${
                  active
                    ? "border-[#c87000] bg-[#c87000]/10 text-[#c87000]"
                    : "border-border bg-background text-foreground"
                }`}
              >
                <span className="text-xl">{c.emoji}</span>
                {lang === "km" ? c.km : c.en}
              </button>
            );
          })}
        </div>
        <AutofillHint loading={autofilling && !category} filled={autofilled.has("category")} />
      </section>

      <section className="mt-2 bg-surface p-4 shadow-card">
        <label className="mb-2 block text-sm font-semibold text-foreground">
          {lang === "km" ? "រូបថតផលិតផល * (អប្បបរមា ១ · អតិបរមា ៣)" : "Product photos * (Min 1 · Max 3)"}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => {
            const url = photos[i];
            if (url) {
              return (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  <SignedImage
                    bucket="material-photos"
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    fallback={<div className="flex h-full w-full items-center justify-center text-muted-foreground/40">…</div>}
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border bg-background text-muted-foreground active:bg-muted"
              >
                <Plus className="h-5 w-5" />
              </button>
            );
          })}
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        </div>
      </section>

      <section className="mt-2 bg-surface p-4 shadow-card">
        <label className="mb-2 block text-sm font-semibold text-foreground">
          {lang === "km" ? "ឈ្មោះសម្ភារៈ" : "Material name"}
        </label>
        {autofilling && !itemName ? <div className="h-11 animate-pulse rounded-xl bg-primary/10" /> : (
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value.slice(0, 120))}
            placeholder={lang === "km" ? "ឧ. ស៊ីម៉ងត៍ 50kg" : "e.g. Cement 50kg"}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
        )}
        <AutofillHint loading={autofilling && !itemName} filled={autofilled.has("name")} />
      </section>

      <section className="mt-2 bg-surface p-4 shadow-card">
        <label className="mb-2 block text-sm font-semibold text-foreground">
          {lang === "km" ? "ចំនួនត្រូវការ *" : "Quantity needed *"}
        </label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="30"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-[#c87000] focus:outline-none"
        />
        <AutofillHint loading={autofilling && !quantity} filled={autofilled.has("quantity")} />
      </section>

      <section className="mt-2 bg-surface p-4 shadow-card">
        <label className="mb-2 block text-sm font-semibold text-foreground">
          {lang === "km" ? "កំណត់ចំណាំ" : "Note"} <span className="text-muted-foreground">({lang === "km" ? "ស្រេចចិត្ត" : "optional"})</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          placeholder={lang === "km" ? "ឧ. ត្រូវការដឹកជញ្ជូនទៅសៀមរាប" : "e.g. Need delivery to Siem Reap centre"}
          className="min-h-[64px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-[#c87000] focus:outline-none"
        />
        <AutofillHint loading={autofilling && !note} filled={autofilled.has("description")} />
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => setItemName(suggestion)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-2 bg-surface p-4 shadow-card">
        <label className="mb-2 block text-sm font-semibold text-foreground">
          {lang === "km" ? "ទីតាំងអ្នកផ្គត់ផ្គង់" : "Supplier location"}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLocationFilter("near_me")}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-xs font-semibold ${
              locationFilter === "near_me" ? "border-[#c87000] bg-[#c87000]/10 text-[#c87000]" : "border-border text-foreground"
            }`}
          >
            <MapPin className="h-5 w-5" />
            {lang === "km" ? "ជិតខ្ញុំ" : "Near me"}
            <span className="text-[10px] font-normal opacity-80">
              {lang === "km" ? "ក្នុង ២០គម" : "Within 20km"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLocationFilter("anywhere")}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-xs font-semibold ${
              locationFilter === "anywhere" ? "border-[#c87000] bg-[#c87000]/10 text-[#c87000]" : "border-border text-foreground"
            }`}
          >
            <Globe2 className="h-5 w-5" />
            {lang === "km" ? "គ្រប់ទីកន្លែង" : "Anywhere"}
            <span className="text-[10px] font-normal opacity-80">
              {lang === "km" ? "ទូទាំងកម្ពុជា" : "All Cambodia"}
            </span>
          </button>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={submit}
          disabled={submitting || !category}
          className="w-full rounded-xl bg-[#c87000] py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting
            ? (lang === "km" ? "កំពុងផ្ញើ..." : "Sending...")
            : (lang === "km" ? "ផ្ញើសំណើទៅអ្នកផ្គត់ផ្គង់" : "Send request to suppliers")}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {category
            ? (lang === "km"
                ? `អ្នកផ្គត់ផ្គង់ក្នុងប្រភេទ ${CATEGORIES.find((c) => c.id === category)?.km} ${locationFilter === "near_me" ? "ក្នុង ២០គម" : "ទូទាំងកម្ពុជា"} នឹងទទួលបាន`
                : `Suppliers in ${CATEGORIES.find((c) => c.id === category)?.en} ${locationFilter === "near_me" ? "within 20km" : "across Cambodia"} will be notified`)
            : (lang === "km" ? "ជ្រើសប្រភេទមួយ" : "Pick a category first")}
        </p>
      </div>
    </div>
  );
}

function Header() {
  const { lang } = useI18n();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
      <Link to="/find-material" className="rounded-full p-2 active:bg-white/10" aria-label="Back">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h1 className="flex-1 text-center text-base font-semibold">
        {lang === "km" ? "ស្វែងរកថ្មី" : "New search"}
      </h1>
      <span className="w-9" />
    </header>
  );
}
