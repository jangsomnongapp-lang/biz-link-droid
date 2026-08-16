/**
 * Client-side short-video helpers: read metadata, then trim + crop a clip
 * by replaying it into a canvas and re-encoding with MediaRecorder.
 * Keeps uploads small (15-30s clips) so the feed can autoplay them.
 */

export const MAX_CLIP_SECONDS = 30;
export const MIN_CLIP_SECONDS = 0.5;

export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
}

export function loadVideoElement(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    el.playsInline = true;
    // NOTE: no crossOrigin — blob:/object URLs are same-origin and setting it
    // makes some browsers (Safari, older Chrome) fail to load the media.
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(el);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Could not read this video"));
    };
    const timer = window.setTimeout(() => {
      // Metadata events can silently never fire for some containers; accept
      // whatever the element already knows instead of blocking the user.
      if (el.videoWidth || Number.isFinite(el.duration)) done();
      else fail();
    }, 8000);
    function cleanup() {
      window.clearTimeout(timer);
      el.onloadedmetadata = null;
      el.onloadeddata = null;
      el.ondurationchange = null;
      el.onerror = null;
    }
    el.onloadedmetadata = done;
    el.onloadeddata = done;
    el.ondurationchange = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) done();
    };
    el.onerror = fail;
    el.src = src;
    el.load();
  });
}

/** Some containers report Infinity until you seek; nudge the element to resolve it. */
async function resolveDuration(el: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(el.duration) && el.duration > 0) return el.duration;
  return new Promise<number>((resolve) => {
    const finish = () => {
      el.ontimeupdate = null;
      el.currentTime = 0;
      resolve(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0);
    };
    el.ontimeupdate = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) finish();
    };
    try {
      el.currentTime = 1e6;
    } catch {
      finish();
    }
    window.setTimeout(finish, 3000);
  });
}

export async function readVideoMeta(src: string): Promise<VideoMeta> {
  const el = await loadVideoElement(src);
  const duration = await resolveDuration(el);
  return { duration, width: el.videoWidth, height: el.videoHeight };
}


function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function canTrimInBrowser(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

export interface TrimOptions {
  /** Seconds into the source where the clip starts. */
  start: number;
  /** Clip length in seconds (capped at MAX_CLIP_SECONDS). */
  duration: number;
  /** Longest output edge in pixels. */
  maxEdge?: number;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

/** Trim and center-crop a video file, returning an encoded blob. */
export async function trimVideo(file: File | Blob, options: TrimOptions): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = await loadVideoElement(url);
    const sourceDuration = Number.isFinite(video.duration) ? video.duration : options.duration;
    const start = Math.max(0, Math.min(options.start, Math.max(0, sourceDuration - MIN_CLIP_SECONDS)));
    const length = Math.min(options.duration, MAX_CLIP_SECONDS, Math.max(0.5, sourceDuration - start));

    const srcW = video.videoWidth || 720;
    const srcH = video.videoHeight || 1280;
    const targetAspect = srcW / srcH;
    const maxEdge = options.maxEdge ?? 720;

    // Center crop rectangle inside the source frame.
    let cropW = srcW;
    let cropH = Math.round(srcW / targetAspect);
    if (cropH > srcH) {
      cropH = srcH;
      cropW = Math.round(srcH * targetAspect);
    }
    const cropX = Math.max(0, Math.round((srcW - cropW) / 2));
    const cropY = Math.max(0, Math.round((srcH - cropH) / 2));

    const scale = Math.min(1, maxEdge / Math.max(cropW, cropH));
    const outW = Math.max(2, Math.round((cropW * scale) / 2) * 2);
    const outH = Math.max(2, Math.round((cropH * scale) / 2) * 2);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    const stream = canvas.captureStream(30);

    // Mix in the original audio when the browser allows it.
    let audioCtx: AudioContext | null = null;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        audioCtx = new Ctor();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
      }
    } catch {
      audioCtx = null;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 2_500_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
      recorder.onerror = () => reject(new Error("Video export failed"));
    });

    video.muted = !audioCtx;
    await seek(video, start);
    recorder.start(250);
    await video.play();

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
      raf = requestAnimationFrame(draw);
    };
    draw();

    await new Promise<void>((resolve) => {
      const stopAt = start + length;
      const check = () => {
        if (video.currentTime >= stopAt || video.ended) {
          resolve();
          return;
        }
        setTimeout(check, 80);
      };
      check();
    });

    cancelAnimationFrame(raf);
    video.pause();
    recorder.stop();
    const blob = await finished;
    for (const track of stream.getTracks()) track.stop();
    void audioCtx?.close();
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
