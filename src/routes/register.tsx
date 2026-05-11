import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { phoneToEmail, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff, Check, Hammer, Users, Building, Briefcase, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  component: RegisterFlow,
});

interface CategoryRow {
  id: string;
  code: string;
  name_en: string;
  name_km: string;
  group_en: string;
  group_km: string;
}

interface Roles {
  is_provider: boolean;
  is_coordinator: boolean;
  is_organization: boolean;
  is_client: boolean;
  is_specialist: boolean;
}

function RegisterFlow() {
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [roles, setRoles] = useState<Roles>({
    is_provider: false,
    is_coordinator: false,
    is_organization: false,
    is_client: false,
    is_specialist: false,
  });
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/home" });
  }, [user, loading, nav]);

  useEffect(() => {
    void supabase
      .from("categories")
      .select("id, code, name_en, name_km, group_en, group_km")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  const anyRole = roles.is_provider || roles.is_coordinator || roles.is_organization || roles.is_client || roles.is_specialist;
  const needsCats = roles.is_provider || roles.is_coordinator || roles.is_organization;

  function goNextFromStep1() {
    if (!anyRole) return;
    setStep(needsCats ? 2 : 3);
  }
  function goBackFromStep3() {
    setStep(needsCats ? 2 : 1);
  }

  async function submit() {
    if (!fullName.trim() || !phone.trim() || password.length < 6) {
      toast.error(lang === "km" ? "សូមបំពេញគ្រប់ប្រអប់" : "Please fill all fields (password 6+ chars)");
      return;
    }
    setSubmitting(true);
    try {
      const email = phoneToEmail(phone);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: {
            full_name: fullName.trim(),
            phone: `+855${phone.replace(/\D/g, "")}`,
            language: lang,
            ...roles,
          },
        },
      });
      if (error) throw error;
      const userId = data.user?.id;
      if (userId && selectedCats.size > 0) {
        // Wait briefly for profile trigger then insert categories
        const rows = Array.from(selectedCats).map((cid) => ({ user_id: userId, category_id: cid }));
        await supabase.from("user_categories").insert(rows);
      }
      // Record invite join if user came from a referral link (validated server-side)
      if (userId && typeof window !== "undefined") {
        try {
          const ref = localStorage.getItem("invite_ref");
          if (ref) {
            await supabase.rpc("record_invite_join", { _code: ref });
            localStorage.removeItem("invite_ref");
          }
        } catch {
          /* noop */
        }
      }
      toast.success(lang === "km" ? "ស្វាគមន៍!" : "Welcome!");
      nav({ to: "/home" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Blue header with progress */}
      <div className="bg-primary px-5 pb-6 pt-5 text-primary-foreground">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/" className="rounded-full p-1 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-lg font-bold">{t("app_name")}</h2>
          <span className="text-xs font-medium opacity-80">{t("step_of", { n: step })}</span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 py-6">
        {step === 1 && <Step1 roles={roles} setRoles={setRoles} />}
        {step === 2 && (
          <Step2
            categories={categories}
            selected={selectedCats}
            setSelected={setSelectedCats}
          />
        )}
        {step === 3 && (
          <Step3
            fullName={fullName}
            setFullName={setFullName}
            phone={phone}
            setPhone={setPhone}
            password={password}
            setPassword={setPassword}
            showPwd={showPwd}
            setShowPwd={setShowPwd}
          />
        )}
      </div>

      {/* Footer buttons */}
      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-surface px-5 py-4">
        {step > 1 && (
          <button
            onClick={() => (step === 3 ? goBackFromStep3() : setStep(1))}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-primary text-sm font-semibold text-primary active:scale-[0.98]"
          >
            {t("back")}
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={() => (step === 1 ? goNextFromStep1() : setStep(3))}
            disabled={step === 1 ? !anyRole : false}
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
            {submitting ? t("loading") : t("lets_go")}
          </button>
        )}
      </div>
    </div>
  );
}

function Step1({ roles, setRoles }: { roles: Roles; setRoles: (r: Roles) => void }) {
  const { t, lang } = useI18n();
  const items: Array<{ key: keyof Roles; titleKey: Parameters<typeof t>[0]; descKey: Parameters<typeof t>[0]; icon: typeof Hammer }> = [
    { key: "is_provider", titleKey: "role_provider", descKey: "role_provider_desc", icon: Hammer },
    { key: "is_coordinator", titleKey: "role_coordinator", descKey: "role_coordinator_desc", icon: Users },
    { key: "is_organization", titleKey: "role_organization", descKey: "role_organization_desc", icon: Building },
    { key: "is_client", titleKey: "role_client", descKey: "role_client_desc", icon: Briefcase },
    { key: "is_specialist", titleKey: "role_specialist", descKey: "role_specialist_desc", icon: GraduationCap },
  ];
  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">{t("who_are_you")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("select_all_apply")}</p>
      <div className="mt-5 flex flex-col gap-3">
        {items.map(({ key, titleKey, descKey, icon: Icon }) => {
          const checked = roles[key];
          return (
            <button
              key={key}
              onClick={() => setRoles({ ...roles, [key]: !checked })}
              className={`flex items-center gap-3 rounded-xl border-2 bg-surface p-4 text-left transition ${
                checked ? "border-primary" : "border-border"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"
                }`}
              >
                {checked && <Check className="h-4 w-4" strokeWidth={3} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    {t(titleKey)} {lang === "en" ? `/ ${dictKm(titleKey)}` : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{t(descKey)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Helper to show Khmer alongside English label
function dictKm(key: string) {
  const map: Record<string, string> = {
    role_provider: "អ្នកធ្វើការ",
    role_coordinator: "មេក្រុម",
    role_organization: "ក្រុមហ៊ុន",
    role_client: "អ្នកម៉ៅការ",
    role_specialist: "អ្នកជំនាញ",
  };
  return map[key] ?? "";
}

function Step2({
  categories,
  selected,
  setSelected,
}: {
  categories: CategoryRow[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
}) {
  const { t, lang } = useI18n();
  const groups = ["Structure", "Installations", "Finishing", "Other"] as const;
  const groupKey = (g: string) =>
    g === "Structure"
      ? "group_structure"
      : g === "Installations"
        ? "group_installations"
        : g === "Finishing"
          ? "group_finishing"
          : "group_other";

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">{t("your_specialties")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("select_all_apply")}</p>
      <div className="mt-5 space-y-5">
        {groups.map((g) => {
          const cats = categories.filter((c) => c.group_en === g && c.code !== "D4");
          if (cats.length === 0) return null;
          return (
            <div key={g}>
              <h3 className="mb-2 text-xs font-bold tracking-wider text-primary">
                {t(groupKey(g) as Parameters<typeof t>[0])}
              </h3>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => {
                  const isSel = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={`rounded-pill border px-4 py-2 text-sm font-medium transition ${
                        isSel
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
          );
        })}
      </div>
    </div>
  );
}

function Step3({
  fullName,
  setFullName,
  phone,
  setPhone,
  password,
  setPassword,
  showPwd,
  setShowPwd,
}: {
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPwd: boolean;
  setShowPwd: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">{t("your_details")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("almost_done")}</p>
      <div className="mt-5 space-y-4">
        <Field label={t("full_name")}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("full_name_ph")}
            className="h-12 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
          />
        </Field>
        <Field label={t("phone")}>
          <div className="flex h-12 items-center overflow-hidden rounded-lg border border-border bg-surface focus-within:border-primary">
            <span className="border-r border-border px-3 text-sm font-medium text-muted-foreground">+855</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder={t("phone_ph")}
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
        </Field>
        <Field label={t("password")}>
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
