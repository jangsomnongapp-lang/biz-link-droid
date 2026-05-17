import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { CommentsSheet } from "@/components/CommentsSheet";
import { RentalCommentsSheet } from "@/components/RentalCommentsSheet";
import { ReportMenu } from "@/components/ReportMenu";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { Plus, ThumbsUp, MessageSquare, Share2, Image as ImageIcon, X, UserPlus, BadgeCheck, Briefcase, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface SupplierStoreInfo {
  id: string;
  name: string;
  logo_url: string | null;
  category: string | null;
  photos: string[];
}

export const Route = createFileRoute("/home")({
  validateSearch: (s: Record<string, unknown>): { post?: string } => ({
    post: typeof s.post === "string" ? s.post : undefined,
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <HomePage />
      </AppShell>
    </RequireAuth>
  ),
});

interface PostRow {
  id: string;
  user_id: string;
  content: string | null;
  video_url: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null; is_verified: boolean | null; is_recruiter: boolean | null; is_featured: boolean | null } | null;
  post_photos: { photo_url: string }[];
}

interface RentalRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  price_per_day: number;
  location: string;
  availability: string;
  available_from: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  rental_photos: { photo_url: string }[];
}

interface StoryRow {
  id: string;
  user_id: string;
  media_url: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface StoryGroup {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  cover: string;
}

function HomePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { post: focusPostId } = Route.useSearch();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [supplierByUser, setSupplierByUser] = useState<Record<string, SupplierStoreInfo>>({});
  const [contactingUser, setContactingUser] = useState<string | null>(null);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [rentalLikes, setRentalLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [rentalCommentCounts, setRentalCommentCounts] = useState<Record<string, number>>({});
  const [openRentalComments, setOpenRentalComments] = useState<string | null>(null);

  useEffect(() => {
    if (!focusPostId || loading) return;
    const el = document.getElementById(`post-${focusPostId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(focusPostId);
      const tid = setTimeout(() => setHighlightId(null), 2200);
      return () => clearTimeout(tid);
    }
  }, [focusPostId, loading]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, avatar_url, is_admin")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setIsAdmin(!!data?.is_admin);
      });

    void (async () => {
      const [{ data }, { data: rentalData }] = await Promise.all([
        supabase
          .from("posts")
          .select("id, user_id, content, video_url, created_at, profiles(full_name, avatar_url, is_verified, is_recruiter, is_featured), post_photos(photo_url)")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("rental_listings")
          .select("id, user_id, title, description, category, price_per_day, location, availability, available_from, created_at, profiles(full_name, avatar_url), rental_photos(photo_url)")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const rows = (data as PostRow[] | null) ?? [];
      setPosts(rows);
      const rentalRows = (rentalData as RentalRow[] | null) ?? [];
      setRentals(rentalRows);
      setLoading(false);

      if (rentalRows.length > 0) {
        const rIds = rentalRows.map((r) => r.id);
        const [{ data: rLikeRows }, { data: rCommentRows }] = await Promise.all([
          supabase.from("rental_likes").select("rental_id, user_id").in("rental_id", rIds),
          supabase.from("rental_comments").select("rental_id").in("rental_id", rIds),
        ]);
        const rLikeMap: Record<string, { count: number; mine: boolean }> = {};
        for (const id of rIds) rLikeMap[id] = { count: 0, mine: false };
        for (const r of rLikeRows ?? []) {
          const e = rLikeMap[r.rental_id];
          if (!e) continue;
          e.count += 1;
          if (r.user_id === user.id) e.mine = true;
        }
        setRentalLikes(rLikeMap);
        const rcMap: Record<string, number> = {};
        for (const id of rIds) rcMap[id] = 0;
        for (const r of rCommentRows ?? []) rcMap[r.rental_id] = (rcMap[r.rental_id] ?? 0) + 1;
        setRentalCommentCounts(rcMap);
      }

      if (rows.length > 0) {
        const ids = rows.map((p) => p.id);
        const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
          supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
          supabase.from("post_comments").select("post_id").in("post_id", ids),
        ]);
        const likeMap: Record<string, { count: number; mine: boolean }> = {};
        for (const id of ids) likeMap[id] = { count: 0, mine: false };
        for (const r of likeRows ?? []) {
          const e = likeMap[r.post_id];
          if (!e) continue;
          e.count += 1;
          if (r.user_id === user.id) e.mine = true;
        }
        setLikes(likeMap);
        const cMap: Record<string, number> = {};
        for (const id of ids) cMap[id] = 0;
        for (const r of commentRows ?? []) cMap[r.post_id] = (cMap[r.post_id] ?? 0) + 1;
        setCommentCounts(cMap);

        // Fetch supplier store info for any post authors that own a store
        const userIds = Array.from(new Set(rows.map((p) => p.user_id)));
        const { data: stores } = await supabase
          .from("supplier_stores")
          .select("id, user_id, name, logo_url, supplier_store_categories(supplier_categories(name_en, name_km)), supplier_store_photos(photo_url, sort_order)")
          .in("user_id", userIds);
        const map: Record<string, SupplierStoreInfo> = {};
        for (const s of (stores ?? []) as Array<{
          id: string;
          user_id: string;
          name: string;
          logo_url: string | null;
          supplier_store_categories: Array<{ supplier_categories: { name_en: string; name_km: string } | null }>;
          supplier_store_photos: Array<{ photo_url: string; sort_order: number | null }>;
        }>) {
          const catObj = s.supplier_store_categories?.[0]?.supplier_categories ?? null;
          const photos = (s.supplier_store_photos ?? [])
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((p) => p.photo_url);
          map[s.user_id] = {
            id: s.id,
            name: s.name,
            logo_url: s.logo_url,
            category: catObj ? (lang === "km" ? catObj.name_km : catObj.name_en) : null,
            photos,
          };
        }
        setSupplierByUser(map);
      }
    })();

    void supabase
      .from("stories")
      .select("id, user_id, media_url, created_at, profiles(full_name, avatar_url)")
      .eq("status", "approved")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const rows = (data as StoryRow[] | null) ?? [];
        const map = new Map<string, StoryGroup>();
        for (const r of rows) {
          if (!map.has(r.user_id)) {
            map.set(r.user_id, {
              id: r.id,
              user_id: r.user_id,
              full_name: r.profiles?.full_name ?? null,
              avatar_url: r.profiles?.avatar_url ?? null,
              cover: r.media_url,
            });
          }
        }
        setStories(Array.from(map.values()));
      });
  }, [user]);

  async function adminDelete(id: string) {
    if (!confirm(t("admin_confirm_desc"))) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error(t("delete_failed"));
      return;
    }
    setPosts((p) => p.filter((x) => x.id !== id));
    toast.success("OK");
  }

  async function toggleLike(postId: string) {
    if (!user) return;
    const cur = likes[postId] ?? { count: 0, mine: false };
    // optimistic
    setLikes((m) => ({
      ...m,
      [postId]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine },
    }));
    if (cur.mine) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (error) setLikes((m) => ({ ...m, [postId]: cur }));
    } else {
      const { error } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });
      if (error) setLikes((m) => ({ ...m, [postId]: cur }));
    }
  }

  async function contactSupplier(ownerId: string, storeId: string) {
    if (!user || user.id === ownerId) return;
    setContactingUser(ownerId);
    try {
      const [a, b] = [user.id, ownerId].sort();
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
      void supabase.rpc("increment_supplier_contact", { _store_id: storeId });
      nav({ to: "/messages/$threadId", params: { threadId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContactingUser(null);
    }
  }

  async function sharePost(postId: string) {
    const url = `${window.location.origin}/home?post=${postId}`;
    const shareData = { title: t("app_name"), url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share_link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }

  async function toggleRentalLike(rentalId: string) {
    if (!user) return;
    const cur = rentalLikes[rentalId] ?? { count: 0, mine: false };
    setRentalLikes((m) => ({
      ...m,
      [rentalId]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine },
    }));
    if (cur.mine) {
      const { error } = await supabase
        .from("rental_likes")
        .delete()
        .eq("rental_id", rentalId)
        .eq("user_id", user.id);
      if (error) setRentalLikes((m) => ({ ...m, [rentalId]: cur }));
    } else {
      const { error } = await supabase
        .from("rental_likes")
        .insert({ rental_id: rentalId, user_id: user.id });
      if (error) setRentalLikes((m) => ({ ...m, [rentalId]: cur }));
    }
  }

  async function shareRental(rentalId: string) {
    const url = `${window.location.origin}/rentals/${rentalId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("app_name"), url });
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share_link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }

  async function recordStoryOpen(storyId: string, ownerId: string) {
    if (!user || ownerId === user.id) return;
    const { error } = await supabase
      .from("story_views")
      .insert({ story_id: storyId, viewer_id: user.id });
    if (error && error.code !== "23505") console.error("story_view insert failed", error);
  }

  return (
    <div>
      {/* Quick post */}
      <div className="mt-2 flex items-center gap-2 bg-surface px-3 py-3 shadow-card">
        <Avatar name={profile?.full_name} url={profile?.avatar_url} size={36} />
        <Link
          to="/announce"
          className="flex h-10 flex-1 items-center rounded-full border border-border bg-background px-4 text-sm text-muted-foreground active:bg-muted"
        >
          {t("what_share")}
        </Link>
        <Link to="/announce" className="rounded-full p-2 text-primary active:bg-primary/10">
          <ImageIcon className="h-5 w-5" />
        </Link>
      </div>

      {/* Top bar: Invite friends + Find my material */}
      <div className="mt-2 grid grid-cols-2 gap-2 px-2">
        <Link
          to="/invitations"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-3 text-sm font-semibold text-primary shadow-card active:bg-primary/15"
        >
          <UserPlus className="h-4 w-4" />
          {t("invite_friends_earn")}
        </Link>
        <Link
          to="/find-material"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#c87000] px-3 py-3 text-sm font-semibold text-white shadow-card active:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          {lang === "km" ? "រកសម្ភារៈ" : "Find my material"}
        </Link>
      </div>

      {/* Stories row */}
      <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto bg-surface px-3 py-3 shadow-card">
        <Link
          to="/story/new"
          className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-[0.97]"
        >
          <div className="relative h-16 w-16">
            <Avatar name={profile?.full_name} url={profile?.avatar_url} size={64} />
            <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary text-primary-foreground">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </div>
          </div>
          <span className="line-clamp-1 text-[11px] font-medium text-foreground">{t("create_story")}</span>
        </Link>
        {stories.map((s) => (
          <Link
            key={s.user_id}
            to="/story/view"
            search={{ user: s.user_id }}
            onClick={() => void recordStoryOpen(s.id, s.user_id)}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-[0.97]"
          >
            <div className="rounded-full bg-gradient-to-tr from-pink-500 via-orange-400 to-yellow-400 p-[2px]">
              <div className="rounded-full border-2 border-surface">
                <img
                  src={s.cover}
                  alt=""
                  className="h-[60px] w-[60px] rounded-full object-cover"
                />
              </div>
            </div>
            <span className="line-clamp-1 w-full text-center text-[11px] font-medium text-foreground">
              {s.full_name ?? "User"}
            </span>
          </Link>
        ))}
      </div>

      {/* Feed */}
      <div className="mt-2 space-y-2">
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>}
        {!loading && posts.length === 0 && (
          <div className="bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("no_posts")}
            <div className="mt-3">
              <Link to="/listings" className="text-sm font-semibold text-primary">
                {t("nav_listings")} →
              </Link>
            </div>
          </div>
        )}
        {(() => {
          type FeedItem =
            | { kind: "post"; created_at: string; data: PostRow }
            | { kind: "rental"; created_at: string; data: RentalRow };
          const items: FeedItem[] = [
            ...posts.map((p) => ({ kind: "post" as const, created_at: p.created_at, data: p })),
            ...rentals.map((r) => ({ kind: "rental" as const, created_at: r.created_at, data: r })),
          ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          return items.map((item) => {
            if (item.kind === "rental") {
              const r = item.data;
              const rl = rentalLikes[r.id] ?? { count: 0, mine: false };
              const rcc = rentalCommentCounts[r.id] ?? 0;
              return (
                <article
                  key={`r-${r.id}`}
                  className="block border border-[#7F77DD] bg-surface px-4 py-3 shadow-card"
                >
                  <Link
                    to="/rentals/$rentalId"
                    params={{ rentalId: r.id }}
                    className="block active:opacity-95"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={r.profiles?.full_name} url={r.profiles?.avatar_url} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <span className="truncate">{r.profiles?.full_name ?? "User"}</span>
                          <span className="rounded-md bg-[#EEEDFE] px-1.5 py-0.5 text-[10px] font-bold text-[#26215C]">
                            {t("for_rent_badge")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {timeAgo(r.created_at, t)} · {r.location}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-foreground">{r.title}</h3>
                        {r.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-[#534AB7]">${r.price_per_day}</div>
                        <div className="text-[10px] text-muted-foreground">{t("per_day")}</div>
                      </div>
                    </div>
                    {r.rental_photos.length > 0 && (
                      <div className={`mt-3 grid gap-2 ${r.rental_photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                        {r.rental_photos.slice(0, 2).map((p, i) => (
                          <img key={i} src={p.photo_url} alt="" className="aspect-square w-full rounded-lg bg-muted object-cover" />
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {r.availability === "now" ? (
                          <span className="rounded-pill bg-[#e8f8f0] px-2 py-0.5 text-[10px] font-semibold text-[#27ae60]">
                            {t("available_now")}
                          </span>
                        ) : (
                          <span className="rounded-pill bg-[#fff8e1] px-2 py-0.5 text-[10px] font-semibold text-[#b07d00]">
                            {t("booked_until")} {r.available_from ?? ""}
                          </span>
                        )}
                        <span className="rounded-pill bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-semibold text-[#26215C]">
                          {r.category}
                        </span>
                      </div>
                      {user?.id !== r.user_id && (
                        <span className="rounded-lg bg-[#534AB7] px-3 py-1.5 text-xs font-semibold text-white">
                          {t("contact")} →
                        </span>
                      )}
                    </div>
                  </Link>

                  {(rl.count > 0 || rcc > 0) && (
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {rl.count > 0 && (
                          <>
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#534AB7] text-white">
                              <ThumbsUp className="h-2.5 w-2.5" strokeWidth={3} />
                            </span>
                            {rl.count}
                          </>
                        )}
                      </span>
                      {rcc > 0 && (
                        <button
                          onClick={() => setOpenRentalComments(r.id)}
                          className="active:underline"
                        >
                          {rcc} {t("comments").toLowerCase()}
                        </button>
                      )}
                    </div>
                  )}

                  <footer className="mt-2 flex border-t border-border pt-1">
                    <button
                      onClick={() => void toggleRentalLike(r.id)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium active:bg-muted ${
                        rl.mine ? "text-[#534AB7]" : "text-muted-foreground"
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" fill={rl.mine ? "currentColor" : "none"} />
                      {t("like")}
                    </button>
                    <button
                      onClick={() => setOpenRentalComments(r.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {t("comment")}
                    </button>
                    <button
                      onClick={() => void shareRental(r.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
                    >
                      <Share2 className="h-4 w-4" />
                      {t("share")}
                    </button>
                  </footer>
                </article>
              );
            }
            const p = item.data;
          const l = likes[p.id] ?? { count: 0, mine: false };
          const cc = commentCounts[p.id] ?? 0;
          const supplier = supplierByUser[p.user_id];
          const isSupplierPost = !!supplier;
          // Only show photos that were actually attached to this post
          const supplierGalleryPhotos = isSupplierPost
            ? p.post_photos.map((ph) => ph.photo_url).slice(0, 2)
            : [];
          const isOwner = user?.id === p.user_id;
          return (
            <article
              key={p.id}
              id={`post-${p.id}`}
              className={`relative bg-surface px-4 py-3 shadow-card transition-shadow ${
                isSupplierPost ? "border-l-4 border-amber-500" : ""
              } ${highlightId === p.id ? "ring-2 ring-primary" : ""}`}
            >
              {isAdmin && (
                <button
                  onClick={() => void adminDelete(p.id)}
                  className="absolute -top-1 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white shadow active:scale-95"
                  aria-label="Delete"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              )}
              <header className="flex items-center gap-3">
                {isSupplierPost ? (
                  <Link
                    to="/suppliers/$storeId"
                    params={{ storeId: supplier.id }}
                    className="active:opacity-60"
                  >
                    {supplier.logo_url ? (
                      <img
                        src={supplier.logo_url}
                        alt={supplier.name}
                        className="h-10 w-10 rounded-lg bg-muted object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {supplier.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </Link>
                ) : (
                  <Link to="/users/$userId" params={{ userId: p.user_id }} className="active:opacity-60">
                    <Avatar name={p.profiles?.full_name} url={p.profiles?.avatar_url} size={40} />
                  </Link>
                )}
                {isSupplierPost ? (
                  <Link
                    to="/suppliers/$storeId"
                    params={{ storeId: supplier.id }}
                    className="flex-1 active:opacity-60"
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span className="truncate">{supplier.name}</span>
                      <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {t("supplier_badge")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(p.created_at, t)}
                      {supplier.category && <> · {supplier.category}</>}
                    </div>
                  </Link>
                ) : (
                  <Link to="/users/$userId" params={{ userId: p.user_id }} className="flex-1 active:opacity-60">
                    <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      <span className="truncate">{p.profiles?.full_name ?? "User"}</span>
                      {p.profiles?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-400 text-white" />}
                      {p.profiles?.is_recruiter && <Briefcase className="h-4 w-4 shrink-0 text-amber-500" />}
                      {p.profiles?.is_featured && <Sparkles className="h-4 w-4 shrink-0 text-pink-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{timeAgo(p.created_at, t)}</div>
                  </Link>
                )}
                {user?.id !== p.user_id && <ReportMenu targetKind="post" targetId={p.id} />}
              </header>
              {p.content && <p className="mt-2 text-sm leading-relaxed text-foreground">{p.content}</p>}
              {isSupplierPost ? (
                supplierGalleryPhotos.length > 0 && (
                  <div className={`mt-3 grid gap-2 ${supplierGalleryPhotos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {supplierGalleryPhotos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="aspect-square w-full rounded-lg bg-muted object-cover"
                      />
                    ))}
                  </div>
                )
              ) : (
                p.post_photos[0] && (
                  <img src={p.post_photos[0].photo_url} className="mt-3 w-full rounded-lg object-cover" alt="" />
                )
              )}
              {p.video_url && <VideoEmbed url={p.video_url} />}

              {isSupplierPost && !isOwner && (
                <button
                  onClick={() => void contactSupplier(p.user_id, supplier.id)}
                  disabled={contactingUser === p.user_id}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-sm font-bold text-white shadow active:scale-[0.98] disabled:opacity-50"
                >
                  {t("contact_supplier")} <ArrowRight className="h-4 w-4" />
                </button>
              )}


              {(l.count > 0 || cc > 0) && (
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {l.count > 0 && (
                      <>
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <ThumbsUp className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                        {l.count}
                      </>
                    )}
                  </span>
                  {cc > 0 && (
                    <button
                      onClick={() => setOpenComments(p.id)}
                      className="active:underline"
                    >
                      {cc} {t("comments").toLowerCase()}
                    </button>
                  )}
                </div>
              )}

              <footer className="mt-2 flex border-t border-border pt-1">
                <button
                  onClick={() => void toggleLike(p.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium active:bg-muted ${
                    l.mine ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <ThumbsUp className="h-4 w-4" fill={l.mine ? "currentColor" : "none"} />
                  {t("like")}
                </button>
                <button
                  onClick={() => setOpenComments(p.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("comment")}
                </button>
                <button
                  onClick={() => void sharePost(p.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
                >
                  <Share2 className="h-4 w-4" />
                  {t("share")}
                </button>
              </footer>
            </article>
          );
        });
        })()}
      </div>

      {openComments && (
        <CommentsSheet
          postId={openComments}
          onClose={() => setOpenComments(null)}
          onCountChange={(n) => setCommentCounts((m) => ({ ...m, [openComments]: n }))}
        />
      )}

      {openRentalComments && (
        <RentalCommentsSheet
          rentalId={openRentalComments}
          onClose={() => setOpenRentalComments(null)}
          onCountChange={(n) => setRentalCommentCounts((m) => ({ ...m, [openRentalComments]: n }))}
        />
      )}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const trimmed = url.trim();
  let embed: string | null = null;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) embed = `https://www.youtube.com/embed/${v}`;
      else if (u.pathname.startsWith("/shorts/"))
        embed = `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    } else if (host === "youtu.be") {
      embed = `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    } else if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) embed = `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    // not a valid URL; fall through to link
  }

  if (embed) {
    return (
      <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          src={embed}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a
      href={trimmed}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block truncate rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary underline"
    >
      {trimmed}
    </a>
  );
}
