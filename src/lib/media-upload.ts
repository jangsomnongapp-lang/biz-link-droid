import { supabase } from "@/integrations/supabase/client";
import { resizeDataUrl, resizeImageFile } from "@/lib/image-resize";

/**
 * Public bucket used for all feed media (posts, stories, avatars, portfolio).
 * Images are uploaded here and only the short URL is stored in the database —
 * storing base64 data URLs in Postgres made the feed queries megabytes large.
 */
export const MEDIA_BUCKET = "rental-photos";

function publicUrl(path: string): string {
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadBlob(userId: string, folder: string, blob: Blob): Promise<string> {
  const type = blob.type || "image/jpeg";
  const ext = type.includes("webp") ? "webp" : type.includes("png") ? "png" : "jpg";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: "31536000" });
  if (error) throw error;
  return publicUrl(path);
}

/** Resize an image file and upload it, returning a public URL. */
export async function uploadImage(
  userId: string,
  folder: string,
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<string> {
  const dataUrl = await resizeImageFile(file, {
    maxEdge: options.maxEdge ?? 1280,
    quality: options.quality ?? 0.78,
  });
  return uploadDataUrl(userId, folder, dataUrl, options);
}

/** Resize a data URL (e.g. from a cropper) and upload it, returning a public URL. */
export async function uploadDataUrl(
  userId: string,
  folder: string,
  dataUrl: string,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl; // already a URL
  const sized = await resizeDataUrl(dataUrl, {
    maxEdge: options.maxEdge ?? 1280,
    quality: options.quality ?? 0.78,
  });
  const blob = await (await fetch(sized)).blob();
  return uploadBlob(userId, folder, blob);
}

/** Upload a short video clip and return its public URL. */
export async function uploadVideo(userId: string, folder: string, clip: Blob): Promise<string> {
  const type = clip.type || "video/mp4";
  const ext = type.includes("webm") ? "webm" : type.includes("quicktime") ? "mov" : "mp4";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, clip, { contentType: type, cacheControl: "31536000" });
  if (error) throw error;
  return publicUrl(path);
}
