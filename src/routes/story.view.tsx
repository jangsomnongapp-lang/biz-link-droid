import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface StorySearch {
  user: string;
}

export const Route = createFileRoute("/story/view")({
  validateSearch: (s: Record<string, unknown>): StorySearch => ({
    user: typeof s.user === "string" ? s.user : "",
  }),
  component: () => (
    <RequireAuth>
      <StoryViewerPage />
    </RequireAuth>
  ),
});

interface StoryRow {
  id: string;
  media_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

const DURATION_MS = 5000;

function StoryViewerPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { user } = useSearch({ from: "/story/view" });
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("stories")
      .select("id, media_url, caption, created_at, expires_at, profiles(full_name, avatar_url)")
      .eq("user_id", user)
      .eq("status", "approved")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setStories((data as StoryRow[] | null) ?? []);
      });
  }, [user]);

  useEffect(() => {
    if (stories.length === 0) return;
    elapsedRef.current = 0;
    setProgress(0);
    startRef.current = performance.now();

    function tick(now: number) {
      if (!paused) {
        const total = elapsedRef.current + (now - startRef.current);
        const p = Math.min(1, total / DURATION_MS);
        setProgress(p);
        if (p >= 1) {
          if (idx < stories.length - 1) setIdx((i) => i + 1);
          else nav({ to: "/home" });
          return;
        }
      } else {
        startRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [idx, stories.length, paused, nav]);

  function close() {
    nav({ to: "/home" });
  }
  function next() {
    if (idx < stories.length - 1) setIdx((i) => i + 1);
    else close();
  }
  function prev() {
    if (idx > 0) setIdx((i) => i - 1);
  }

  if (stories.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-white/70">
        {t("loading")}
      </div>
    );
  }

  const s = stories[idx];
  const hoursLeft = Math.max(
    0,
    Math.round((new Date(s.expires_at).getTime() - Date.now()) / 3_600_000),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-2 pt-2">
        {stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-[width] duration-75"
              style={{ width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2 text-white">
        <Avatar name={s.profiles?.full_name} url={s.profiles?.avatar_url} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{s.profiles?.full_name ?? "User"}</div>
          <div className="text-[11px] text-white/70">
            {timeAgo(s.created_at, t)} · {t("story_expires_in", { h: hoursLeft })}
          </div>
        </div>
        <button onClick={close} className="rounded-full p-2 active:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Image */}
      <div className="relative flex-1">
        <img src={s.media_url} alt="" className="h-full w-full object-contain" />
        {s.caption && (
          <div className="absolute inset-x-0 bottom-20 px-6 text-center text-base font-medium text-white drop-shadow-lg">
            {s.caption}
          </div>
        )}

        {/* Tap zones */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-0 top-0 h-full w-1/3 text-white/0"
          aria-label="Previous"
        >
          <ChevronLeft className="ml-2 h-6 w-6" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-0 top-0 h-full w-1/3 text-white/0"
          aria-label="Next"
        >
          <ChevronRight className="ml-auto mr-2 h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
