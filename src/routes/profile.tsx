import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Camera, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ProfilePage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  about_me: string | null;
  is_provider: boolean;
  is_coordinator: boolean;
  is_organization: boolean;
  is_client: boolean;
}

function ProfilePage() {
  const { t, lang } = useI18n();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cats, setCats] = useState<{ name_en: string; name_km: string }[]>([]);
  const [stats, setStats] = useState({ posted: 0, applied: 0, contacts: 0 });
  const [portfolio, setPortfolio] = useState<{ id: string; photo_url: string }[]>([]);
  const [myListings, setMyListings] = useState<{ id: string; title: string; status: string }[]>([]);
  const [doingListings, setDoingListings] = useState<{ id: string; title: string; status: string }[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: dataUrl })
        .eq("id", user.id);
      if (error) throw error;
      setProfile((p) => (p ? { ...p, avatar_url: dataUrl } : p));
      toast.success(lang === "km" ? "បានរក្សាទុក" : "Photo updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  }
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("id, full_name, avatar_url, about_me, is_provider, is_coordinator, is_organization, is_client")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    void supabase
      .from("user_categories")
      .select("categories(name_en, name_km)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setCats(((data ?? []).map((r) => r.categories).filter(Boolean) as { name_en: string; name_km: string }[]));
      });
    void supabase
      .from("listings")
      .select("id, title, status", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, count }) => {
        setMyListings(data ?? []);
        setStats((s) => ({ ...s, posted: count ?? 0 }));
      });
    void supabase
      .from("applications")
      .select("id, status, listing:listings(id, title, status)")
      .eq("applicant_id", user.id)
      .then(({ data, count }) => {
        setStats((s) => ({ ...s, applied: count ?? (data?.length ?? 0) }));
        const accepted = (data ?? [])
          .filter((a: any) => a.status === "accepted" && a.listing && a.listing.status !== "closed")
          .map((a: any) => a.listing as { id: string; title: string; status: string });
        setDoingListings(accepted);
      });
    void supabase
      .from("portfolio_photos")
      .select("id, photo_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPortfolio(data ?? []));
  }, [user]);

  const roleLabels: string[] = [];
  if (profile?.is_provider) roleLabels.push(t("role_provider"));
  if (profile?.is_coordinator) roleLabels.push(t("role_coordinator"));
  if (profile?.is_organization) roleLabels.push(t("role_organization"));
  if (profile?.is_client) roleLabels.push(t("role_client"));

  return (
    <div>
      {/* Blue header */}
      <div className="bg-primary px-5 pb-6 pt-5 text-primary-foreground">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("my_profile")}</h2>
          <div className="flex items-center gap-2">
            <Link
              to="/profile/portfolio"
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur active:bg-white/25"
            >
              {t("update_profile")}
            </Link>
            <Link
              to="/profile/edit"
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur active:bg-white/25"
            >
              {t("edit")}
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <Avatar
              name={profile?.full_name}
              url={profile?.avatar_url}
              size={88}
              className="border-4 border-white"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploadingAvatar}
              aria-label={lang === "km" ? "ប្តូររូបថត" : "Change photo"}
              className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-foreground p-1.5 active:scale-95 disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
          </div>
          <h1 className="text-xl font-bold">{profile?.full_name ?? "—"}</h1>
          <p className="text-xs text-white/80">{roleLabels.join(" · ") || " "}</p>
          {cats.length > 0 && (
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {cats.slice(0, 5).map((c, i) => (
                <span key={i} className="rounded-pill bg-white/20 px-2.5 py-0.5 text-[11px] font-medium">
                  {lang === "km" ? c.name_km : c.name_en}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 bg-surface shadow-card">
        {[
          { v: stats.posted, l: t("projects_posted") },
          { v: stats.applied, l: t("applied_to") },
          { v: stats.contacts, l: t("contacts_made") },
        ].map((s, i) => (
          <div key={i} className="flex flex-col items-center py-4 text-center">
            <span className="text-xl font-bold text-primary">{s.v}</span>
            <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{s.l}</span>
          </div>
        ))}
      </div>

      {/* About */}
      <Section title={t("about_me")}>
        <p className="text-sm text-foreground">
          {profile?.about_me || (
            <span className="text-text-hint">{lang === "km" ? "មិនទាន់មាន" : "No description yet"}</span>
          )}
        </p>
      </Section>

      {/* Portfolio */}
      <Section title={`${t("portfolio")} (${portfolio.length})`}>
        {portfolio.length === 0 ? (
          <p className="text-sm text-text-hint">
            {lang === "km" ? "មិនទាន់មានរូបថត" : "No photos yet"}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {portfolio.map((p) => (
              <img key={p.id} src={p.photo_url} className="aspect-square w-full rounded-lg object-cover" alt="" />
            ))}
          </div>
        )}
      </Section>

      {/* Currently doing */}
      {doingListings.length > 0 && (
        <Section title={t("currently_working")}>
          <div className="space-y-2">
            {doingListings.map((l) => (
              <Link
                key={l.id}
                to="/listings/$listingId"
                params={{ listingId: l.id }}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 active:scale-[0.99]"
              >
                <span className="truncate text-sm font-medium text-foreground">{l.title}</span>
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-0.5 text-[10px] font-semibold ${
                    l.status === "finished"
                      ? "bg-primary/15 text-primary"
                      : "bg-success/15 text-success"
                  }`}
                >
                  {l.status === "finished" ? t("finished") : t("is_doing_it")}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* My listings */}
      <Section title={t("my_projects")}>
        {myListings.length === 0 ? (
          <p className="text-sm text-text-hint">
            {lang === "km" ? "មិនទាន់មានការងារ" : "No projects yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {myListings.map((l) => (
              <Link
                key={l.id}
                to="/listings/$listingId"
                params={{ listingId: l.id }}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 active:scale-[0.99]"
              >
                <span className="truncate text-sm font-medium text-foreground">{l.title}</span>
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-0.5 text-[10px] font-semibold ${
                    l.status === "active"
                      ? "bg-success/15 text-success"
                      : l.status === "finished"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {l.status === "active"
                    ? t("active")
                    : l.status === "finished"
                      ? t("finished")
                      : t("closed")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Logout */}
      <div className="mt-3 px-3">
        <button
          onClick={() => void signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-sm font-semibold text-destructive shadow-card active:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" /> {t("logout")}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 bg-surface p-4 shadow-card">
      <h3 className="mb-2 text-sm font-bold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
