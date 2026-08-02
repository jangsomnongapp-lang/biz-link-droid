import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { normalizePassword } from "@/lib/password";
import { phoneToEmail, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, Eye, EyeOff, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ProvinceSelect } from "@/components/ProvinceSelect";


export const Route = createFileRoute("/supplier/join/$token")({
  component: SupplierJoinPage,
});

interface SupplierCategory {
  id: string;
  code: string;
  name_en: string;
  name_km: string;
}

function SupplierJoinPage() {
  const { token } = Route.useParams();
  const { t, lang, setLang } = useI18n();

  const LangToggle = ({ dark = false }: { dark?: boolean }) => (
    <div
      className={`flex overflow-hidden rounded-pill text-[11px] font-semibold ${
        dark ? "bg-white/95 text-foreground" : "border border-border bg-surface text-foreground"
      }`}
    >
      {(["en", "km"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`flex items-center gap-1 px-2.5 py-1 transition ${
            lang === l ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          <span className="text-sm leading-none">{l === "km" ? "🇰🇭" : "🇬🇧"}</span>
          <span>{l === "km" ? "ខ្មែរ" : "EN"}</span>
        </button>
      ))}
    </div>
  );
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0 = welcome
  const [cats, setCats] = useState<SupplierCategory[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const [logoData, setLogoData] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [productPhotos, setProductPhotos] = useState<string[]>([]);
  const logoRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Validate invite + redirect already-signed-in users
  useEffect(() => {
    void supabase
      .rpc("get_supplier_invite_by_token", { _token: token })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return setInviteValid(false);
        if (row.used_by) return setInviteValid(false);
        if (row.expires_at && new Date(row.expires_at) < new Date()) return setInviteValid(false);
        setInviteValid(true);
      });
  }, [token]);

  // Note: logged-in users can also use the invite to create a supplier store
  // linked to their existing account — no redirect.

  useEffect(() => {
    void supabase
      .from("supplier_categories")
      .select("id, code, name_en, name_km")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCats(data ?? []));
  }, []);

  function toggleCat(id: string) {
    const next = new Set(selectedCats);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCats(next);
  }

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(f)) return;
    setLogoData(await fileToDataUrl(f));
  }

  async function onPickProductPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (productPhotos.length >= 5) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(f)) return;
    setProductPhotos([...productPhotos, await fileToDataUrl(f)]);
  }

  function removePhoto(i: number) {
    setProductPhotos(productPhotos.filter((_, idx) => idx !== i));
  }

  async function submit() {
    // If already logged in, skip auth and use current user
    const isLoggedIn = !!user;
    if (!storeName.trim()) {
      toast.error(lang === "km" ? "សូមបំពេញឈ្មោះហាង" : "Please enter store name");
      return;
    }
    if (!isLoggedIn && (!phone.trim() || password.length < 1)) {
      toast.error(lang === "km" ? "សូមបំពេញគ្រប់ប្រអប់" : "Please fill all fields");
      return;
    }
    setSubmitting(true);
    try {
      let userId: string;
      let phoneFmt: string | null = null;

      if (isLoggedIn) {
        userId = user!.id;
        // Consume invite first — the RPC flips is_supplier=true (required by RLS on supplier_stores)
        const { error: invErr } = await supabase.rpc("consume_supplier_invite", { _token: token });
        if (invErr) throw invErr;
      } else {
        const email = phoneToEmail(phone);
        phoneFmt = `+855${phone.replace(/\D/g, "")}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password: normalizePassword(password),
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: {
              full_name: storeName.trim(),
              phone: phoneFmt,
              language: lang,
              is_supplier: true,
            },
          },
        });
        if (error) throw error;
        const newId = data.user?.id;
        if (!newId) throw new Error("Signup failed");
        userId = newId;
      }


      // Insert store
      const { data: storeRow, error: storeErr } = await supabase
        .from("supplier_stores")
        .insert({
          user_id: userId,
          name: storeName.trim(),
          location: location.trim() || null,
          description: description.trim() || null,
          logo_url: logoData,
          phone: phoneFmt,
          status: "pending",
        })
        .select("id")
        .single();
      if (storeErr) throw storeErr;
      const storeId = storeRow.id;

      // Categories
      if (selectedCats.size > 0) {
        await supabase.from("supplier_store_categories").insert(
          Array.from(selectedCats).map((cid) => ({ store_id: storeId, category_id: cid })),
        );
      }
      // Photos
      if (productPhotos.length > 0) {
        await supabase.from("supplier_store_photos").insert(
          productPhotos.map((url, i) => ({ store_id: storeId, photo_url: url, sort_order: i })),
        );
      }
      // For new signups, consume the invite now (logged-in users already did above)
      if (!isLoggedIn) {
        await supabase.rpc("consume_supplier_invite", { _token: token });
      }

      toast.success(lang === "km" ? "បានបញ្ជូន!" : "Submitted!");
      nav({ to: "/home" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (inviteValid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }
  if (inviteValid === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold text-destructive">{t("invalid_invite")}</p>
        <Link to="/" className="text-sm font-medium text-primary underline">
          {t("login")}
        </Link>
      </div>
    );
  }

  // STEP 0: Welcome screen
  if (step === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-primary text-primary-foreground">
        <div className="flex justify-end px-5 pt-5">
          <LangToggle dark />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-12 text-center">

          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-card">
            <span className="text-3xl">📍</span>
          </div>
          <span className="mt-5 rounded-full border border-amber-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            {t("exclusive_access")}
          </span>
          <h1 className="mt-3 text-2xl font-bold">{t("welcome_supplier")}</h1>
          <p className="mt-2 max-w-xs text-sm opacity-90">{t("welcome_supplier_desc")}</p>
          <button
            onClick={() => setStep(1)}
            className="mt-8 h-12 w-full max-w-xs rounded-xl bg-white text-base font-bold text-primary shadow-card active:scale-[0.98]"
          >
            {t("register_my_store")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="bg-primary px-5 pb-6 pt-5 text-primary-foreground">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2) : setStep(0))}
            className="rounded-full p-1 active:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">{t("app_name")}</h2>
          <span className="text-xs font-medium opacity-80">{t("step_of", { n: step })}</span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 py-6">
        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("what_do_you_sell")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("select_all_apply")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {cats.map((c) => {
                const sel = selectedCats.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCat(c.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      sel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-foreground"
                    }`}
                  >
                    {lang === "km" ? c.name_km : c.name_en}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("your_store_details")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("help_customers_find")}</p>

            {/* Logo upload */}
            <div className="mt-5 flex flex-col items-center">
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickLogo}
              />
              <button
                onClick={() => logoRef.current?.click()}
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5"
              >
                {logoData ? (
                  <img src={logoData} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-7 w-7 text-primary" />
                )}
              </button>
              <p className="mt-2 text-xs text-primary">{t("add_store_logo")}</p>
            </div>

            <div className="mt-5 space-y-4">
              <Field label={`${t("store_name")} *`}>
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder={t("store_name_ph")}
                  className="h-12 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label={`${t("store_location")} *`}>
                <ProvinceSelect value={location} onChange={setLocation} placeholder={t("store_location_ph")} />

              </Field>
              <Field label={`${t("store_description")} — ${t("optional_max_150")}`}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 150))}
                  placeholder={t("store_description_ph")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
                />
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  {t("featured_products")}{" "}
                  <span className="text-xs text-muted-foreground">— {t("optional_max_5_photos")}</span>
                </p>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickProductPhoto}
                />
                <div className="grid grid-cols-5 gap-2">
                  {productPhotos.map((p, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                      <img src={p} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {productPhotos.length < 5 && (
                    <button
                      onClick={() => photoRef.current?.click()}
                      className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-primary/40 bg-primary/5 text-primary"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("almost_there")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user ? (lang === "km" ? "បញ្ជូនហាងសម្រាប់ការត្រួតពិនិត្យ" : "Submit your store for review") : t("create_account_submit")}
            </p>
            <div className="mt-5 space-y-4">
              {!user && (
                <>
                  <Field label={`${t("phone")} *`}>
                    <div className="flex h-12 items-center overflow-hidden rounded-lg border border-border bg-surface focus-within:border-primary">
                      <span className="border-r border-border px-3 text-sm font-medium text-muted-foreground">
                        +855
                      </span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        inputMode="tel"
                        placeholder={t("phone_ph")}
                        className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
                      />
                    </div>
                  </Field>
                  <Field label={`${t("password")} *`}>
                    <div className="flex h-12 items-center overflow-hidden rounded-lg border border-border bg-surface focus-within:border-primary">
                      <input
                        type={showPwd ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
                        placeholder="••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="px-3 text-sm font-medium text-primary"
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                </>
              )}

              <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-xs text-amber-800">
                ℹ️ {t("store_review_notice")}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-surface px-5 py-4">
        {step > 1 && (
          <button
            onClick={() => setStep((step - 1) as 1 | 2)}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-primary text-sm font-semibold text-primary active:scale-[0.98]"
          >
            {t("back")}
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={() => setStep((step + 1) as 2 | 3)}
            disabled={step === 1 && selectedCats.size === 0}
            className="flex h-12 flex-[2] items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {t("next")}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="flex h-12 flex-[2] items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? t("loading") : t("submit_for_review")}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
