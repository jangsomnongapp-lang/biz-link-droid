import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { CommentsSheet } from "@/components/CommentsSheet";
import { RentalCommentsSheet } from "@/components/RentalCommentsSheet";
import { ReportMenu } from "@/components/ReportMenu";
import { OwnerMenu } from "@/components/OwnerMenu";
import { EditTextDialog } from "@/components/EditTextDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { Plus, ThumbsUp, MessageSquare, Share2, Image as ImageIcon, X, UserPlus, BadgeCheck, Briefcase, Sparkles, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { toast } from "sonner";
import { FeedSkeleton } from "@/components/SkeletonFeed";
import { FeedVideo, isDirectVideoUrl } from "@/components/FeedVideo";

type ViewerMedia = { type: "photo" | "video"; url: string };

/** Video tile in the mixed-media grid: preloads ahead, autoplays muted while visible. */
function AutoplayVideoTile({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const preloader = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          preloader.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    preloader.observe(el);
    const player = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void el.play().catch(() => undefined);
          else el.pause();
        }
      },
      { threshold: 0.5 },
    );
    player.observe(el);
    return () => {
      preloader.disconnect();
      player.disconnect();
    };
  }, []);

  return (
    <>
      <video
        ref={ref}
        src={url}
        muted
        loop
        playsInline
        preload={near ? "auto" : "metadata"}
        className="pointer-events-none h-full w-full object-cover brightness-90"
      />
      <span className="absolute right-2 top-2 rounded-full bg-black/60 p-2">
        <Play className="h-3 w-3 fill-white text-white" />
      </span>
    </>
  );
}


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
  head: () => ({
    meta: [
      { title: "Home feed — BuildHub" },
      { name: "description", content: "Your BuildHub feed: latest jobs, stories, and updates from Cambodia's construction community." },
      { property: "og:title", content: "Home feed — BuildHub" },
      { property: "og:description", content: "Your BuildHub feed: latest jobs, stories, and updates from Cambodia's construction community." },
      { property: "og:url", content: "https://buildhubkh.com/home" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/home" }],
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
  profiles: { full_name: string | null; avatar_url: string | null; is_verified: boolean | null; is_recruiter: boolean | null; is_featured: boolean | null; is_supplier?: boolean | null } | null;
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
  const [editingPost, setEditingPost] = useState<PostRow | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  // Viewer state: photos array is stable; current index lives in a ref so scroll
  // never triggers React re-renders (which cause jank). Display index is updated
  // only after scroll ends or when arrows are clicked.
  const [viewer, setViewer] = useState<{ items: ViewerMedia[]; index: number } | null>(null);
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);
  const viewerIndexRef = useRef(0);
  const [viewerDisplayIndex, setViewerDisplayIndex] = useState(0);

  const [storiesLoading, setStoriesLoading] = useState(false);

  // Sync display index when viewer opens or arrow buttons are used
  useEffect(() => {
    if (viewer) {
      viewerIndexRef.current = viewer.index;
      setViewerDisplayIndex(viewer.index);
    }
  }, [viewer?.items, viewer?.index]);

  // Scroll to the correct slide when viewer opens (no smooth here – instant)
  useEffect(() => {
    if (!viewer) return;
    const el = viewerScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: viewer.index * el.clientWidth });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer?.items]);

  // Update display index on scroll end (native event, no re-renders during swipe)
  useEffect(() => {
    const el = viewerScrollRef.current;
    if (!el || !viewer) return;
    const onEnd = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx !== viewerIndexRef.current) {
        viewerIndexRef.current = idx;
        setViewerDisplayIndex(idx);
      }
    };
    el.addEventListener("scrollend", onEnd);
    return () => el.removeEventListener("scrollend", onEnd);
  }, [viewer]);

  // Profile + stories load once per user (cheap, separate from paginated feed)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setProfile(data);
        const { data: flags } = await supabase.rpc("get_my_profile_flags");
        if (cancelled) return;
        setIsAdmin(!!flags?.[0]?.is_admin);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setStoriesLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("stories")
          .select("id, user_id, media_url, created_at, profiles(full_name, avatar_url)")
          .eq("status", "approved")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(50);
        if (cancelled) return;
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
      } catch {
        // ignore
      } finally {
        if (!cancelled) setStoriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Feed variety: a seed that changes on every pull-to-refresh so the order
  // feels fresh without losing recency (items are shuffled within small blocks).
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.floor(Math.random() * 1_000_000));

  // Paginated feed: 20 posts + 20 rentals per page, merged client-side
  const PAGE_SIZE = 20;

  const feedQuery = useInfiniteQuery({
    queryKey: ["home:feed", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const [{ data: postsData }, { data: rentalsData }] = await Promise.all([
        supabase
          .from("posts")
          .select("id, user_id, content, video_url, created_at, profiles(full_name, avatar_url, is_verified, is_recruiter, is_featured, is_supplier), post_photos(photo_url)")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .range(from, to),
        supabase
          .from("rental_listings")
          .select("id, user_id, title, description, category, price_per_day, location, availability, available_from, created_at, profiles(full_name, avatar_url), rental_photos(photo_url)")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .range(from, to),
      ]);
      const postRows = (postsData as PostRow[] | null) ?? [];
      const rentalRows = (rentalsData as RentalRow[] | null) ?? [];

      // Build auxiliary maps scoped to this page's IDs
      const likeMap: Record<string, { count: number; mine: boolean }> = {};
      const cMap: Record<string, number> = {};
      const rLikeMap: Record<string, { count: number; mine: boolean }> = {};
      const rcMap: Record<string, number> = {};
      const supplierMap: Record<string, SupplierStoreInfo> = {};

      const auxTasks: Array<Promise<unknown>> = [];

      if (postRows.length > 0) {
        const ids = postRows.map((p) => p.id);
        for (const id of ids) {
          likeMap[id] = { count: 0, mine: false };
          cMap[id] = 0;
        }
        auxTasks.push(
          (async () => {
            const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
              supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
              supabase.from("post_comments").select("post_id").in("post_id", ids),
            ]);
            for (const r of likeRows ?? []) {
              const e = likeMap[r.post_id];
              if (!e) continue;
              e.count += 1;
              if (r.user_id === user!.id) e.mine = true;
            }
            for (const r of commentRows ?? []) cMap[r.post_id] = (cMap[r.post_id] ?? 0) + 1;
          })(),
        );

        const userIds = Array.from(new Set(postRows.map((p) => p.user_id)));
        auxTasks.push(
          (async () => {
            const { data: stores } = await supabase
              .from("supplier_stores")
              .select("id, user_id, name, logo_url, supplier_store_categories(supplier_categories(name_en, name_km)), supplier_store_photos(photo_url, sort_order)")
              .in("user_id", userIds);
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
              supplierMap[s.user_id] = {
                id: s.id,
                name: s.name,
                logo_url: s.logo_url,
                category: catObj ? (lang === "km" ? catObj.name_km : catObj.name_en) : null,
                photos,
              };
            }
          })(),
        );
      }

      if (rentalRows.length > 0) {
        const rIds = rentalRows.map((r) => r.id);
        for (const id of rIds) {
          rLikeMap[id] = { count: 0, mine: false };
          rcMap[id] = 0;
        }
        auxTasks.push(
          (async () => {
            const [{ data: rLikeRows }, { data: rCommentRows }] = await Promise.all([
              supabase.from("rental_likes").select("rental_id, user_id").in("rental_id", rIds),
              supabase.from("rental_comments").select("rental_id").in("rental_id", rIds),
            ]);
            for (const r of rLikeRows ?? []) {
              const e = rLikeMap[r.rental_id];
              if (!e) continue;
              e.count += 1;
              if (r.user_id === user!.id) e.mine = true;
            }
            for (const r of rCommentRows ?? []) rcMap[r.rental_id] = (rcMap[r.rental_id] ?? 0) + 1;
          })(),
        );
      }

      await Promise.all(auxTasks);

      return {
        posts: postRows,
        rentals: rentalRows,
        likes: likeMap,
        commentCounts: cMap,
        rentalLikes: rLikeMap,
        rentalCommentCounts: rcMap,
        supplierByUser: supplierMap,
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      // If either bucket returned a full page, assume more items exist
      if (lastPage.posts.length === PAGE_SIZE || lastPage.rentals.length === PAGE_SIZE) {
        return allPages.length;
      }
      return undefined;
    },
  });

  const loading = feedQuery.isLoading;

  // New seed whenever the feed is refreshed (pull-to-refresh / invalidate),
  // but not when loading additional pages while scrolling.
  const wasRefetching = useRef(false);
  useEffect(() => {
    const refetching = feedQuery.isRefetching && !feedQuery.isFetchingNextPage;
    if (refetching && !wasRefetching.current) {
      setShuffleSeed(Math.floor(Math.random() * 1_000_000));
    }
    wasRefetching.current = refetching;
  }, [feedQuery.isRefetching, feedQuery.isFetchingNextPage]);


  // Sync paginated query data into existing component state (preserves
  // optimistic-update logic for likes/comment counts).
  useEffect(() => {
    if (!feedQuery.data) return;
    const pages = feedQuery.data.pages;
    setPosts(pages.flatMap((p) => p.posts));
    setRentals(pages.flatMap((p) => p.rentals));
    setLikes(Object.assign({}, ...pages.map((p) => p.likes)));
    setCommentCounts(Object.assign({}, ...pages.map((p) => p.commentCounts)));
    setRentalLikes(Object.assign({}, ...pages.map((p) => p.rentalLikes)));
    setRentalCommentCounts(Object.assign({}, ...pages.map((p) => p.rentalCommentCounts)));
    setSupplierByUser(Object.assign({}, ...pages.map((p) => p.supplierByUser)));
  }, [feedQuery.data]);

  // IntersectionObserver sentinel: fetch next page when bottom comes into view
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
          void feedQuery.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feedQuery.hasNextPage, feedQuery.isFetchingNextPage, feedQuery]);

  // Realtime: invalidate paginated feed when relevant tables change.
  // Runs for guests too. Invalidating refetches and the persister rewrites the
  // offline snapshot automatically, so we never wipe the whole cache here.
  useEffect(() => {
    const uid = user?.id ?? null;
    const inv = () => {
      void qc.invalidateQueries({ queryKey: ["home:feed", uid] });
    };
    const invStories = () => {
      void qc.invalidateQueries({ queryKey: ["home:feed", uid] });
      // Re-fetch stories directly since we no longer cache them via useQuery
      if (!user) return;
      let cancelled = false;
      setStoriesLoading(true);
      (async () => {
        try {
          const { data } = await supabase
            .from("stories")
            .select("id, user_id, media_url, created_at, profiles(full_name, avatar_url)")
            .eq("status", "approved")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(50);
          if (cancelled) return;
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
        } catch {
          // ignore
        } finally {
          if (!cancelled) setStoriesLoading(false);
        }
      })();
    };
    const ch = supabase
      .channel(`home-feed:${uid ?? "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_listings" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_likes" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_comments" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, invStories)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);


  // Ensure the focused post is in the feed (fetch + prepend if missing),
  // then scroll it into view and briefly highlight it.
  useEffect(() => {
    if (!focusPostId || loading) return;
    let cancelled = false;
    const inFeed = posts.some((p) => p.id === focusPostId);

    async function ensureAndScroll() {
      if (!inFeed) {
        const { data: pData } = await supabase
          .from("posts")
          .select("id, user_id, content, video_url, created_at, profiles(full_name, avatar_url, is_verified, is_recruiter, is_featured, is_supplier), post_photos(photo_url)")
          .eq("id", focusPostId!)
          .maybeSingle();
        if (cancelled || !pData) return;
        const row = pData as unknown as PostRow;
        setPosts((cur) => (cur.some((p) => p.id === row.id) ? cur : [row, ...cur]));
        // Hydrate like / comment counts for this single post
        const [{ data: likeRows }, { data: cmtRows }] = await Promise.all([
          supabase.from("post_likes").select("user_id").eq("post_id", focusPostId!),
          supabase.from("post_comments").select("id").eq("post_id", focusPostId!),
        ]);
        if (cancelled) return;
        setLikes((m) => ({
          ...m,
          [focusPostId!]: {
            count: likeRows?.length ?? 0,
            mine: !!user && !!likeRows?.some((r) => r.user_id === user.id),
          },
        }));
        setCommentCounts((m) => ({ ...m, [focusPostId!]: cmtRows?.length ?? 0 }));
      }

      // Retry across frames — newly prepended posts (and their images) may
      // still be laying out, so the element height shifts after first paint.
      let tries = 0;
      const tick = () => {
        if (cancelled) return;
        const el = document.getElementById(`post-${focusPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightId(focusPostId!);
          setTimeout(() => setHighlightId(null), 2200);
          return;
        }
        if (tries++ < 20) setTimeout(tick, 100);
      };
      requestAnimationFrame(tick);

    }

    void ensureAndScroll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPostId, loading]);

  async function deletePost(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error(t("delete_failed"));
      return;
    }
    setPosts((p) => p.filter((x) => x.id !== id));
    setDeletingPostId(null);
    toast.success(t("deleted"));
  }

  async function saveEditPost(values: Record<string, string>) {
    if (!editingPost) return;
    const content = (values.content ?? "").trim();
    const { error } = await supabase.from("posts").update({ content }).eq("id", editingPost.id);
    if (error) {
      toast.error(t("error_generic"));
      return;
    }
    setPosts((p) => p.map((x) => (x.id === editingPost.id ? { ...x, content } : x)));
    setEditingPost(null);
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

  async function contactSupplier(ownerId: string, storeId: string | undefined, postId?: string) {
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
      if (storeId) void supabase.rpc("increment_supplier_contact", { _store_id: storeId });
      nav({ to: "/messages/$threadId", params: { threadId }, search: postId ? { pin: `post:${postId}` } : {} });
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

  const focused = !!focusPostId;

  return (
    <div>
      <h1 className="sr-only">BuildHub Community Feed</h1>
      
      
      {focused && (
        <div className="sticky top-[7.25rem] z-10 flex items-center gap-2 border-b border-border bg-surface px-3 py-2 shadow-card">
          <button
            onClick={() => nav({ to: "/home", search: {} })}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">{t("post") ?? "Post"}</span>
        </div>
      )}
      {!focused && (<>
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
          className="flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5 text-primary shadow-card active:opacity-90"
        >
          <UserPlus className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex flex-col leading-tight text-left">
            <span className="text-[10px] font-medium text-primary/70">
              {lang === "km" ? "ទទួលរង្វាន់" : "Earn rewards"}
            </span>
            <span className="text-sm font-bold text-primary">
              {lang === "km" ? "អញ្ជើញមិត្ត" : "Invite friends"}
            </span>
          </div>
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
      <h2 className="sr-only">Stories</h2>
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
        {storiesLoading && stories.length === 0 &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-${i}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))}
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
                  alt={`Story from ${s.full_name ?? "user"}`}
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
      </>)}

      {/* Feed */}
      <h2 className="sr-only">Community Feed</h2>
      <div className="mt-2 space-y-2">
        {loading && <FeedSkeleton count={3} />}
        {!loading && !focused && posts.length === 0 && (
          <div className="bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("no_posts")}
            <div className="mt-3">
              <Link to="/listings" className="text-sm font-semibold text-primary">
                {t("nav_listings")} →
              </Link>
            </div>
          </div>
        )}
        {!loading && focused && !posts.some((p) => p.id === focusPostId) && (
          <div className="bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("loading")}
          </div>
        )}
        {(() => {
          type FeedItem =
            | { kind: "post"; created_at: string; data: PostRow }
            | { kind: "rental"; created_at: string; data: RentalRow };
          const visiblePosts = focused ? posts.filter((p) => p.id === focusPostId) : posts;
          const visibleRentals = focused ? [] : rentals;
          const items: FeedItem[] = [
            ...visiblePosts.map((p) => ({ kind: "post" as const, created_at: p.created_at, data: p })),
            ...visibleRentals.map((r) => ({ kind: "rental" as const, created_at: r.created_at, data: r })),
          ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          // Shuffle within blocks of 4 so recent content stays near the top
          // but the exact order varies on each refresh.
          if (!focused) {
            const rand = (n: number) => {
              const x = Math.sin(shuffleSeed * 9301 + n * 49297) * 233280;
              return x - Math.floor(x);
            };
            const BLOCK = 4;
            for (let start = 0; start < items.length; start += BLOCK) {
              const block = items.slice(start, start + BLOCK);
              block
                .map((it, i) => ({ it, k: rand(start + i) }))
                .sort((a, b) => a.k - b.k)
                .forEach(({ it }, i) => {
                  items[start + i] = it;
                });
            }
          }

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
                          <img key={i} src={p.photo_url} alt={`${r.title} — photo ${i + 1}`} loading="lazy" decoding="async" className="aspect-square w-full rounded-lg bg-muted object-cover" />
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
          const isSupplierLike = isSupplierPost || !!p.profiles?.is_supplier;
          const isOwner = user?.id === p.user_id;
          return (
            <article
              key={p.id}
              id={`post-${p.id}`}
              className={`relative bg-surface px-4 py-3 shadow-card transition-shadow ${
                isSupplierLike ? "border-l-4 border-amber-500" : ""
              } ${highlightId === p.id ? "ring-2 ring-primary" : ""}`}
            >
              {isAdmin && !isOwner && (
                <button
                  onClick={() => setDeletingPostId(p.id)}
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
                         loading="lazy"
                         decoding="async"
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
                      {p.profiles?.is_supplier && (
                        <span className="shrink-0 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {t("supplier_badge")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{timeAgo(p.created_at, t)}</div>
                  </Link>
                )}
                {isOwner ? (
                  <OwnerMenu
                    onEdit={() => setEditingPost(p)}
                    onDelete={() => setDeletingPostId(p.id)}
                  />
                ) : (
                  <ReportMenu targetKind="post" targetId={p.id} />
                )}
              </header>
              {p.content && <p className="mt-2 text-sm leading-relaxed text-foreground">{p.content}</p>}
              {(() => {
                const directVideo =
                  p.video_url && isDirectVideoUrl(p.video_url) ? p.video_url : null;
                const media: ViewerMedia[] = [
                  ...(directVideo ? [{ type: "video" as const, url: directVideo }] : []),
                  ...p.post_photos.map((ph) => ({ type: "photo" as const, url: ph.photo_url })),
                ];
                if (media.length === 0) return null;
                const total = media.length;
                return (
                  <div className={`mt-3 grid gap-2 ${total === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {media.slice(0, 4).map((m, i) => {
                      const extra = i === 3 && total > 4 ? total - 4 : 0;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setViewer({ items: media, index: i })}
                          className={`relative block w-full overflow-hidden rounded-lg bg-black ${total === 1 ? "" : "aspect-square"}`}
                        >
                          {m.type === "photo" ? (
                            <img
                              src={m.url}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover brightness-90"
                              alt={p.content ? `${p.content.slice(0, 80)} — ${i + 1}` : `Post photo ${i + 1}`}
                            />
                          ) : (
                            <>
                              <video
                                src={m.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="pointer-events-none h-full w-full object-cover brightness-90"
                              />
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="rounded-full bg-black/60 p-3">
                                  <Play className="h-6 w-6 fill-white text-white" />
                                </span>
                              </span>
                            </>
                          )}
                          {extra > 0 && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-bold text-white">
                              +{extra}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {p.video_url && !isDirectVideoUrl(p.video_url) && <VideoEmbed url={p.video_url} />}

              {isSupplierLike && !isOwner && (
                <button
                  onClick={() => void contactSupplier(p.user_id, supplier?.id, p.id)}
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

        {/* Infinite-scroll sentinel: triggers fetchNextPage when in view */}
        {!focused && feedQuery.hasNextPage && (
          <div ref={sentinelRef} className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            {feedQuery.isFetchingNextPage ? t("loading") : ""}
          </div>
        )}
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

      <EditTextDialog
        open={!!editingPost}
        title={t("edit")}
        fields={
          editingPost
            ? [
                {
                  key: "content",
                  label: t("description"),
                  initial: editingPost.content ?? "",
                  type: "textarea",
                  required: true,
                },
              ]
            : []
        }
        onCancel={() => setEditingPost(null)}
        onSave={saveEditPost}
      />

      <ConfirmDialog
        open={!!deletingPostId}
        title={t("delete")}
        description={t("delete_confirm_desc")}
        destructive
        onConfirm={() => {
          if (deletingPostId) void deletePost(deletingPostId);
        }}
        onCancel={() => setDeletingPostId(null)}
      />

      {viewer &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col bg-black"
            onClick={(e) => {
              if (e.currentTarget === e.target) setViewer(null);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex h-14 shrink-0 items-center justify-between px-4 text-white">
              <span className="text-sm font-semibold tabular-nums">
                {viewerDisplayIndex + 1} / {viewer.items.length}
              </span>
              <button
                onClick={() => setViewer(null)}
                aria-label="Close"
                className="rounded-full p-2 active:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image strip: horizontal swipe, one image per viewport */}
            <div
              ref={viewerScrollRef}
              className="no-scrollbar relative flex h-full min-h-0 w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
            >
              {viewer.items.map((m, i) => (
                <div
                  key={i}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center"
                  onClick={(e) => {
                    if (e.currentTarget === e.target) setViewer(null);
                  }}
                >
                  {m.type === "photo" ? (
                    <img
                      src={m.url}
                      alt={`Photo ${i + 1}`}
                      draggable={false}
                      className="max-h-full max-w-full select-none object-contain"
                    />
                  ) : (
                    <video
                      src={m.url}
                      controls
                      autoPlay={i === viewer.index}
                      playsInline
                      className="max-h-full max-w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Desktop arrows */}
            <div className="pointer-events-none absolute inset-y-14 left-0 right-0 flex items-center justify-between px-2">
              {viewerDisplayIndex > 0 && (
                <button
                  onClick={() => {
                    const el = viewerScrollRef.current;
                    if (!el) return;
                    const idx = Math.max(0, viewerDisplayIndex - 1);
                    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
                    viewerIndexRef.current = idx;
                    setViewerDisplayIndex(idx);
                  }}
                  className="pointer-events-auto rounded-full bg-black/40 p-2 text-white backdrop-blur-sm active:bg-black/60"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              {viewerDisplayIndex < viewer.items.length - 1 && (
                <button
                  onClick={() => {
                    const el = viewerScrollRef.current;
                    if (!el) return;
                    const idx = Math.min(viewer.items.length - 1, viewerDisplayIndex + 1);
                    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
                    viewerIndexRef.current = idx;
                    setViewerDisplayIndex(idx);
                  }}
                  className="pointer-events-auto ml-auto rounded-full bg-black/40 p-2 text-white backdrop-blur-sm active:bg-black/60"
                  aria-label="Next"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Swipe hint */}
            <div className="pointer-events-none flex h-10 shrink-0 items-center justify-center text-xs text-white/60">
              {viewerDisplayIndex < viewer.items.length - 1 ? "Swipe for next" : ""}
            </div>
          </div>,
          document.body
        )
      }
    </div>

  );
}

function isSafeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function VideoEmbed({ url }: { url: string }) {
  const trimmed = url.trim();
  const safeHref = isSafeHttpUrl(trimmed);
  if (safeHref && isDirectVideoUrl(safeHref)) return <FeedVideo url={safeHref} />;
  let embed: string | null = null;
  if (safeHref) {
    try {
      const u = new URL(safeHref);
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
      /* noop */
    }
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

  if (!safeHref) return null;

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block truncate rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary underline"
    >
      {safeHref}
    </a>
  );
}
