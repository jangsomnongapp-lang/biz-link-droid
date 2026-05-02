import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, X, Plus, Camera } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/suppliers/$storeId/edit")({
  component: () => (
    <RequireAuth>
      <SupplierEditPage />
    </RequireAuth>
  ),
});

interface SupplierCategory {
  id: string;
  name_en: string;
  name_km: string;
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function SupplierEditPage() {
  const { storeId } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const [allCats, setAllCats] = useState<SupplierCategory[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ id?: string; url: string }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: s } = await supabase
        .from("supplier_stores")
        .select("user_id, name, location, description, logo_url, phone")
        .eq("id", storeId)
        .maybeSingle();
      if (!s || s.user_id !== user.id) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setName(s.name);
      setLocation(s.location ?? "");
      setDescription(s.description ?? "");
      setPhone(s.phone ?? "");
      setLogo(s.logo_url);

      const [{ data: cats }, { data: scs }, { data: ph }] = await Promise.all([
        supabase.from("supplier_categories").select("id, name_en, name_km").order("sort_order"),
        supabase.from("supplier_store_categories").select("category_id").eq("store_id", storeId),
        supabase
          .from("supplier_store_photos")
          .select("id, photo_url")
          .eq("store_id", storeId)
          .order("sort_order"),
      ]);
      setAllCats(cats ?? []);
      setSelectedCats(new Set(((scs ?? []) as Array<{ category_id: string }>).map((r) => r.category_id)));
      setPhotos(((ph ?? []) as Array<{ id: string; photo_url: string }>).map((p) => ({ id: p.id, url: p.photo_url })));
      setLoading(false);
    })();
  }, [storeId, user]);

  function toggleCat(id: string) {
    const next = new Set(selectedCats);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCats(next);
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLogo(await fileToDataUrl(f));
  }

  async function onAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || photos.length >= 5) return;
    setPhotos([...photos, { url: await fileToDataUrl(f) }]);
  }

  function removePhoto(idx: number) {
    const p = photos[idx];
    if (p.id) setRemovedPhotoIds([...removedPhotoIds, p.id]);
    setPhotos(photos.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim()) {
      toast.error(t("store_name"));
      return;
    }
    setSaving(true);
    try {
      const { error: updErr } = await supabase
        .from("supplier_stores")
        .update({
          name: name.trim(),
          location: location.trim() || null,
          description: description.trim() || null,
          phone: phone.trim() || null,
          logo_url: logo,
        })
        .eq("id", storeId)
        .eq("user_id", user?.id ?? "");
      if (updErr) throw updErr;

      // Sync categories: delete all, re-insert
      const { error: delCatErr } = await supabase
        .from("supplier_store_categories")
        .delete()
        .eq("store_id", storeId);
      if (delCatErr) throw delCatErr;
      if (selectedCats.size > 0) {
        const { error: insCatErr } = await supabase
          .from("supplier_store_categories")
          .insert(Array.from(selectedCats).map((cid) => ({ store_id: storeId, category_id: cid })));
        if (insCatErr) throw insCatErr;
      }

      // Remove deleted photos
      if (removedPhotoIds.length > 0) {
        const { error: delPhErr } = await supabase
          .from("supplier_store_photos")
          .delete()
          .in("id", removedPhotoIds);
        if (delPhErr) throw delPhErr;
      }
      // Insert new photos (those without id)
      const newPhotos = photos.filter((p) => !p.id);
      if (newPhotos.length > 0) {
        const startOrder = photos.length - newPhotos.length;
        const { error: insPhErr } = await supabase
          .from("supplier_store_photos")
          .insert(
            newPhotos.map((p, i) => ({ store_id: storeId, photo_url: p.url, sort_order: startOrder + i })),
          );
        if (insPhErr) throw insPhErr;
      }

      toast.success(t("store_updated"));
      nav({ to: "/suppliers/$storeId", params: { storeId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }
  if (denied) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">{t("admin_only")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-card">
        <Link
          to="/suppliers/$storeId"
          params={{ storeId }}
          className="rounded-full p-1 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">{t("edit_store")}</h1>
      </div>

      <div className="space-y-4 p-4">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => logoInput.current?.click()}
            className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-surface"
          >
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera className="m-auto h-7 w-7 text-muted-foreground" />
            )}
          </button>
          <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogo} />
          <p className="mt-2 text-xs text-muted-foreground">{t("add_store_logo")}</p>
        </div>

        {/* Name */}
        <Field label={t("store_name")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("store_name_ph")}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Field>

        {/* Location */}
        <Field label={t("store_location")}>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("store_location_ph")}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Field>

        {/* Phone */}
        <Field label={t("phone")}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("store_phone_ph")}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Field>

        {/* Description */}
        <Field label={t("store_description")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 150))}
            placeholder={t("store_description_ph")}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-right text-[10px] text-muted-foreground">{description.length}/150</p>
        </Field>

        {/* Categories */}
        <Field label={t("what_do_you_sell")}>
          <div className="flex flex-wrap gap-2">
            {allCats.map((c) => {
              const on = selectedCats.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface text-foreground"
                  }`}
                >
                  {lang === "km" ? c.name_km : c.name_en}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Featured photos */}
        <Field label={`${t("featured_products")} (${photos.length}/5)`}>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p.id ?? `new-${i}`} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                  aria-label={t("remove")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border bg-surface text-muted-foreground"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={onAddPhoto} />
        </Field>
      </div>

      {/* Save */}
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] border-t border-border bg-surface px-5 py-3">
        <button
          onClick={save}
          disabled={saving}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "..." : t("save_changes")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
