import { supabase } from "@/integrations/supabase/client";

/** Extract the object path from a Supabase Storage public/signed URL, or return as-is if already a path. */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (!urlOrPath) return urlOrPath;
  const pub = `/object/public/${bucket}/`;
  let i = urlOrPath.indexOf(pub);
  if (i >= 0) return urlOrPath.slice(i + pub.length);
  const sig = `/object/sign/${bucket}/`;
  i = urlOrPath.indexOf(sig);
  if (i >= 0) return urlOrPath.slice(i + sig.length).split("?")[0];
  return urlOrPath;
}

/** Create a short-lived signed URL for a private bucket object. */
export async function signStorageUrl(
  bucket: string,
  urlOrPath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const path = extractStoragePath(urlOrPath, bucket);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}
