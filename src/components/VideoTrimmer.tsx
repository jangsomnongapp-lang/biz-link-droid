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

const ASPECTS: Array<{ id: string; label: string; value?: number }> = [
  { id: "original", label: "Original" },
  { id: "vertical", label: "9:16", value: 9 / 16 },
  { id: "square", label: "1:1", value: 1 },
  { id: "wide", label: "16:9", value: 16 / 9 },
];

const LENGTHS = [15, 30];

export function VideoTrimmer({ file, onCancel, onConfirm }: Props) {
  const { lang } = useI18n();
  const km = lang === "km";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src] = useState(() => URL.createObjectURL(file));
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(15);
  const [aspect, setAspect] = useState<string>("original");
  const [working, setWorking] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  useEffect(() => {
    void readVideoMeta(src)
      .then((meta) => {
        setDuration(meta.duration);
        setLength(Math.min(MAX_CLIP_SECONDS, Math.max(3, Math.min(15, meta.duration))));
      })
      .catch(() => toast.error(km ? "មិនអាចអានវីដេអូ" : "Could not read this video"));
  }, [src, km]);

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
      const aspectValue = ASPECTS.find((a) => a.id === aspect)?.value;
      const clip = canTrimInBrowser()
        ? await trimVideo(file, { start, duration: effectiveLength, aspect: aspectValue })
        : file;
      await onConfirm(clip);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video export failed");
    } finally {
      setWorking(false);
    }
  }

  const aspectClass =
    aspect === "vertical" ? "aspect-[9/16]" : aspect === "square" ? "aspect-square" : aspect === "wide" ? "aspect-video" : "aspect-[3/4]";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
        <div className={`relative w-full max-w-sm overflow-hidden rounded-xl bg-black ${aspectClass}`}>
          <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            className={`h-full w-full ${aspect === "original" ? "object-contain" : "object-cover"}`}
          />
        </div>
      </div>

      <div className="space-y-4 bg-surface p-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{km ? "ចាប់ផ្តើមនៅ" : "Start at"}</span>
            <span>
              {start.toFixed(1)}s · {effectiveLength.toFixed(0)}s
            </span>
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

        <div className="flex gap-2">
          {LENGTHS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={working}
              onClick={() => setLength(value)}
              className={`h-10 flex-1 rounded-lg border text-sm font-semibold ${
                length === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"
              }`}
            >
              {value}s
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {ASPECTS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={working}
              onClick={() => setAspect(option.id)}
              className={`h-10 rounded-lg border text-xs font-semibold ${
                aspect === option.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground"
              }`}
            >
              {option.id === "original" ? (km ? "ដើម" : "Original") : option.label}
            </button>
          ))}
        </div>

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
            disabled={working || !duration}
            className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {working ? (km ? "កំពុងកាត់..." : "Trimming...") : km ? "រក្សាទុក" : "Use clip"}
          </button>
        </div>
      </div>
    </div>
  );
}
