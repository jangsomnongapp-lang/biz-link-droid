import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/** Direct video file URLs (uploaded clips) rather than YouTube/Vimeo links. */
export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim());
}

/**
 * Short-clip player for the feed: preloads while scrolling near the viewport,
 * autoplays muted while in view, and pauses once scrolled away.
 */
export function FeedVideo({ url, poster }: { url: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Preload the clip a screen ahead so playback starts instantly.
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
      { threshold: 0.6 },
    );
    player.observe(el);

    return () => {
      preloader.disconnect();
      player.disconnect();
    };
  }, []);

  return (
    <div className="relative mt-3 overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        src={url}
        poster={poster}
        muted={muted}
        loop
        playsInline
        preload={near ? "auto" : "metadata"}
        className="max-h-[70vh] w-full object-contain"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play().catch(() => undefined);
          else el.pause();
        }}
      />
      <button
        type="button"
        onClick={() => setMuted((value) => !value)}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 text-white"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
