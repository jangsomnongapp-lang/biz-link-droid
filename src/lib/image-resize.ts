import { createClientOnlyFn } from "@tanstack/react-start";

const MAX_EDGE = 1600;

export const prepareImageForRecognition = createClientOnlyFn(
  async (file: File): Promise<string> => {
    return resizeImageFile(file, { maxEdge: MAX_EDGE, quality: 0.82, format: "image/jpeg" });
  },
) as (file: File) => Promise<string>;

interface ResizeOptions {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
  /** Force an output type. Defaults to WebP when the browser can encode it. */
  format?: "image/webp" | "image/jpeg";
}

let webpSupport: boolean | null = null;

/** WebP is ~25-35% smaller than JPEG at the same quality — big win on mobile data. */
function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    webpSupport = probe.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export async function resizeImageFile(file: File, options: ResizeOptions = {}): Promise<string> {
  const {
    maxEdge = 1280,
    quality = 0.78,
    maxBytes = 500_000,
    format = supportsWebp() ? "image/webp" : "image/jpeg",
  } = options;
  const source = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    source.close();
    throw new Error("Image processing is unavailable");
  }
  context.drawImage(source, 0, 0, width, height);
  source.close();

  const type = format === "image/webp" && !supportsWebp() ? "image/jpeg" : format;

  let q = quality;
  let dataUrl = canvas.toDataURL(type, q);
  while (dataUrl.length > maxBytes && q > 0.4) {
    q -= 0.06;
    dataUrl = canvas.toDataURL(type, q);
  }
  return dataUrl;
}

export async function resizeDataUrl(dataUrl: string, options: ResizeOptions = {}): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], "image", { type: blob.type || "image/jpeg" });
  return resizeImageFile(file, options);
}
