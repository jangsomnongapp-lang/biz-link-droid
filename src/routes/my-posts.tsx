import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { OwnerMenu } from "@/components/OwnerMenu";
import { EditTextDialog } from "@/components/EditTextDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CommentsSheet } from "@/components/CommentsSheet";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import {
  ArrowLeft,
  ThumbsUp,
  MessageSquare,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/my-posts")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <MyPostsPage />
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
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  post_photos: { photo_url: string }[];
}

function MyPostsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-posts", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return { posts: [], likes: {}, commentCounts: {} };
      const { data: rows } = await supabase
        .from("posts")
        .select(
          "id, user_id, content, video_url, created_at, profiles(full_name, avatar_url), post_photos(photo_url)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const postRows = (rows as PostRow[] | null) ?? [];
      const likeMap: Record<string, { count: number; mine: boolean }> = {};
      const cMap: Record<string, number> = {};

      if (postRows.length > 0) {
        const ids = postRows.map((p) => p.id);
        for (const id of ids) {
          likeMap[id] = { count: 0, mine: false };
          cMap[id] = 0;
        }
        const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
          supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
          supabase.from("post_comments").select("post_id").in("post_id", ids),
        ]);
        for (const r of likeRows ?? []) {
          const e = likeMap[r.post_id];
          if (!e) continue;
          e.count += 1;
          if (r.user_id === user.id) e.mine = true;
        }
        for (const r of commentRows ?? []) cMap[r.post_id] = (cMap[r.post_id] ?? 0) + 1;
      }

      return { posts: postRows, likes: likeMap, commentCounts: cMap };
    },
  });

  const posts = data?.posts ?? [];
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostRow | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setLikes(data.likes);
      setCommentCounts(data.commentCounts);
    }
  }, [data]);

  useEffect(() => {
    if (!user) return;
    const inv = () => qc.invalidateQueries({ queryKey: ["my-posts", user.id] });
    const ch = supabase
      .channel(`my-posts:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, inv)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  async function deletePost(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error(t("delete_failed"));
      return;
    }
    setDeletingPostId(null);
    toast.success(t("deleted"));
    if (user) qc.invalidateQueries({ queryKey: ["my-posts", user.id] });
  }

  async function saveEditPost(values: Record<string, string>) {
    if (!editingPost) return;
    const content = (values.content ?? "").trim();
    const { error } = await supabase.from("posts").update({ content }).eq("id", editingPost.id);
    if (error) {
      toast.error(t("error_generic"));
      return;
    }
    setEditingPost(null);
    if (user) qc.invalidateQueries({ queryKey: ["my-posts", user.id] });
  }

  async function toggleLike(postId: string) {
    if (!user) return;
    const cur = likes[postId] ?? { count: 0, mine: false };
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-surface px-2">
        <button
          onClick={() => nav({ to: "/settings" })}
          className="rounded-full p-2 active:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-foreground">
          {t("my_posts")}
        </h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-2 p-3 pb-10">
        {isLoading && (
          <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>
        )}
        {!isLoading && posts.length === 0 && (
          <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("no_posts")}
          </div>
        )}
        {posts.map((p) => {
          const l = likes[p.id] ?? { count: 0, mine: false };
          const cc = commentCounts[p.id] ?? 0;
          return (
            <article
              key={p.id}
              className="relative rounded-xl bg-surface px-4 py-3 shadow-card"
            >
              <header className="flex items-center gap-3">
                <Avatar
                  name={p.profiles?.full_name}
                  url={p.profiles?.avatar_url}
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {p.profiles?.full_name ?? "User"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {timeAgo(p.created_at, t)}
                  </div>
                </div>
                <OwnerMenu
                  onEdit={() => setEditingPost(p)}
                  onDelete={() => setDeletingPostId(p.id)}
                />
              </header>

              {p.content && (
                <p className="mt-2 text-sm leading-relaxed text-foreground">{p.content}</p>
              )}
              {p.post_photos[0] && (
                <img
                  src={p.post_photos[0].photo_url}
                  loading="lazy"
                  decoding="async"
                  className="mt-3 w-full rounded-lg object-cover"
                  alt=""
                />
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
