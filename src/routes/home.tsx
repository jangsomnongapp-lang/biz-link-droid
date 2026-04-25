import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { Camera, Plus, ThumbsUp, MessageSquare, Share2, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/home")({
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
  profiles: { full_name: string | null; avatar_url: string | null } | null;
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
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  cover: string;
}

function HomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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

    void supabase
      .from("posts")
      .select("id, user_id, content, video_url, created_at, profiles(full_name, avatar_url), post_photos(photo_url)")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setPosts((data as PostRow[] | null) ?? []);
        setLoading(false);
      });

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

      {/* Stories row (placeholder) */}
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto bg-surface p-3 shadow-card">
        <Link
          to="/announce"
          className="relative flex h-32 w-24 shrink-0 flex-col items-center justify-end overflow-hidden rounded-xl bg-primary p-2 text-primary-foreground active:scale-[0.98]"
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-2.5">
            <Plus className="h-4 w-4 text-primary" strokeWidth={3} />
          </div>
          <span className="z-10 text-[11px] font-semibold">{t("create_story")}</span>
        </Link>
        {["MK", "DR", "SK"].map((i) => (
          <div
            key={i}
            className="relative flex h-32 w-24 shrink-0 flex-col items-end justify-end rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 p-2"
          >
            <div className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-surface text-[10px] font-bold text-primary">
              {i}
            </div>
            <span className="text-[11px] font-semibold text-foreground">User</span>
          </div>
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
        {posts.map((p) => (
          <article key={p.id} className="relative bg-surface px-4 py-3 shadow-card">
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
              <Avatar name={p.profiles?.full_name} url={p.profiles?.avatar_url} size={40} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">{p.profiles?.full_name ?? "User"}</div>
                <div className="text-xs text-muted-foreground">{timeAgo(p.created_at, t)}</div>
              </div>
            </header>
            {p.content && <p className="mt-2 text-sm leading-relaxed text-foreground">{p.content}</p>}
            {p.post_photos[0] && (
              <img src={p.post_photos[0].photo_url} className="mt-3 w-full rounded-lg object-cover" alt="" />
            )}
            <footer className="mt-3 flex border-t border-border pt-2">
              <ActionBtn icon={ThumbsUp} label={t("like")} />
              <ActionBtn icon={MessageSquare} label={t("comment")} />
              <ActionBtn icon={Share2} label={t("share")} />
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label }: { icon: typeof Camera; label: string }) {
  return (
    <button className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-muted-foreground active:bg-muted">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
