import { createClientOnlyFn } from "@tanstack/react-start";

const MAX_EDGE = 1600;

export const prepareImageForRecognition = createClientOnlyFn(
  async (file: File): Promise<string> => {
    return resizeImageFile(file, { maxEdge: MAX_EDGE, quality: 0.82 });
  },
) as (file: File) => Promise<string>;

interface ResizeOptions {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
}

export async function resizeImageFile(file: File, options: ResizeOptions = {}): Promise<string> {
  const { maxEdge = 1600, quality = 0.85, maxBytes = 2_000_000 } = options;
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

  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > maxBytes && q > 0.4) {
    q -= 0.05;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

export async function resizeDataUrl(dataUrl: string, options: ResizeOptions = {}): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], "image.jpg", { type: "image/jpeg" });
  return resizeImageFile(file, options);
}
