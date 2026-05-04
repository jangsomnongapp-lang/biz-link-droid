import { toast } from "sonner";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateImageFile(file: File, maxBytes = MAX_IMAGE_BYTES): boolean {
  if (file.type && !file.type.startsWith("image/")) {
    toast.error("Only image files are allowed");
    return false;
  }
  if (file.type && ALLOWED_IMAGE_TYPES.length && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    toast.error("Unsupported image format");
    return false;
  }
  if (file.size > maxBytes) {
    toast.error(`Image too large (max ${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`);
    return false;
  }
  return true;
}

export function validateVideoFile(file: File, maxBytes = MAX_VIDEO_BYTES): boolean {
  if (file.type && !file.type.startsWith("video/")) {
    toast.error("Only video files are allowed");
    return false;
  }
  if (file.size > maxBytes) {
    toast.error(`Video too large (max ${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`);
    return false;
  }
  return true;
}
