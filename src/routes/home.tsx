import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { CommentsSheet } from "@/components/CommentsSheet";
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
  const { t } = useI18n();
  const { user } = useAuth();
  const { post: focusPostId } = Route.useSearch();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

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
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, content, video_url, created_at, profiles(full_name, avatar_url, is_verified, is_recruiter, is_featured), post_photos(photo_url)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = (data as PostRow[] | null) ?? [];
      setPosts(rows);
      setLoading(false);

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

      {/* Invite friends banner */}
      <Link
        to="/invitations"
        className="mt-2 flex items-center justify-center gap-2 bg-primary/10 px-3 py-3 text-sm font-semibold text-primary shadow-card active:bg-primary/15 rounded-sm"
      >
        <UserPlus className="h-4 w-4" />
        {t("invite_friends_earn")}
      </Link>

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
        {posts.map((p) => {
          const l = likes[p.id] ?? { count: 0, mine: false };
          const cc = commentCounts[p.id] ?? 0;
          return (
            <article
              key={p.id}
              id={`post-${p.id}`}
              className={`relative bg-surface px-4 py-3 shadow-card transition-shadow ${
                highlightId === p.id ? "ring-2 ring-primary" : ""
              }`}
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
                <Link to="/users/$userId" params={{ userId: p.user_id }} className="active:opacity-60">
                  <Avatar name={p.profiles?.full_name} url={p.profiles?.avatar_url} size={40} />
                </Link>
                <Link to="/users/$userId" params={{ userId: p.user_id }} className="flex-1 active:opacity-60">
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    <span className="truncate">{p.profiles?.full_name ?? "User"}</span>
                    {p.profiles?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-400 text-white" />}
                    {p.profiles?.is_recruiter && <Briefcase className="h-4 w-4 shrink-0 text-amber-500" />}
                    {p.profiles?.is_featured && <Sparkles className="h-4 w-4 shrink-0 text-pink-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{timeAgo(p.created_at, t)}</div>
                </Link>
                {user?.id !== p.user_id && <ReportMenu targetKind="post" targetId={p.id} />}
              </header>
              {p.content && <p className="mt-2 text-sm leading-relaxed text-foreground">{p.content}</p>}
              {p.post_photos[0] && (
                <img src={p.post_photos[0].photo_url} className="mt-3 w-full rounded-lg object-cover" alt="" />
              )}
              {p.video_url && <VideoEmbed url={p.video_url} />}

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
        })}
      </div>

      {openComments && (
        <CommentsSheet
          postId={openComments}
          onClose={() => setOpenComments(null)}
          onCountChange={(n) => setCommentCounts((m) => ({ ...m, [openComments]: n }))}
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
