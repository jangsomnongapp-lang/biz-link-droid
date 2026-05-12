import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { signStorageUrl } from "@/lib/storage";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  bucket: string;
  src: string | null | undefined;
  /** Fallback rendered while loading or when the path is missing. */
  fallback?: React.ReactNode;
}

/** Renders an <img> backed by a freshly minted signed URL for a private storage bucket. */
export function SignedImage({ bucket, src, fallback = null, alt = "", ...rest }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!src) { setUrl(null); return; }
    void signStorageUrl(bucket, src).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => { cancelled = true; };
  }, [bucket, src]);

  if (!url) return <>{fallback}</>;
  return <img src={url} alt={alt} {...rest} />;
}
