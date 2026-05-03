import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { ArrowLeft, Check, X, PlayCircle, MapPin, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/posts")({
  component: () => (
    <RequireAuth>
      <AdminPostsPage />
    </RequireAuth>
  ),
});

interface PendingPost {
  id: string;
  user_id: string;
  content: string | null;
  video_url: string | null;
  created_at: string;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  post_photos: { photo_url: string }[];
}

interface PendingStory {
  id: string;
  user_id: string;
  media_url: string;
  caption: string | null;
  created_at: string;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface PendingListing {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  budget: number | null;
  location: string | null;
  created_at: string;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  listing_photos: { photo_url: string }[];
}

interface PendingRental {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  price_per_day: number | null;
  location: string | null;
  created_at: string;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  rental_photos: { photo_url: string }[];
}

type Tab = "posts" | "stories" | "listings" | "rentals";
type View = "pending" | "approved";
type DeleteKind = "posts" | "stories" | "listings" | "rental_listings";
type DeleteTarget = { kind: DeleteKind; id: string };

function AdminPostsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("posts");
  const [view, setView] = useState<View>("pending");
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [stories, setStories] = useState<PendingStory[]>([]);
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [rentals, setRentals] = useState<PendingRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteKey, setDeleteKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const ok = !!data?.is_admin;
        setIsAdmin(ok);
        if (!ok) {
          toast.error("Admin only");
          navigate({ to: "/home" });
        }
      });
  }, [user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, view]);

  async function load() {
    setLoading(true);
    const postStatuses = view === "pending" ? ["pending"] : ["approved"];
    const storyStatuses = view === "pending" ? ["pending"] : ["approved"];
    const listingStatuses = view === "pending" ? ["pending"] : ["active"];
    const rentalStatuses = view === "pending" ? ["pending"] : ["approved"];
    const [postsResult, storiesResult, listingsResult, rentalsResult] = await Promise.all([
      supabase
        .from("posts")
        .select(
          "id, user_id, content, video_url, created_at, status, profiles(full_name, avatar_url), post_photos(photo_url)",
        )
        .in("status", postStatuses)
        .order("created_at", { ascending: false }),
      supabase
        .from("stories")
        .select(
          "id, user_id, media_url, caption, created_at, status, profiles(full_name, avatar_url)",
        )
        .in("status", storyStatuses)
        .order("created_at", { ascending: false }),
      supabase
        .from("listings")
        .select(
          "id, user_id, title, description, budget, location, created_at, status, profiles(full_name, avatar_url), listing_photos(photo_url)",
        )
        .in("status", listingStatuses)
        .order("created_at", { ascending: false }),
      supabase
        .from("rental_listings")
        .select(
          "id, user_id, title, description, category, price_per_day, location, created_at, status, profiles(full_name, avatar_url), rental_photos(photo_url)",
        )
        .in("status", rentalStatuses)
        .order("created_at", { ascending: false }),
    ]);
    const nextPosts = (postsResult.data as PendingPost[] | null) ?? [];
    const nextStories = (storiesResult.data as PendingStory[] | null) ?? [];
    const nextListings = (listingsResult.data as PendingListing[] | null) ?? [];
    const nextRentals = (rentalsResult.data as PendingRental[] | null) ?? [];
    setPosts(nextPosts);
    setStories(nextStories);
    setListings(nextListings);
    setRentals(nextRentals);
    if (view === "pending" && nextPosts.length === 0) {
      if (nextListings.length > 0) setTab("listings");
      else if (nextRentals.length > 0) setTab("rentals");
      else if (nextStories.length > 0) setTab("stories");
    }
    setLoading(false);
  }

  async function decide(
    table: "posts" | "stories" | "listings" | "rental_listings",
    id: string,
    decision: "approved" | "rejected",
  ) {
    const approvedStatus = table === "listings" ? "active" : "approved";
    const rejectedStatus = "rejected";
    const patch: Record<string, unknown> =
      decision === "approved"
        ? { status: approvedStatus }
        : { status: rejectedStatus };
    if (table !== "rental_listings") {
      patch.rejected_at = decision === "approved" ? null : new Date().toISOString();
    }
    const { error } = await supabase.from(table).update(patch as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (table === "posts") setPosts((p) => p.filter((x) => x.id !== id));
    if (table === "stories") setStories((p) => p.filter((x) => x.id !== id));
    if (table === "listings") setListings((p) => p.filter((x) => x.id !== id));
    if (table === "rental_listings") setRentals((p) => p.filter((x) => x.id !== id));
    toast.success(decision === "approved" ? t("approved") : t("rejected"));
  }

  function openDelete(kind: DeleteKind, id: string) {
    setDeleteTarget({ kind, id });
    setDeleteKey("");
    setShowKey(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from(deleteTarget.kind).delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message || t("delete_failed"));
      return;
    }
    if (deleteTarget.kind === "posts") setPosts((p) => p.filter((x) => x.id !== deleteTarget.id));
    if (deleteTarget.kind === "stories") setStories((p) => p.filter((x) => x.id !== deleteTarget.id));
    if (deleteTarget.kind === "listings")
      setListings((p) => p.filter((x) => x.id !== deleteTarget.id));
    if (deleteTarget.kind === "rental_listings")
      setRentals((p) => p.filter((x) => x.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success(t("deleted"));
  }

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  const count =
    tab === "posts"
      ? posts.length
      : tab === "stories"
        ? stories.length
        : tab === "rentals"
          ? rentals.length
          : listings.length;
  const headerLabel =
    tab === "posts"
      ? t("review_posts")
      : tab === "stories"
        ? t("review_stories")
        : tab === "rentals"
          ? "Rentals"
          : t("review_listings");

  return (
    <div className="flex min-h-screen flex-col bg-background pb-6">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/settings" className="rounded-full p-2 active:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {t("admin")} — {headerLabel}
        </h1>
        <span className="rounded-pill bg-destructive px-2.5 py-0.5 text-[11px] font-bold">
          {t("pending_count", { n: count })}
        </span>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface overflow-x-auto">
        {(["posts", "listings", "rentals", "stories"] as Tab[]).map((k) => {
          const tabCount =
            k === "posts"
              ? posts.length
              : k === "stories"
                ? stories.length
                : k === "rentals"
                  ? rentals.length
                  : listings.length;
          const label =
            k === "posts"
              ? t("tab_posts")
              : k === "stories"
                ? t("tab_stories")
                : k === "rentals"
                  ? "Rent"
                  : t("tab_listings");
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === k
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {label}
              {tabCount > 0 && (
                <span className="ml-1 rounded-pill bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {tabCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* View toggle: Pending / Approved */}
      <div className="flex gap-2 px-3 pt-3">
        {(["pending", "approved"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-pill py-2 text-xs font-semibold transition-colors ${
              view === v
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground border border-border"
            }`}
          >
            {v === "pending" ? t("pending") : t("approved")}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 px-3 pt-3">
        {loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>
        )}

        {!loading && tab === "posts" && posts.length === 0 && (
          <EmptyState text={t("no_pending")} />
        )}
        {!loading && tab === "stories" && stories.length === 0 && (
          <EmptyState text={t("no_pending")} />
        )}
        {!loading && tab === "listings" && listings.length === 0 && (
          <EmptyState text={t("no_pending")} />
        )}
        {!loading && tab === "rentals" && rentals.length === 0 && (
          <EmptyState text={t("no_pending")} />
        )}

        {tab === "rentals" &&
          rentals.map((r) => (
            <article key={r.id} className="rounded-xl border-2 border-[#7F77DD] bg-[#EEEDFE] p-3 shadow-card">
              <ItemHeader
                name={r.profiles?.full_name}
                avatar={r.profiles?.avatar_url}
                createdAt={r.created_at}
                status={r.status}
              />
              <div className="mt-2 inline-block rounded-pill bg-[#534AB7] px-2 py-0.5 text-[10px] font-bold text-white">
                For rent · {r.category}
              </div>
              <h3 className="mt-2 text-base font-semibold text-[#26215C]">{r.title}</h3>
              {r.description && (
                <p className="mt-1 text-sm leading-relaxed text-[#26215C]/80">{r.description}</p>
              )}
              {r.rental_photos.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {r.rental_photos.slice(0, 4).map((ph, i) => (
                    <img
                      key={i}
                      src={ph.photo_url}
                      alt=""
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {r.location && (
                  <span className="flex items-center gap-1 text-[#26215C]/70">
                    <MapPin className="h-3.5 w-3.5 text-[#534AB7]" /> {r.location}
                  </span>
                )}
                <span className="font-semibold text-[#534AB7]">
                  {r.price_per_day ? `$ ${r.price_per_day}/day` : t("to_discuss")}
                </span>
              </div>
              <DecisionFooter
                onApprove={() => void decide("rental_listings", r.id, "approved")}
                onReject={() => void decide("rental_listings", r.id, "rejected")}
                onDelete={() => openDelete("rental_listings", r.id)}
                t={t}
                approvedOnly={view === "approved"}
              />
            </article>
          ))}

        {tab === "posts" &&
          posts.map((p) => (
            <article key={p.id} className="rounded-xl bg-surface p-3 shadow-card">
              <ItemHeader
                name={p.profiles?.full_name}
                avatar={p.profiles?.avatar_url}
                createdAt={p.created_at}
                status={p.status}
              />
              {p.content && (
                <p className="mt-2 text-sm leading-relaxed text-foreground">{p.content}</p>
              )}
              {p.post_photos.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {p.post_photos.slice(0, 4).map((ph, i) => (
                    <img
                      key={i}
                      src={ph.photo_url}
                      alt=""
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              {p.video_url && (
                <a
                  href={p.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center gap-3 rounded-xl bg-primary p-4 text-primary-foreground active:scale-[0.99]"
                >
                  <PlayCircle className="h-8 w-8" />
                  <span className="truncate text-sm font-semibold">{p.video_url}</span>
                </a>
              )}
              <DecisionFooter
                onApprove={() => void decide("posts", p.id, "approved")}
                onReject={() => void decide("posts", p.id, "rejected")}
                onDelete={() => openDelete("posts", p.id)}
                t={t}
                approvedOnly={view === "approved"}
              />
            </article>
          ))}

        {tab === "listings" &&
          listings.map((l) => (
            <article key={l.id} className="rounded-xl bg-surface p-3 shadow-card">
              <ItemHeader
                name={l.profiles?.full_name}
                avatar={l.profiles?.avatar_url}
                createdAt={l.created_at}
                status={l.status}
              />
              <h3 className="mt-2 text-base font-semibold text-foreground">{l.title}</h3>
              {l.description && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {l.description}
                </p>
              )}
              {l.listing_photos.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {l.listing_photos.slice(0, 4).map((ph, i) => (
                    <img
                      key={i}
                      src={ph.photo_url}
                      alt=""
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {l.location && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-destructive" /> {l.location}
                  </span>
                )}
                <span className="font-semibold text-success">
                  {l.budget ? `$ ${l.budget}` : t("to_discuss")}
                </span>
              </div>
              <DecisionFooter
                onApprove={() => void decide("listings", l.id, "approved")}
                onReject={() => void decide("listings", l.id, "rejected")}
                onDelete={() => openDelete("listings", l.id)}
                t={t}
                approvedOnly={view === "approved"}
              />
            </article>
          ))}

        {tab === "stories" &&
          stories.map((s) => (
            <article key={s.id} className="rounded-xl bg-surface p-3 shadow-card">
              <ItemHeader
                name={s.profiles?.full_name}
                avatar={s.profiles?.avatar_url}
                createdAt={s.created_at}
                status={s.status}
              />
              <div className="mt-3 overflow-hidden rounded-xl bg-black">
                <img
                  src={s.media_url}
                  alt=""
                  className="mx-auto max-h-[420px] w-auto object-contain"
                />
              </div>
              {s.caption && (
                <p className="mt-2 text-sm leading-relaxed text-foreground">{s.caption}</p>
              )}
              <DecisionFooter
                onApprove={() => void decide("stories", s.id, "approved")}
                onReject={() => void decide("stories", s.id, "rejected")}
                onDelete={() => openDelete("stories", s.id)}
                t={t}
                approvedOnly={view === "approved"}
              />
            </article>
          ))}
      </div>

      {/* Admin delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 px-5"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <Lock className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="mt-4 text-center text-lg font-bold text-foreground">
              {t("admin_confirm")}
            </h2>
            <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
              {t("admin_confirm_desc")}
            </p>

            <div className="mt-4 flex items-center rounded-xl bg-muted px-3 py-2.5">
              <input
                type={showKey ? "text" : "password"}
                value={deleteKey}
                onChange={(e) => setDeleteKey(e.target.value)}
                placeholder="••••••••"
                className="flex-1 bg-transparent text-sm tracking-widest text-foreground outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-xs font-semibold text-primary"
              >
                {showKey ? t("hide") : t("show")}
              </button>
            </div>

            <button
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-destructive text-sm font-bold text-destructive-foreground active:scale-[0.99] disabled:opacity-60"
            >
              {deleting ? t("loading") : t("delete_content")}
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-foreground active:scale-[0.99]"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
      {text}
    </div>
  );
}

function ItemHeader({
  name,
  avatar,
  createdAt,
  status,
}: {
  name: string | null | undefined;
  avatar: string | null | undefined;
  createdAt: string;
  status?: string;
}) {
  const { t } = useI18n();
  const isApproved = status === "approved" || status === "active";
  return (
    <header className="flex items-center gap-3">
      <Avatar name={name} url={avatar} size={36} />
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">{name ?? "User"}</div>
        <div className="text-xs text-muted-foreground">
          {t("submitted_ago")} {timeAgo(createdAt, t)}
        </div>
      </div>
      <span
        className={`rounded-pill px-2.5 py-0.5 text-[10px] font-bold ${
          isApproved ? "bg-success/15 text-success" : "bg-amber-100 text-amber-700"
        }`}
      >
        {isApproved ? t("approved") : t("pending")}
      </span>
    </header>
  );
}

function DecisionFooter({
  onApprove,
  onReject,
  onDelete,
  t,
  approvedOnly,
}: {
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useI18n>["t"];
  approvedOnly?: boolean;
}) {
  if (approvedOnly) {
    return (
      <footer className="mt-3">
        <button
          onClick={onDelete}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground active:scale-[0.99]"
        >
          <X className="h-4 w-4" /> {t("delete")}
        </button>
      </footer>
    );
  }
  return (
    <footer className="mt-3 grid grid-cols-3 gap-2">
      <button
        onClick={onApprove}
        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-success/40 bg-success/10 text-sm font-semibold text-success active:scale-[0.99]"
      >
        <Check className="h-4 w-4" /> {t("approve")}
      </button>
      <button
        onClick={onReject}
        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive active:scale-[0.99]"
      >
        <X className="h-4 w-4" /> {t("reject")}
      </button>
      <button
        onClick={onDelete}
        className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground active:scale-[0.99]"
      >
        <X className="h-4 w-4" /> {t("delete")}
      </button>
    </footer>
  );
}
