import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Info, Plus, Play, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/announce")({
  component: () => (
    <RequireAuth>
      <NewPostPage />
    </RequireAuth>
  ),
});

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  is_provider: boolean;
  is_coordinator: boolean;
  is_organization: boolean;
  is_client: boolean;
}

function NewPostPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useQuery({
    queryKey: ["profile:announce", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, is_provider, is_coordinator, is_organization, is_client")
        .eq("id", user!.id)
        .maybeSingle();
      setProfile(data as Profile | null);
      return true;
    },
  });

  useEffect(() => {
    if (!user) return;
    const inv = () => qc.invalidateQueries({ queryKey: ["profile:announce", user.id] });
    const ch = supabase
      .channel(`profile-announce:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, inv)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  function pickFile() {
    fileInput.current?.click();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(file)) return;
    try {
      const { uploadImage } = await import("@/lib/media-upload");
      const url = await uploadImage(user.id, "posts", file);
      setPhotos((p) => [...p, url]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function submit() {
    if (!user) return;
    if (!content.trim() && photos.length === 0 && !videoUrl.trim()) {
      toast.error(t("share_what"));
      return;
    }
    setSubmitting(true);
    try {
      const { data: post, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: content.trim() || null,
          video_url: videoUrl.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (photos.length) {
        await supabase
          .from("post_photos")
          .insert(photos.map((url) => ({ post_id: post.id, photo_url: url })));
      }
      toast.success(t("posted"));
      nav({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabels: string[] = [];
  if (profile?.is_provider) roleLabels.push(t("role_provider"));
  if (profile?.is_coordinator) roleLabels.push(t("role_coordinator"));
  if (profile?.is_organization) roleLabels.push(t("role_organization"));
  if (profile?.is_client) roleLabels.push(t("role_client"));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/home" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("new_post")}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        {/* Author card */}
        <div className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-card">
          <Avatar name={profile?.full_name} url={profile?.avatar_url} size={44} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">{profile?.full_name ?? "—"}</div>
            <div className="truncate text-xs text-muted-foreground">{roleLabels.join(" · ")}</div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">
          <label className="text-sm font-semibold text-foreground">{t("share_what")}</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("write_optional")}
            rows={5}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Photos */}
        <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">
          <label className="text-sm font-semibold text-foreground">{t("photos")}</label>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={pickFile}
              className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background text-primary active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" />
              <span className="mt-0.5 text-[11px]">{t("photos")}</span>
            </button>
            {photos.map((src, i) => (
              <div key={i} className="relative h-20 w-20">
                <img src={src} className="h-full w-full rounded-lg object-cover" alt="" />
                <button
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-foreground/70 p-0.5 text-background"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Short video upload */}
        <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">
          <label className="text-sm font-semibold text-foreground">
            {lang === "km" ? "វីដេអូខ្លី (១៥–៣០ វិនាទី)" : "Short video (15–30s)"}
          </label>
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={onPickVideo} />
          {isDirectVideoUrl(videoUrl) ? (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video src={videoUrl} className="max-h-72 w-full object-contain" controls playsInline muted />
              <button
                onClick={() => setVideoUrl("")}
                className="absolute right-2 top-2 rounded-full bg-foreground/70 p-1 text-background"
                aria-label="Remove video"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => videoInput.current?.click()}
              disabled={uploadingVideo}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background text-sm font-semibold text-primary disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {uploadingVideo
                ? lang === "km" ? "កំពុងបញ្ចូល..." : "Uploading..."
                : lang === "km" ? "បញ្ចូលវីដេអូខ្លី" : "Add short video"}
            </button>
          )}
        </div>

        {/* Video link */}
        <div className="space-y-2 rounded-xl bg-surface p-3 shadow-card">
          <label className="text-sm font-semibold text-foreground">{t("add_video_link")}</label>
          <div className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
            <Play className="h-4 w-4 text-muted-foreground" />
            <input
              value={isDirectVideoUrl(videoUrl) ? "" : videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={t("video_link_ph")}
              className="h-full flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {/* Review notice */}
        <div className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-foreground">{t("review_notice")}</p>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={submit}
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("submit_review")}
        </button>
      </div>
    </div>
  );
}
