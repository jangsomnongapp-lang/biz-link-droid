import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/edit")({
  component: () => (
    <RequireAuth>
      <EditProfilePage />
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

function EditProfilePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [roles, setRoles] = useState({
    is_provider: false,
    is_coordinator: false,
    is_organization: false,
    is_client: false,
  });
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name ?? "");
        setPhone((data.phone ?? "").replace("+855", ""));
        setAboutMe(data.about_me ?? "");
        setAvatarUrl(data.avatar_url);
        setRoles({
          is_provider: data.is_provider,
          is_coordinator: data.is_coordinator,
          is_organization: data.is_organization,
          is_client: data.is_client,
        });
      });
    void supabase
      .from("categories")
      .select("id, name_en, name_km, group_en, code")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));
    void supabase
      .from("user_categories")
      .select("category_id")
      .eq("user_id", user.id)
      .then(({ data }) => setSelected(new Set((data ?? []).map((r) => r.category_id))));
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone ? `+855${phone.replace(/\D/g, "")}` : null,
          about_me: aboutMe.trim() || null,
          ...roles,
        })
        .eq("id", user.id);
      if (error) throw error;

      // Replace user_categories
      await supabase.from("user_categories").delete().eq("user_id", user.id);
      const rows = Array.from(selected).map((cid) => ({ user_id: user.id, category_id: cid }));
      if (rows.length) await supabase.from("user_categories").insert(rows);

      toast.success(lang === "km" ? "បានរក្សាទុក" : "Saved");
      nav({ to: "/profile" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const roleItems = [
    { key: "is_provider" as const, label: t("role_provider") },
    { key: "is_coordinator" as const, label: t("role_coordinator") },
    { key: "is_organization" as const, label: t("role_organization") },
    { key: "is_client" as const, label: t("role_client") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/profile" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("edit_profile")}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        <div className="flex flex-col items-center gap-2 rounded-xl bg-surface p-5 shadow-card">
          <div className="relative">
            <Avatar name={fullName} url={avatarUrl} size={80} />
            <button className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-primary p-1.5">
              <Camera className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
          </div>
        </div>

        <Card>
          <Label>{t("full_name")}</Label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Card>

        <Card>
          <Label>{t("phone")}</Label>
          <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
            <span className="border-r border-border px-3 text-sm font-medium text-muted-foreground">+855</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
        </Card>

        <Card>
          <Label>{t("about_me")}</Label>
          <textarea
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            placeholder={t("about_me_ph")}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
        </Card>

        <Card>
          <Label>{t("who_are_you")}</Label>
          <div className="flex flex-wrap gap-2">
            {roleItems.map((r) => {
              const sel = roles[r.key];
              return (
                <button
                  key={r.key}
                  onClick={() => setRoles({ ...roles, [r.key]: !sel })}
                  className={`rounded-pill border px-3.5 py-1.5 text-xs font-medium transition ${
                    sel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <Label>{t("your_specialties")}</Label>
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
                    className={`rounded-pill border px-3 py-1.5 text-xs font-medium transition ${
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
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? t("loading") : t("save_changes")}
        </button>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-foreground">{children}</div>;
}
