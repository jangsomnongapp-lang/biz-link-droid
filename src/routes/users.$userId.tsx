import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { ReportMenu } from "@/components/ReportMenu";
import { ShareButton } from "@/components/ShareButton";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BadgeCheck, Briefcase, Sparkles, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { getUserSeo } from "@/lib/seo-fetchers.functions";

export const Route = createFileRoute("/users/$userId")({
  loader: async ({ params }) => {
    try {
      const seo = await getUserSeo({ data: { id: params.userId } });
      return { seo };
    } catch {
      return { seo: null };
    }
  },
  head: ({ params, loaderData }) => {
    const seo = loaderData?.seo ?? null;
    const name = seo?.name?.trim();
    const title = name
      ? `${name.slice(0, 45)} — Construction Professional`
      : "Construction Professional Profile — BuildHub";
    const rawAbout = seo?.about?.trim();
    let description = rawAbout && rawAbout.length > 20
      ? rawAbout.slice(0, 155)
      : name
        ? `${name} — construction professional on BuildHub Cambodia. View skills, portfolio, and contact directly for your project.`
        : "View a construction professional's profile on BuildHub — Cambodia's construction marketplace.";
    if (description.length < 60) description = `${description} Browse verified workers on BuildHub Cambodia.`;
    const url = `https://buildhubkh.com/users/${params.userId}`;
    const image = seo?.avatar ?? null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
        ...(image ? [{ property: "og:image", content: image } as const, { name: "twitter:image", content: image } as const] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: name || "Construction professional",
            url,
            jobTitle: "Construction professional",
            description: rawAbout || description,
            ...(image ? { image } : {}),
          }),
        },
      ],
    };
  },
  component: () => (
    <RequireAuth>
      <UserProfilePage />
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
  is_verified?: boolean | null;
  is_recruiter?: boolean | null;
  is_featured?: boolean | null;
}

function UserProfilePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const { userId } = useParams({ from: "/users/$userId" });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cats, setCats] = useState<{ name_en: string; name_km: string }[]>([]);
  const [posted, setPosted] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [portfolio, setPortfolio] = useState<{ id: string; photo_url: string }[]>([]);
  const [userPosts, setUserPosts] = useState<
    { id: string; title: string | null; content: string | null; created_at: string; post_type: string | null; photo: string | null }[]
  >([]);
  const [activeProjects, setActiveProjects] = useState<{ id: string; title: string; location: string | null }[]>([]);

  const [checkingSupplier, setCheckingSupplier] = useState(true);
  const [supplierStore, setSupplierStore] = useState<{
    id: string;
    name: string;
    location: string | null;
    description: string | null;
    logo_url: string | null;
    categories: { name_en: string; name_km: string }[];
    photos: string[];
  } | null>(null);
  const [contacting, setContacting] = useState(false);
  const [reviews, setReviews] = useState<{
    id: string;
    stars: number;
    comment: string | null;
    created_at: string;
    rater: { id: string; full_name: string | null; avatar_url: string | null } | null;
  }[]>([]);
  const avgStars = reviews.length
    ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length
    : 0;

  useEffect(() => {
    setCheckingSupplier(true);
    void (async () => {
      const { data: store } = await supabase
        .from("supplier_stores")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (store?.id) {
        // Supplier owners must always open their shop page, not the worker profile.
        nav({ to: "/suppliers/$storeId", params: { storeId: store.id }, replace: true });
        return;
      }
      setCheckingSupplier(false);
    })();
    void supabase
      .from("profiles")
      .select("id, full_name, avatar_url, about_me, is_provider, is_coordinator, is_organization, is_client, is_verified, is_recruiter, is_featured")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    void supabase
      .from("user_categories")
      .select("categories(name_en, name_km)")
      .eq("user_id", userId)
      .then(({ data }) => {
        setCats(((data ?? []).map((r) => r.categories).filter(Boolean) as { name_en: string; name_km: string }[]));
      });
    void supabase
      .from("listings")
      .select("id, title, location, status", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, count }) => {
        setPosted(count ?? 0);
        setActiveProjects((data ?? []).filter((l) => l.status === "active"));
      });
    void supabase
      .from("portfolio_photos")
      .select("id, photo_url")
      .eq("user_id", userId)
      .then(({ data }) => setPortfolio(data ?? []));
    void supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("applicant_id", userId)
      .then(({ count }) => setAppliedCount(count ?? 0));
    void (async () => {
      const { data: ps } = await supabase
        .from("posts")
        .select("id, title, content, created_at, post_type")
        .eq("user_id", userId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!ps?.length) return setUserPosts([]);
      const { data: photos } = await supabase
        .from("post_photos")
        .select("post_id, photo_url")
        .in("post_id", ps.map((p) => p.id));
      const firstPhoto = new Map<string, string>();
      for (const ph of photos ?? []) if (!firstPhoto.has(ph.post_id)) firstPhoto.set(ph.post_id, ph.photo_url);
      setUserPosts(ps.map((p) => ({ ...p, photo: firstPhoto.get(p.id) ?? null })));
    })();

    void (async () => {
      const { data: rs } = await supabase.rpc("get_user_reviews", { _rated_id: userId });
      if (!rs) return;
      const raterIds = Array.from(new Set(rs.map((r) => r.rater_id)));
      const { data: raters } = raterIds.length
        ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", raterIds)
        : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
      const byId = new Map((raters ?? []).map((p) => [p.id, p]));
      setReviews(
        rs.map((r) => ({
          id: r.id,
          stars: r.stars,
          comment: r.comment,
          created_at: r.created_at,
          rater: byId.get(r.rater_id) ?? null,
        })),
      );
    })();
  }, [userId]);

  async function startConversation() {
    if (!user || !profile) return;
    if (user.id === profile.id) return;
    setContacting(true);
    try {
      const [a, b] = [user.id, profile.id].sort();
      const { data: existing } = await supabase
        .from("message_threads")
        .select("id")
        .eq("participant_a", a)
        .eq("participant_b", b)
        .maybeSingle();
      let threadId = existing?.id;
      if (!threadId) {
        const { data: created, error } = await supabase
          .from("message_threads")
          .insert({ participant_a: a, participant_b: b })
          .select("id")
          .single();
        if (error) throw error;
        threadId = created.id;
      }
      nav({ to: "/messages/$threadId", params: { threadId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContacting(false);
    }
  }

  if (checkingSupplier || !profile)
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>;

  const roleLabels: string[] = [];
  if (profile.is_provider) roleLabels.push(t("role_provider"));
  if (profile.is_coordinator) roleLabels.push(t("role_coordinator"));
  if (profile.is_organization) roleLabels.push(t("role_organization"));
  if (profile.is_client) roleLabels.push(t("role_client"));

  const isSelf = user?.id === profile.id;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/listings" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold truncate">{profile.full_name ?? "—"}</h1>
        <ShareButton
          path={`/users/${profile.id}`}
          title={profile.full_name ?? undefined}
          className="rounded-full p-2 active:bg-white/10"
        />
        {!isSelf && (
          <ReportMenu targetKind="profile" targetId={profile.id} iconClassName="text-primary-foreground" />
        )}
      </header>

      <div className="bg-primary px-5 pb-6 pt-3 text-primary-foreground">
        <div className="flex flex-col items-center gap-2">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={88} className="border-4 border-white" />
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold">{profile.full_name ?? "—"}</h1>
            {profile.is_verified && (
              <BadgeCheck className="h-5 w-5 fill-sky-400 text-white" aria-label={t("badge_verified")} />
            )}
            {profile.is_recruiter && (
              <Briefcase className="h-5 w-5 text-amber-300" aria-label={t("badge_recruiter")} />
            )}
            {profile.is_featured && (
              <Sparkles className="h-5 w-5 text-pink-300" aria-label={t("badge_featured")} />
            )}
          </div>
          <p className="text-xs text-white/80">{roleLabels.join(" · ") || " "}</p>
          <div className="mt-1"><AvailabilityBadge userId={profile.id} size="md" /></div>

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

      <div className="grid grid-cols-3 bg-surface shadow-card">
        <Stat n={posted} l={t("projects_posted")} />
        <Stat n={appliedCount} l={t("applied_to")} />
        <Stat n={0} l={t("contacts_made")} />
      </div>

      <div className="flex-1 space-y-2 pb-24">
        {supplierStore && (
          <div className="mt-2 bg-surface p-4 shadow-card">
            <Link
              to="/suppliers/$storeId"
              params={{ storeId: supplierStore.id }}
              className="block rounded-2xl bg-surface p-3 shadow-card active:scale-[0.99] border border-border"
            >
              <div className="flex items-center gap-3">
                {supplierStore.logo_url ? (
                  <img
                    src={supplierStore.logo_url}
                    alt={supplierStore.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                    {supplierStore.name
                      .split(/\s+/)
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground">{supplierStore.name}</p>
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {t("supplier_badge")}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {supplierStore.location && (
                      <>
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{supplierStore.location}</span>
                      </>
                    )}
                    {supplierStore.categories.length > 0 && (
                      <span className="truncate">
                        {" · "}
                        {supplierStore.categories
                          .map((c) => (lang === "km" ? c.name_km : c.name_en))
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {supplierStore.photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {supplierStore.photos.map((p, i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-md bg-muted">
                      <img src={p} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {supplierStore.description && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">
                    {supplierStore.description}
                  </p>
                  <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    {t("contact_supplier")}
                  </span>
                </div>
              )}
            </Link>
          </div>
        )}
        <Section title={t("about_me")}>
          <p className="text-sm text-foreground">
            {profile.about_me || <span className="text-text-hint">—</span>}
          </p>
        </Section>

        <Section title={`${t("portfolio")} (${portfolio.length})`}>
          {portfolio.length === 0 ? (
            <p className="text-sm text-text-hint">{lang === "km" ? "មិនទាន់មានរូបថត" : "No photos yet"}</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {portfolio.map((p) => (
                <img key={p.id} src={p.photo_url} className="aspect-square w-full rounded-lg object-cover" alt="" />
              ))}
            </div>
          )}
        </Section>

        <Section
          title={`${lang === "km" ? "ការវាយតម្លៃ" : "Reviews"} (${reviews.length})${
            reviews.length ? ` · ${avgStars.toFixed(1)}★` : ""
          }`}
        >
          {reviews.length === 0 ? (
            <p className="text-sm text-text-hint">
              {lang === "km" ? "មិនទាន់មានការវាយតម្លៃ" : "No reviews yet"}
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={r.rater?.full_name ?? null}
                      url={r.rater?.avatar_url ?? null}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {r.rater?.full_name ?? "—"}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i <= r.stars
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/40"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-sm text-foreground">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {activeProjects.length > 0 && (
          <Section title={t("active_projects")}>
            <div className="space-y-2">
              {activeProjects.map((p) => (
                <Link
                  key={p.id}
                  to="/listings/$listingId"
                  params={{ listingId: p.id }}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-3 active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{p.title}</div>
                    {p.location && (
                      <div className="truncate text-xs text-muted-foreground">{p.location}</div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-pill bg-success/15 px-2.5 py-0.5 text-[10px] font-semibold text-success">
                    {t("active")}
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </div>

      {!isSelf && (
        <div className="sticky bottom-0 space-y-2 border-t border-border bg-surface p-3">
          <Link
            to="/projects/new/$workerId"
            params={{ workerId: profile.id }}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99]"
          >
            {lang === "km" ? "ចាប់ផ្តើមគម្រោង" : "Start a project"}
          </Link>
          <button
            onClick={startConversation}
            disabled={contacting}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-primary bg-surface text-sm font-semibold text-primary active:scale-[0.99] disabled:opacity-60"
          >
            {contacting ? t("loading") : t("contact")}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="text-xl font-bold text-primary">{n}</span>
      <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{l}</span>
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
