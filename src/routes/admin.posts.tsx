import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { ArrowLeft, Check, X, PlayCircle } from "lucide-react";
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

type Tab = "posts" | "stories";

function AdminPostsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [stories, setStories] = useState<PendingStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
  }, [isAdmin, tab]);

  async function load() {
    setLoading(true);
    if (tab === "posts") {
      const { data } = await supabase
        .from("posts")
        .select(
          "id, user_id, content, video_url, created_at, status, profiles(full_name, avatar_url), post_photos(photo_url)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setPosts((data as PendingPost[] | null) ?? []);
    } else {
      const { data } = await supabase
        .from("stories")
        .select(
          "id, user_id, media_url, caption, created_at, status, profiles(full_name, avatar_url)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setStories((data as PendingStory[] | null) ?? []);
    }
    setLoading(false);
  }

  async function decidePost(id: string, decision: "approved" | "rejected") {
    const patch =
      decision === "approved"
        ? { status: "approved", rejected_at: null }
        : { status: "rejected", rejected_at: new Date().toISOString() };
    const { error } = await supabase.from("posts").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPosts((p) => p.filter((x) => x.id !== id));
    toast.success(decision === "approved" ? t("approved") : t("rejected"));
  }

  async function decideStory(id: string, decision: "approved" | "rejected") {
    const patch =
      decision === "approved"
        ? { status: "approved", rejected_at: null }
        : { status: "rejected", rejected_at: new Date().toISOString() };
    const { error } = await supabase.from("stories").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStories((p) => p.filter((x) => x.id !== id));
    toast.success(decision === "approved" ? t("approved") : t("rejected"));
  }

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  const count = tab === "posts" ? posts.length : stories.length;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-6">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/settings" className="rounded-full p-2 active:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {t("admin")} — {tab === "posts" ? t("review_posts") : t("review_stories")}
        </h1>
        <span className="rounded-pill bg-destructive px-2.5 py-0.5 text-[11px] font-bold">
          {t("pending_count", { n: count })}
        </span>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface">
        {(["posts", "stories"] as Tab[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === k
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            {k === "posts" ? t("tab_posts") : t("tab_stories")}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 px-3 pt-3">
        {loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>
        )}

        {!loading && tab === "posts" && posts.length === 0 && (
          <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("no_pending")}
          </div>
        )}
        {!loading && tab === "stories" && stories.length === 0 && (
          <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("no_pending")}
          </div>
        )}

        {tab === "posts" &&
          posts.map((p) => (
            <article key={p.id} className="rounded-xl bg-surface p-3 shadow-card">
              <header className="flex items-center gap-3">
                <Avatar name={p.profiles?.full_name} url={p.profiles?.avatar_url} size={36} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {p.profiles?.full_name ?? "User"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("submitted_ago")} {timeAgo(p.created_at, t)}
                  </div>
                </div>
                <span className="rounded-pill bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                  {t("pending")}
                </span>
              </header>

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

              <footer className="mt-3 flex gap-2">
                <button
                  onClick={() => void decidePost(p.id, "approved")}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-success/40 bg-success/10 text-sm font-semibold text-success active:scale-[0.99]"
                >
                  <Check className="h-4 w-4" /> {t("approve")}
                </button>
                <button
                  onClick={() => void decidePost(p.id, "rejected")}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive active:scale-[0.99]"
                >
                  <X className="h-4 w-4" /> {t("reject")}
                </button>
              </footer>
            </article>
          ))}

        {tab === "stories" &&
          stories.map((s) => (
            <article key={s.id} className="rounded-xl bg-surface p-3 shadow-card">
              <header className="flex items-center gap-3">
                <Avatar name={s.profiles?.full_name} url={s.profiles?.avatar_url} size={36} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {s.profiles?.full_name ?? "User"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("submitted_ago")} {timeAgo(s.created_at, t)}
                  </div>
                </div>
                <span className="rounded-pill bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                  {t("pending")}
                </span>
              </header>

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

              <footer className="mt-3 flex gap-2">
                <button
                  onClick={() => void decideStory(s.id, "approved")}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-success/40 bg-success/10 text-sm font-semibold text-success active:scale-[0.99]"
                >
                  <Check className="h-4 w-4" /> {t("approve")}
                </button>
                <button
                  onClick={() => void decideStory(s.id, "rejected")}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive active:scale-[0.99]"
                >
                  <X className="h-4 w-4" /> {t("reject")}
                </button>
              </footer>
            </article>
          ))}
      </div>
    </div>
  );
}
