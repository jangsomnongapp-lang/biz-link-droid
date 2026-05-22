import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Camera, LogOut, Gift } from "lucide-react";
import { toast } from "sonner";
import { ShareButton } from "@/components/ShareButton";
import { requestFreeHelp } from "@/lib/help-request.functions";
import { confirmCompletion, cancelCompletion } from "@/lib/projects.functions";

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
});

function ProfileRoute() {
  const location = useLocation();

  return (
    <RequireAuth>
      {location.pathname === "/profile" ? (
        <AppShell>
          <ProfilePage />
        </AppShell>
      ) : (
        <Outlet />
      )}
    </RequireAuth>
  );
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  about_me: string | null;
  is_provider: boolean;
  is_coordinator: boolean;
  is_organization: boolean;
  is_client: boolean;
  member_number: number | null;
}

function ProfilePage() {
  const { t, lang } = useI18n();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cats, setCats] = useState<{ name_en: string; name_km: string }[]>([]);
  const [stats, setStats] = useState({ posted: 0, applied: 0, contacts: 0 });
  const [portfolio, setPortfolio] = useState<{ id: string; photo_url: string }[]>([]);
  const [myListings, setMyListings] = useState<{ id: string; title: string; status: string }[]>([]);
  const [myRentals, setMyRentals] = useState<{ id: string; title: string; status: string; price_per_day: number; category: string; availability: string; available_from: string | null }[]>([]);
  const [doingListings, setDoingListings] = useState<{ id: string; title: string; status: string }[]>([]);
  const [myProjects, setMyProjects] = useState<{ id: string; status: string; role: "owner" | "worker"; completion_requested_by: string | null; other: { id: string; full_name: string | null; avatar_url: string | null } | null }[]>([]);
  const [projectBusy, setProjectBusy] = useState<string | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllListings, setShowAllListings] = useState(false);
  const [showAllPortfolio, setShowAllPortfolio] = useState(false);
  const [showAllRentals, setShowAllRentals] = useState(false);
  const [showAllDoing, setShowAllDoing] = useState(false);
  const confirmCompletionFn = useServerFn(confirmCompletion);
  const cancelCompletionFn = useServerFn(cancelCompletion);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { data: activeTicketCount = 0 } = useQuery({
    queryKey: ["profile-ticket-count", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("lottery_tickets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "active");
      return count ?? 0;
    },
  });
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [requestingHelp, setRequestingHelp] = useState(false);
  const requestFreeHelpFn = useServerFn(requestFreeHelp);
  const fileInput = useRef<HTMLInputElement>(null);
  const portfolioInput = useRef<HTMLInputElement>(null);

  async function onAddPortfolioPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    const valid = files.filter((f) => validateImageFile(f));
    if (!valid.length) return;
    setAddingPhotos(true);
    try {
      const rows = await Promise.all(
        valid.map(
          (file) =>
            new Promise<{ user_id: string; photo_url: string }>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve({ user_id: user.id, photo_url: String(r.result) });
              r.onerror = reject;
              r.readAsDataURL(file);
            }),
        ),
      );
      const { error, data } = await supabase
        .from("portfolio_photos")
        .insert(rows)
        .select("id, photo_url");
      if (error) throw error;
      setPortfolio((prev) => [...(data ?? []), ...prev]);
      toast.success(`${rows.length} photo${rows.length > 1 ? "s" : ""} added`);
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setAddingPhotos(false);
    }
  }

  async function onClickFreeHelp() {
    if (requestingHelp) return;
    setRequestingHelp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      await requestFreeHelpFn({ headers: { Authorization: `Bearer ${session.access_token}` } });
      toast.success(lang === "km" ? "បានផ្ញើសំណើទៅអ្នកគ្រប់គ្រង" : "Request sent to admin");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send request");
    } finally {
      setRequestingHelp(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(file)) return;
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
  useQuery({
    queryKey: ["profile:page", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return true;
      await loadProfile();
      return true;
    },
  });

  useEffect(() => {
    if (!user) return;
    const inv = () => qc.invalidateQueries({ queryKey: ["profile:page", user.id] });
    const ch = supabase
      .channel(`profile-page:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_categories", filter: `user_id=eq.${user.id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings", filter: `user_id=eq.${user.id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `applicant_id=eq.${user.id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolio_photos", filter: `user_id=eq.${user.id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_listings", filter: `user_id=eq.${user.id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, inv)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  async function loadProfile() {
    if (!user) return;
    void supabase
      .from("supplier_stores")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          nav({ to: "/suppliers/$storeId", params: { storeId: data.id }, replace: true });
        }
      });
    void supabase
      .from("profiles")
      .select("id, full_name, avatar_url, about_me, is_provider, is_coordinator, is_organization, is_client, member_number")
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
    void supabase
      .from("rental_listings")
      .select("id, title, status, price_per_day, category, availability, available_from")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyRentals(data ?? []));
    void (async () => {
      const { data: ps } = await supabase
        .from("projects")
        .select("id, status, owner_id, worker_id, completion_requested_by")
        .or(`owner_id.eq.${user.id},worker_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (!ps) return;
      const ids = Array.from(new Set(ps.map((p) => (p.owner_id === user.id ? p.worker_id : p.owner_id)).filter(Boolean)));
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)
        : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
      const byId = new Map((people ?? []).map((w) => [w.id, w]));
      setMyProjects(
        ps.map((p) => ({
          id: p.id,
          status: p.status,
          role: p.owner_id === user.id ? "owner" : "worker",
          completion_requested_by: p.completion_requested_by ?? null,
          other: byId.get(p.owner_id === user.id ? p.worker_id : p.owner_id) ?? null,
        })),
      );
    })();
  }

  const roleLabels: string[] = [];
  if (profile?.is_provider) roleLabels.push(t("role_provider"));
  if (profile?.is_coordinator) roleLabels.push(t("role_coordinator"));
  if (profile?.is_organization) roleLabels.push(t("role_organization"));
  if (profile?.is_client) roleLabels.push(t("role_client"));

  return (
    <div>
      {/* Blue header */}
      <div className="relative bg-primary px-5 pb-6 pt-5 text-primary-foreground">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("my_profile")}</h2>
          <div className="flex items-center gap-2">
            {user && (
              <ShareButton
                path={`/users/${user.id}`}
                title={profile?.full_name ?? undefined}
                variant="pill"
              />
            )}
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
          {profile?.member_number != null && (
            <p className="text-[11px] font-medium text-white/90">
              {lang === "km" ? "សមាជិក" : "Member"} #{profile.member_number}
            </p>
          )}
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
        <Link
          to="/rewards"
          aria-label={lang === "km" ? "រង្វាន់" : "Rewards"}
          className="absolute bottom-4 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg active:scale-95"
        >
          <Gift className="h-7 w-7 text-white" />
          {activeTicketCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-primary">
              {activeTicketCount > 99 ? "99+" : activeTicketCount}
            </span>
          )}
        </Link>
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
      <Section
        title={`${t("portfolio")} (${portfolio.length})`}
        action={
          <div className="flex items-center gap-3">
            <input
              ref={portfolioInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onAddPortfolioPhotos}
            />
            <button
              type="button"
              onClick={() => portfolioInput.current?.click()}
              disabled={addingPhotos}
              className="text-xs font-semibold text-primary active:opacity-70 disabled:opacity-60"
            >
              {addingPhotos
                ? t("loading")
                : lang === "km" ? "+ បន្ថែមរូបថត" : "+ Add photo"}
            </button>
            {portfolio.length > 6 ? (
              <button
                type="button"
                onClick={() => setShowAllPortfolio((v) => !v)}
                className="text-xs font-semibold text-primary active:opacity-70"
              >
                {showAllPortfolio
                  ? lang === "km" ? "បង្ហាញតិច" : "Show less"
                  : lang === "km" ? `មើលទាំងអស់ (${portfolio.length})` : `See all (${portfolio.length})`}
              </button>
            ) : null}
          </div>
        }
      >
        {portfolio.length === 0 ? (
          <p className="text-sm text-text-hint">
            {lang === "km" ? "មិនទាន់មានរូបថត" : "No photos yet"}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {(showAllPortfolio ? portfolio : portfolio.slice(0, 6)).map((p) => (
              <img key={p.id} src={p.photo_url} loading="lazy" decoding="async" className="aspect-square w-full rounded-lg object-cover" alt="" />
            ))}
          </div>
        )}
      </Section>

      {/* Currently doing */}
      <Section
        title={t("currently_working")}
        action={
          doingListings.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllDoing((v) => !v)}
              className="text-xs font-semibold text-primary active:opacity-70"
            >
              {showAllDoing
                ? lang === "km" ? "បង្ហាញតិច" : "Show less"
                : lang === "km" ? `មើលទាំងអស់ (${doingListings.length})` : `See all (${doingListings.length})`}
            </button>
          ) : null
        }
      >
        {doingListings.length === 0 ? (
          <p className="text-sm text-text-hint">
            {lang === "km" ? "មិនទាន់មានគម្រោងកំពុងធ្វើ" : "Not working on any project yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {(showAllDoing ? doingListings : doingListings.slice(0, 3)).map((l) => (
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
        )}
      </Section>


      {/* Project control: pick a worker, send request, track progress */}
      <Section
        title={lang === "km" ? "ការគ្រប់គ្រងគម្រោង" : "Project control"}
        action={
          myProjects.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllProjects((v) => !v)}
              className="text-xs font-semibold text-primary active:opacity-70"
            >
              {showAllProjects
                ? lang === "km" ? "បង្ហាញតិច" : "Show less"
                : lang === "km" ? `មើលទាំងអស់ (${myProjects.length})` : `See all (${myProjects.length})`}
            </button>
          ) : null
        }
      >
        <Link
          to="/find-worker"
          className="mb-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
            +
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              {lang === "km" ? "ចាប់ផ្តើមគម្រោងជាមួយអ្នកធ្វើការ" : "Start a project with a worker"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {lang === "km"
                ? "ជ្រើសរើសអ្នកធ្វើការ ហើយផ្ញើសំណើ"
                : "Pick a worker and send a request"}
            </div>
          </div>
        </Link>
        {myProjects.length === 0 ? (
          <p className="text-sm text-text-hint">
            {lang === "km" ? "មិនទាន់មានគម្រោង" : "No projects yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {(showAllProjects ? myProjects : myProjects.slice(0, 3)).map((p) => {
              const awaitingMyConfirm =
                p.status === "active" &&
                !!p.completion_requested_by &&
                p.completion_requested_by !== user?.id;
              async function handleConfirm(e: React.MouseEvent) {
                e.preventDefault();
                e.stopPropagation();
                if (projectBusy) return;
                setProjectBusy(p.id);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  await confirmCompletionFn({
                    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
                    data: { projectId: p.id },
                  });
                  toast.success(lang === "km" ? "បានបញ្ជាក់" : "Confirmed");
                  setMyProjects((prev) =>
                    prev.map((x) =>
                      x.id === p.id ? { ...x, status: "completed", completion_requested_by: null } : x,
                    ),
                  );
                } catch (err: any) {
                  toast.error(err?.message ?? "Failed");
                } finally {
                  setProjectBusy(null);
                }
              }
              async function handleReject(e: React.MouseEvent) {
                e.preventDefault();
                e.stopPropagation();
                if (projectBusy) return;
                setProjectBusy(p.id);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  await cancelCompletionFn({
                    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
                    data: { projectId: p.id },
                  });
                  toast.success(lang === "km" ? "បានបដិសេធ" : "Rejected");
                  setMyProjects((prev) =>
                    prev.map((x) => (x.id === p.id ? { ...x, completion_requested_by: null } : x)),
                  );
                } catch (err: any) {
                  toast.error(err?.message ?? "Failed");
                } finally {
                  setProjectBusy(null);
                }
              }
              return (
                <Link
                  key={p.id}
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="block rounded-lg border border-border bg-background p-3 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={p.other?.full_name ?? null}
                      url={p.other?.avatar_url ?? null}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.other?.full_name ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {awaitingMyConfirm
                          ? lang === "km" ? "ស្នើបញ្ចប់ — បញ្ជាក់ ឬ បដិសេធ" : "Finish requested — confirm or reject"
                          : p.status === "pending"
                            ? p.role === "worker"
                              ? lang === "km" ? "សំណើថ្មី — ចុចដើម្បីបញ្ជាក់" : "New request — tap to confirm"
                              : lang === "km" ? "កំពុងរង់ចាំការបញ្ជាក់" : "Waiting for confirmation"
                            : p.status === "active"
                              ? p.completion_requested_by === user?.id
                                ? lang === "km" ? "កំពុងរង់ចាំការបញ្ជាក់ការបញ្ចប់" : "Waiting for completion confirmation"
                                : lang === "km" ? "សកម្ម" : "Active"
                              : p.status === "completed"
                                ? lang === "km" ? "បានបញ្ចប់" : "Completed"
                                : p.status}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-pill px-2.5 py-0.5 text-[10px] font-semibold ${
                        p.status === "active"
                          ? "bg-success/15 text-success"
                          : p.status === "completed"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {awaitingMyConfirm && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={projectBusy === p.id}
                        className="flex-1 rounded-lg border border-rose-300 bg-rose-50 py-2 text-xs font-semibold text-rose-800 active:scale-[0.99] disabled:opacity-50"
                      >
                        {lang === "km" ? "បដិសេធ" : "Reject"}
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={projectBusy === p.id}
                        className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-50"
                      >
                        {lang === "km" ? "បញ្ជាក់" : "Confirm"}
                      </button>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* My listings */}
      <Section
        title={t("my_projects")}
        action={
          myListings.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllListings((v) => !v)}
              className="text-xs font-semibold text-primary active:opacity-70"
            >
              {showAllListings
                ? lang === "km" ? "បង្ហាញតិច" : "Show less"
                : lang === "km" ? `មើលទាំងអស់ (${myListings.length})` : `See all (${myListings.length})`}
            </button>
          ) : null
        }
      >
        {myListings.length === 0 ? (
          <p className="text-sm text-text-hint">
            {lang === "km" ? "មិនទាន់មានការងារ" : "No projects yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {(showAllListings ? myListings : myListings.slice(0, 3)).map((l) => (
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

      {/* List for rent action */}
      <div className="mt-2 px-3">
        <Link
          to="/rentals/new"
          className="flex items-center gap-3 rounded-xl border border-[#7F77DD] bg-[#EEEDFE] p-3 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#534AB7] text-base font-bold text-white">
            $
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#26215C]">{t("list_something_for_rent")}</div>
            <div className="text-[11px] text-[#534AB7]/80">{t("earn_money_tools")}</div>
          </div>
        </Link>
        <Link
          to="/listings/new"
          className="mt-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
            +
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{t("new_project")}</div>
            <div className="text-[11px] text-muted-foreground">{t("post_project_hint") !== "post_project_hint" ? t("post_project_hint") : (lang === "km" ? "បង្ហោះការងារដើម្បីស្វែងរកអ្នកជំនាញ" : "Post a project to find specialists")}</div>
          </div>
        </Link>
        <Link
          to="/find-worker"
          className="relative mt-2 flex items-center gap-3 rounded-xl p-3 text-white active:scale-[0.99]"
          style={{ backgroundColor: "#0F6E56" }}
        >
          <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-amber-950">
            NEW
          </span>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold">
            ▶
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {lang === "km" ? "ចាប់ផ្តើមគម្រោង" : "Start a project"}
            </div>
            <div className="text-[11px] text-white/85">
              {lang === "km" ? "តាមដានការងារ · គ្រប់គ្រងគម្រោងរបស់អ្នក" : "Track work · manage your project"}
            </div>
          </div>
        </Link>
        {(() => {
          const hasActive = myListings.some((l) => l.status === "active");
          const isClient = !!profile?.is_client;
          const title = lang === "km" ? "ជំនួយគម្រោងឥតគិតថ្លៃ" : "FREE PROJECT HELP";
          const desc = !hasActive
            ? (lang === "km"
                ? "បង្ហោះគម្រោងសកម្មយ៉ាងហោចណាស់ ១ ដើម្បីដោះសោមុខងារនេះ"
                : "Publish at least 1 active project to unlock this feature")
            : isClient
              ? (lang === "km"
                  ? "ទទួលដំបូន្មានបច្ចេកទេសឥតគិតថ្លៃសម្រាប់គម្រោងសំណង់របស់អ្នក"
                  : "Get free technical advice for your construction project")
              : (lang === "km"
                  ? "ទទួលដំបូន្មានឥតគិតថ្លៃអំពីរបៀបអនុវត្តការងាររបស់អ្នក"
                  : "Get free technical advice on how to execute your work");

          if (!hasActive) {
            return (
              <div
                aria-disabled="true"
                className="mt-2 flex cursor-not-allowed items-center gap-3 rounded-xl border border-border bg-muted p-3 opacity-70"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted-foreground/30 text-muted-foreground">
                  💬
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">{title}</div>
                  <div className="text-[11px] text-muted-foreground">{desc}</div>
                </div>
              </div>
            );
          }
          return (
            <button
              type="button"
              onClick={onClickFreeHelp}
              disabled={requestingHelp}
              className="mt-2 flex w-full items-center gap-3 rounded-xl bg-primary p-3 text-left text-primary-foreground active:scale-[0.99] disabled:opacity-70"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                💬
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{title}</div>
                <div className="text-[11px] text-white/85">
                  {requestingHelp ? (lang === "km" ? "កំពុងផ្ញើ..." : "Sending...") : desc}
                </div>
              </div>
            </button>
          );
        })()}
      </div>

      {/* My rentals */}
      <Section
        title={`${t("my_rentals")} (${myRentals.length})`}
        action={
          myRentals.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllRentals((v) => !v)}
              className="text-xs font-semibold text-primary active:opacity-70"
            >
              {showAllRentals
                ? lang === "km" ? "បង្ហាញតិច" : "Show less"
                : lang === "km" ? `មើលទាំងអស់ (${myRentals.length})` : `See all (${myRentals.length})`}
            </button>
          ) : null
        }
      >
        {myRentals.length === 0 ? (
          <p className="text-sm text-text-hint">{t("no_rentals")}</p>
        ) : (
          <div className="space-y-2">
            {(showAllRentals ? myRentals : myRentals.slice(0, 3)).map((r) => (
              <Link
                key={r.id}
                to="/rentals/$rentalId"
                params={{ rentalId: r.id }}
                className="block rounded-lg border border-[#7F77DD] bg-[#EEEDFE] p-3 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[#26215C]">{r.title}</span>
                  <span className="shrink-0 text-sm font-bold text-[#534AB7]">${r.price_per_day}/d</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="rounded-pill bg-white/70 px-1.5 py-0.5 font-semibold text-[#26215C]">
                    {r.category}
                  </span>
                  {r.status === "approved" ? (
                    r.availability === "now" ? (
                      <span className="rounded-pill bg-[#e8f8f0] px-1.5 py-0.5 font-semibold text-[#27ae60]">
                        {t("available_label")}
                      </span>
                    ) : (
                      <span className="rounded-pill bg-[#fff8e1] px-1.5 py-0.5 font-semibold text-[#b07d00]">
                        {t("booked_until")} {r.available_from ?? ""}
                      </span>
                    )
                  ) : (
                    <span className="rounded-pill bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
                      {r.status}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

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

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-2 bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
