import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AvatarCropper } from "@/components/AvatarCropper";
import { CategoryImage } from "@/components/CategoryImage";
import { ProfileEditSkeleton } from "@/components/SkeletonFeed";


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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; photo_url: string }[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);


  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(file)) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setPendingAvatar(dataUrl);
  }

  async function saveCroppedAvatar(cropped: string) {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: cropped })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(cropped);
      setPendingAvatar(null);
      toast.success(lang === "km" ? "បានធ្វើបច្ចុប្បន្នភាពរូបភាព" : "Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setUploadingAvatar(false);
    }
  }


  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, about_me, is_provider, is_coordinator, is_organization, is_client",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) {
          toast.error(error.message);
          setLoaded(true);
          return;
        }
        if (!data) {
          setLoaded(true);
          return;
        }
        setFullName(data.full_name ?? "");
        const { data: phoneVal } = await supabase.rpc("get_user_phone", { _uid: user.id });
        setPhone(((phoneVal as string | null) ?? "").replace("+855", ""));
        setAboutMe(data.about_me ?? "");
        setAvatarUrl(data.avatar_url);
        setRoles({
          is_provider: data.is_provider,
          is_coordinator: data.is_coordinator,
          is_organization: data.is_organization,
          is_client: data.is_client,
        });
        setLoaded(true);
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
    void supabase
      .from("portfolio_photos")
      .select("id, photo_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPhotos(data ?? []));
  }, [user]);

  async function onPickPortfolioPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(file)) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setPendingPhoto(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function savePortfolioPhoto(cropped: string) {
    if (!user) return;
    setSavingPhoto(true);
    try {
      const { data, error } = await supabase
        .from("portfolio_photos")
        .insert({ user_id: user.id, photo_url: cropped })
        .select("id, photo_url")
        .single();
      if (error) throw error;
      if (data) setPhotos((p) => [data, ...p]);
      setPendingPhoto(null);
      toast.success(lang === "km" ? "បានរក្សាទុករូបថត" : "Photo saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function removePortfolioPhoto(id: string) {
    const prev = photos;
    setPhotos((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("portfolio_photos").delete().eq("id", id);
    if (error) {
      setPhotos(prev);
      toast.error(error.message);
    }
  }

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
        })
        .eq("id", user.id);
      if (error) throw error;

      const { error: roleErr } = await supabase.rpc("update_my_role_flags", {
        _is_provider: roles.is_provider,
        _is_coordinator: roles.is_coordinator,
        _is_organization: roles.is_organization,
        _is_client: roles.is_client,
      });
      if (roleErr) throw roleErr;

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

  if (!loaded) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
          <Link to="/profile" className="rounded-full p-2 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-center text-base font-semibold">{t("edit_profile")}</h1>
          <div className="w-9" />
        </header>
        <ProfileEditSkeleton />
      </div>
    );
  }

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
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-primary p-1.5 disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories
              .filter((c) => c.code !== "D4")
              .map((c) => {
                const sel = selected.has(c.id);
                const name = lang === "km" ? c.name_km : c.name_en;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const n = new Set(selected);
                      if (n.has(c.id)) n.delete(c.id);
                      else n.add(c.id);
                      setSelected(n);
                    }}
                    className={`relative aspect-[4/5] overflow-hidden rounded-2xl border transition active:scale-[0.98] ${
                      sel
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border"
                    }`}
                  >
                    <div className="absolute inset-0">
                      <CategoryImage code={c.code} name={name} />
                    </div>
                    <div className="absolute inset-x-3 bottom-3">
                      <span
                        className={`block w-full rounded-full px-3 py-2 text-center text-[11px] font-semibold shadow-sm backdrop-blur-sm transition ${
                          sel
                            ? "bg-primary text-primary-foreground"
                            : "bg-white/90 text-foreground"
                        }`}
                      >
                        {name}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <Label>{`${t("portfolio")} (${photos.length})`}</Label>
            <button
              type="button"
              onClick={() => portfolioInputRef.current?.click()}
              className="text-xs font-semibold text-primary"
            >
              {t("add_photos")}
            </button>
            <input
              ref={portfolioInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickPortfolioPhoto}
            />
          </div>

          {pendingPhoto && (
            <AvatarCropper
              src={pendingPhoto}
              cropShape="rect"
              saving={savingPhoto}
              onCancel={() => setPendingPhoto(null)}
              onConfirm={(cropped) => void savePortfolioPhoto(cropped)}
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square">
                <img
                  src={p.photo_url}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => void removePortfolioPhoto(p.id)}
                  className="absolute right-1 top-1 rounded-full bg-foreground/70 p-0.5 text-background"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => portfolioInputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background text-primary active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" />
              <span className="mt-1 text-[11px] font-medium">{t("add")}</span>
            </button>
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

      {pendingAvatar && (
        <AvatarCropper
          src={pendingAvatar}
          saving={uploadingAvatar}
          onCancel={() => setPendingAvatar(null)}
          onConfirm={(cropped) => void saveCroppedAvatar(cropped)}
        />
      )}
    </div>

  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-foreground">{children}</div>;
}
