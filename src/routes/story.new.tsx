import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Image as ImageIcon, Info, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/story/new")({
  component: () => (
    <RequireAuth>
      <NewStoryPage />
    </RequireAuth>
  ),
});

function NewStoryPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setPhoto(dataUrl);
  }

  async function submit() {
    if (!user) return;
    if (!photo) {
      toast.error(t("story_pick_photo"));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: photo,
        media_type: "photo",
        caption: caption.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success(t("story_posted"));
      nav({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/home" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("story_new")}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} />

        {!photo ? (
          <button
            onClick={() => fileInput.current?.click()}
            className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface text-primary active:scale-[0.99]"
          >
            <ImageIcon className="h-10 w-10" />
            <span className="text-sm font-semibold">{t("story_pick_photo")}</span>
          </button>
        ) : (
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black">
            <img src={photo} alt="" className="h-full w-full object-contain" />
            <button
              onClick={() => setPhoto(null)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </button>
            {caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm text-white">
                {caption}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("story_caption_ph")}
            maxLength={120}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-foreground">{t("story_review_notice")}</p>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={submit}
          disabled={submitting || !photo}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("story_submit")}
        </button>
      </div>
    </div>
  );
}
