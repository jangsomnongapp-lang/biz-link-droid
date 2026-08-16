import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  MAX_CLIP_SECONDS,
  canTrimInBrowser,
  readVideoMeta,
  trimVideo,
} from "@/lib/video-trim";

interface Props {
  file: File;
  onCancel: () => void;
  onConfirm: (clip: Blob) => Promise<void> | void;
}

export function VideoTrimmer({ file, onCancel, onConfirm }: Props) {
  const { lang } = useI18n();
  const km = lang === "km";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src] = useState(() => URL.createObjectURL(file));
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(MAX_CLIP_SECONDS);
  const [working, setWorking] = useState(false);
  const [unreadable, setUnreadable] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  useEffect(() => {
    void readVideoMeta(src)
      .then((meta) => {
        if (!meta.duration) {
          // Duration unknown (some phone recordings) — upload as-is.
          setUnreadable(true);
          return;
        }
        setUnreadable(false);
        setDuration(meta.duration);
        setLength(Math.min(MAX_CLIP_SECONDS, Math.max(1, meta.duration)));
      })
      .catch(() => setUnreadable(true));
  }, [src]);

  const maxLength = Math.min(MAX_CLIP_SECONDS, Math.max(1, duration));
  const maxStart = Math.max(0, duration - Math.min(length, duration));
  const effectiveLength = Math.min(length, Math.max(0.5, duration - start));

  // Loop the preview inside the selected window.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !duration) return;
    el.currentTime = start;
    void el.play().catch(() => undefined);
    const id = window.setInterval(() => {
      if (el.currentTime >= start + effectiveLength || el.ended) el.currentTime = start;
    }, 120);
    return () => window.clearInterval(id);
  }, [start, effectiveLength, duration]);

  async function handleSave() {
    setWorking(true);
    try {
      const clip =
        !unreadable && duration && canTrimInBrowser()
          ? await trimVideo(file, { start, duration: effectiveLength })
          : file;
      await onConfirm(clip);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video export failed");
    } finally {
      setWorking(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
        <div className="relative flex w-full max-w-sm items-center justify-center overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            className="max-h-[60vh] w-full object-contain"
          />
        </div>
      </div>

      <div className="space-y-4 bg-surface p-4">
        {unreadable ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-foreground">
            {km
              ? "មិនអាចកាត់វីដេអូនេះនៅលើឧបករណ៍នេះទេ — វានឹងបញ្ចូលទាំងស្រុង។"
              : "This video can't be trimmed on this device — it will upload as-is."}
          </p>
        ) : (
          <>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{km ? "ចាប់ផ្តើមនៅ" : "Start at"}</span>
                <span>{start.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, maxStart)}
                step={0.1}
                value={Math.min(start, maxStart)}
                onChange={(e) => setStart(Number(e.target.value))}
                disabled={working || maxStart <= 0}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{km ? "ប្រវែង (០–៣០ វិនាទី)" : "Length (0–30s)"}</span>
                <span>{effectiveLength.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={1}
                max={maxLength}
                step={0.5}
                value={Math.min(length, maxLength)}
                onChange={(e) => setLength(Number(e.target.value))}
                disabled={working || !duration}
                className="w-full accent-primary"
              />
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="h-11 flex-1 rounded-lg border border-border bg-background text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {km ? "បោះបង់" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={working || (!duration && !unreadable)}
            className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {working ? (km ? "កំពុងកាត់..." : "Trimming...") : km ? "រក្សាទុក" : "Use clip"}
          </button>
        </div>
      </div>
    </div>
  );
}
