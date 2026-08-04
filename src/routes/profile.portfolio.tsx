import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { resizeImageFile } from "@/lib/image-resize";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PortfolioGridSkeleton, ListSkeleton } from "@/components/SkeletonFeed";

export const Route = createFileRoute("/profile/portfolio")({
  component: () => (
    <RequireAuth>
      <PortfolioPage />
    </RequireAuth>
  ),
});

interface Photo {
  id: string;
  photo_url: string;
}
interface Listing {
  id: string;
  title: string;
  status: string;
  applicant_count: number;
}

function PortfolioPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    if (!user) return;
    const { data: ph } = await supabase
      .from("portfolio_photos")
      .select("id, photo_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPhotos(ph ?? []);

    const { data: ls } = await supabase
      .from("listings")
      .select("id, title, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const items: Listing[] = [];
    for (const l of ls ?? []) {
      const { count } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", l.id);
      items.push({ ...l, applicant_count: count ?? 0 });
    }
    setListings(items);
    setLoading(false);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    const valid = files.filter((f) => validateImageFile(f));
    if (!valid.length) return;
    setAdding(true);
    try {
      const urls = await Promise.all(valid.map((file) => resizeImageFile(file)));
      const rows = urls.map((photo_url) => ({ user_id: user.id, photo_url }));
      const { error } = await supabase.from("portfolio_photos").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} photo${rows.length > 1 ? "s" : ""} added`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setAdding(false);
    }
  }

  async function removePhoto(id: string) {
    const { error } = await supabase.from("portfolio_photos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  async function toggleStatus(l: Listing) {
    const next = l.status === "active" ? "closed" : "active";
    const { error } = await supabase.from("listings").update({ status: next }).eq("id", l.id);
    if (error) return toast.error(error.message);
    setListings((arr) => arr.map((x) => (x.id === l.id ? { ...x, status: next } : x)));
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/profile" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("update_profile")}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        {/* Portfolio */}
        <div className="rounded-xl bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">
              {t("portfolio")} ({photos.length})
            </h3>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onPickFile} />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={adding}
              className="flex h-8 shrink-0 items-center gap-1 rounded-pill bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-card active:scale-[0.99] disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {adding ? t("loading") : t("add_photos")}
            </button>
          </div>
          {loading ? (
            <PortfolioGridSkeleton count={6} />
          ) : (
          <div className="grid grid-cols-3 gap-2">

            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square">
                <img src={p.photo_url} className="h-full w-full rounded-lg object-cover" alt="" />
                <button
                  onClick={() => void removePhoto(p.id)}
                  className="absolute right-1 top-1 rounded-full bg-foreground/70 p-0.5 text-background"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInput.current?.click()}
              disabled={adding}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background text-primary active:scale-[0.98] disabled:opacity-60"
            >
              <Plus className="h-5 w-5" />
              <span className="mt-1 text-[11px] font-medium">{t("add")}</span>
            </button>
          </div>
          )}
        </div>


        {/* My projects */}
        <div className="rounded-xl bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{t("nav_listings")}</h3>
            <Link
              to="/listings/new"
              className="rounded-pill bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground active:scale-[0.99]"
            >
              {t("new_project")}
            </Link>
          </div>
          {loading ? (
            <ListSkeleton count={3} />
          ) : listings.length === 0 ? (
            <p className="text-sm text-text-hint">
              {lang === "km" ? "មិនទាន់មានការងារ" : "No projects yet"}
            </p>
          ) : (
            <div className="space-y-2">
              {listings.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                >
                  <Link
                    to="/listings/$listingId"
                    params={{ listingId: l.id }}
                    className="min-w-0 flex-1"
                  >
                    <div className="truncate text-sm font-semibold text-foreground">{l.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.applicant_count} {t("applicants")}
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-pill px-2.5 py-0.5 text-[10px] font-semibold ${
                        l.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {l.status === "active" ? t("active") : t("closed")}
                    </span>
                    <button
                      onClick={() => void toggleStatus(l)}
                      className="rounded-pill border border-border bg-background px-2.5 py-0.5 text-[10px] font-semibold text-primary active:scale-[0.99]"
                    >
                      {l.status === "active" ? t("close") : t("reopen")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={() => nav({ to: "/profile" })}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99]"
        >
          {t("save_changes")}
        </button>
      </div>
    </div>
  );
}
