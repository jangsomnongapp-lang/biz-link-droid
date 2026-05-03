import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface ShareButtonProps {
  path: string;
  title?: string;
  text?: string;
  className?: string;
  label?: string;
  variant?: "icon" | "pill";
}

export function ShareButton({
  path,
  title,
  text,
  className,
  label,
  variant = "icon",
}: ShareButtonProps) {
  const { t } = useI18n();

  async function handleShare() {
    const url = `${window.location.origin}${path}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      // user cancelled or unsupported — fall through to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share_link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => void handleShare()}
        className={
          className ??
          "flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur active:bg-white/25"
        }
        aria-label={t("share")}
      >
        <Share2 className="h-3.5 w-3.5" />
        {label ?? t("share")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={className ?? "rounded-full p-2 active:bg-white/10"}
      aria-label={t("share")}
    >
      <Share2 className="h-5 w-5" />
    </button>
  );
}
