import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { validateImageFile } from "@/lib/upload-validation";

interface ContentMediaDialogProps {
  open: boolean;
  title: string;
  photos: string[];
  videoUrl?: string | null;
  allowVideo?: boolean;
  maxPhotos?: number;
  onCancel: () => void;
  onSave: (media: { photos: string[]; newFiles: File[]; videoUrl: string | null }) => Promise<void>;
}

export function ContentMediaDialog({
  open,
  title,
  photos,
  videoUrl,
  allowVideo = false,
  maxPhotos = 4,
  onCancel,
  onSave,
}: ContentMediaDialogProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Array<{ url: string; file?: File }>>([]);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(photos.map((url) => ({ url })));
    setLink(videoUrl ?? "");
    setSaving(false);
  }, [open, photos, videoUrl]);

  if (!open) return null;

  function pickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const available = Math.max(0, maxPhotos - items.length);
    const accepted = files.filter((file) => validateImageFile(file)).slice(0, available);
    setItems((current) => [
      ...current,
      ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }

  async function save() {
    const trimmedLink = link.trim();
    if (trimmedLink) {
      try {
        const parsed = new URL(trimmedLink);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      } catch {
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({
        photos: items.filter((item) => !item.file).map((item) => item.url),
        newFiles: items.flatMap((item) => (item.file ? [item.file] : [])),
        videoUrl: trimmedLink || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-4 shadow-xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label={t("close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
        <div className="grid grid-cols-4 gap-2">
          {items.map((item, index) => (
            <div key={`${item.url}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <img src={item.url} alt="" className="h-full w-full object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 rounded-full"
                onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={t("delete")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {items.length < maxPhotos && (
            <Button type="button" variant="outline" className="aspect-square h-auto border-dashed" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-5 w-5" />
            </Button>
          )}
        </div>

        {allowVideo && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("add_video_link")}</label>
            <input
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder={t("video_link_ph")}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={onCancel}>{t("cancel")}</Button>
          <Button type="button" className="flex-1" disabled={saving} onClick={() => void save()}>{saving ? "..." : t("save")}</Button>
        </div>
      </div>
    </div>
  );
}