import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, BriefcaseBusiness, FileText, House, ImagePlus, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { OwnerMenu } from "@/components/OwnerMenu";
import { EditTextDialog, type EditTextField } from "@/components/EditTextDialog";
import { ContentMediaDialog } from "@/components/ContentMediaDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/my-posts")({
  component: () => <RequireAuth><AppShell><MyContentPage /></AppShell></RequireAuth>,
});

type Kind = "post" | "rental" | "project";
type Photo = { id: string; photo_url: string };
type Post = { id: string; content: string | null; title: string | null; video_url: string | null; created_at: string; status: string; post_photos: Photo[] };
type Rental = { id: string; title: string; description: string | null; location: string; price_per_day: number; min_days: number; created_at: string; status: string; rental_photos: Photo[] };
type Project = { id: string; title: string; description: string | null; location: string | null; budget: number | null; created_at: string; status: string; listing_photos: Photo[] };
type Target = { kind: Kind; item: Post | Rental | Project };

function MyContentPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Kind>("post");
  const [editing, setEditing] = useState<Target | null>(null);
  const [mediaEditing, setMediaEditing] = useState<Target | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-content", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { posts: [], rentals: [], projects: [] };
      const [posts, rentals, projects] = await Promise.all([
        supabase.from("posts").select("id, content, title, video_url, created_at, status, post_photos(id, photo_url)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("rental_listings").select("id, title, description, location, price_per_day, min_days, created_at, status, rental_photos(id, photo_url)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("listings").select("id, title, description, location, budget, created_at, status, listing_photos(id, photo_url)").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (posts.error || rentals.error || projects.error) throw posts.error ?? rentals.error ?? projects.error;
      return { posts: (posts.data ?? []) as Post[], rentals: (rentals.data ?? []) as Rental[], projects: (projects.data ?? []) as Project[] };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-content", user?.id ?? null] });
  const tabs = [
    { id: "post" as const, label: lang === "km" ? "ការបង្ហោះ" : "Posts", icon: FileText, count: data?.posts.length ?? 0 },
    { id: "rental" as const, label: lang === "km" ? "ការជួល" : "Rentals", icon: House, count: data?.rentals.length ?? 0 },
    { id: "project" as const, label: lang === "km" ? "គម្រោង" : "Projects", icon: BriefcaseBusiness, count: data?.projects.length ?? 0 },
  ];
  const items = tab === "post" ? data?.posts ?? [] : tab === "rental" ? data?.rentals ?? [] : data?.projects ?? [];

  async function saveText(values: Record<string, string>) {
    if (!editing || !user) return;
    let error: { message: string } | null = null;
    if (editing.kind === "post") {
      const item = editing.item as Post;
      ({ error } = await supabase.from("posts").update({ title: values.title.trim() || null, content: values.content.trim() || null }).eq("id", item.id).eq("user_id", user.id));
    } else if (editing.kind === "rental") {
      const item = editing.item as Rental;
      ({ error } = await supabase.from("rental_listings").update({ title: values.title.trim(), description: values.description.trim() || null, location: values.location.trim(), price_per_day: Number(values.price_per_day), min_days: Number(values.min_days) || 1 }).eq("id", item.id).eq("user_id", user.id));
    } else {
      const item = editing.item as Project;
      ({ error } = await supabase.from("listings").update({ title: values.title.trim(), description: values.description.trim() || null, location: values.location.trim() || null, budget: values.budget ? Number(values.budget) : null }).eq("id", item.id).eq("user_id", user.id));
    }
    if (error) return toast.error(error.message);
    setEditing(null);
    void invalidate();
  }

  async function saveMedia(media: { photos: string[]; newFiles: File[]; videoUrl: string | null }) {
    if (!mediaEditing || !user) return;
    const { kind, item } = mediaEditing;
    const relation = kind === "post" ? "post_photos" : kind === "rental" ? "rental_photos" : "listing_photos";
    const foreignKey = kind === "post" ? "post_id" : "listing_id";
    const current = getPhotos(mediaEditing);
    const kept = new Set(media.photos);
    const removedIds = current.filter((photo) => !kept.has(photo.photo_url)).map((photo) => photo.id);
    let newUrls: string[] = [];
    if (kind === "rental") {
      for (const file of media.newFiles) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from("rental-photos").upload(path, file, { contentType: file.type });
        if (upload.error) return toast.error(upload.error.message);
        newUrls.push(supabase.storage.from("rental-photos").getPublicUrl(path).data.publicUrl);
      }
    } else {
      newUrls = await Promise.all(media.newFiles.map(fileToDataUrl));
    }
    if (removedIds.length) {
      const result = await supabase.from(relation).delete().in("id", removedIds);
      if (result.error) return toast.error(result.error.message);
    }
    if (newUrls.length) {
      const rows = newUrls.map((photo_url) => ({ [foreignKey]: item.id, photo_url }));
      const result = await supabase.from(relation).insert(rows as never);
      if (result.error) return toast.error(result.error.message);
    }
    if (kind === "post") {
      const result = await supabase.from("posts").update({ video_url: media.videoUrl }).eq("id", item.id).eq("user_id", user.id);
      if (result.error) return toast.error(result.error.message);
    }
    setMediaEditing(null);
    void invalidate();
  }

  async function confirmDelete() {
    if (!deleting || !user) return;
    const table = deleting.kind === "post" ? "posts" : deleting.kind === "rental" ? "rental_listings" : "listings";
    const result = await supabase.from(table).delete().eq("id", deleting.item.id).eq("user_id", user.id);
    if (result.error) return toast.error(result.error.message);
    setDeleting(null);
    toast.success(t("deleted"));
    void invalidate();
  }

  const fields = editing ? getFields(editing, t) : [];
  const mediaPhotos = mediaEditing ? getPhotos(mediaEditing).map((photo) => photo.photo_url) : [];
  const mediaVideo = mediaEditing?.kind === "post" ? (mediaEditing.item as Post).video_url : null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-surface px-2">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: "/settings" })} aria-label={t("back")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 text-center text-base font-semibold">{lang === "km" ? "មាតិការបស់ខ្ញុំ" : "My Content"}</h1>
        <div className="w-9" />
      </header>
      <div className="grid grid-cols-3 border-b border-border bg-surface p-2">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <Button key={id} variant={tab === id ? "default" : "ghost"} className="gap-1.5" onClick={() => setTab(id)}><Icon className="h-4 w-4" />{label} <span className="text-xs opacity-70">{count}</span></Button>
        ))}
      </div>
      <main className="space-y-3 p-3">
        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</p>}
        {!isLoading && items.length === 0 && <p className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">{lang === "km" ? "មិនទាន់មានទិន្នន័យ" : `No ${tab}s yet`}</p>}
        {items.map((item) => <ContentCard key={item.id} kind={tab} item={item} onEdit={() => setEditing({ kind: tab, item })} onMedia={() => setMediaEditing({ kind: tab, item })} onDelete={() => setDeleting({ kind: tab, item })} />)}
      </main>
      <EditTextDialog open={!!editing} title={t("edit")} fields={fields} onCancel={() => setEditing(null)} onSave={saveText} />
      <ContentMediaDialog open={!!mediaEditing} title={lang === "km" ? "កែរូបថត និងវីដេអូ" : "Edit photos and video"} photos={mediaPhotos} videoUrl={mediaVideo} allowVideo={mediaEditing?.kind === "post"} onCancel={() => setMediaEditing(null)} onSave={saveMedia} />
      <ConfirmDialog open={!!deleting} title={t("delete")} description={t("delete_confirm_desc")} destructive onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function ContentCard({ kind, item, onEdit, onMedia, onDelete }: { kind: Kind; item: Post | Rental | Project; onEdit: () => void; onMedia: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  const photos = getPhotos({ kind, item });
  const title = kind === "post" ? (item as Post).title || (item as Post).content || t("my_posts") : (item as Rental | Project).title;
  const description = kind === "post" ? (item as Post).content : (item as Rental | Project).description;
  const href = kind === "rental" ? "/rentals/$rentalId" : kind === "project" ? "/listings/$listingId" : "/home";
  const params = kind === "rental" ? { rentalId: item.id } : kind === "project" ? { listingId: item.id } : undefined;
  return (
    <article className="overflow-hidden rounded-xl bg-surface shadow-card">
      {photos[0] && <img src={photos[0].photo_url} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1"><h2 className="line-clamp-2 text-sm font-semibold text-foreground">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(item.created_at, t)} · {item.status}</p></div>
          <OwnerMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
        {description && description !== title && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        {"location" in item && item.location && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{item.location}</p>}
        <div className="mt-3 flex gap-2 border-t border-border pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onMedia}><ImagePlus className="h-4 w-4" />{t("photos")}</Button>
          <Button asChild variant="ghost" size="sm" className="flex-1"><Link to={href} params={params as never}>{t("view")}</Link></Button>
        </div>
      </div>
    </article>
  );
}

function getPhotos(target: Target): Photo[] {
  if (target.kind === "post") return (target.item as Post).post_photos;
  if (target.kind === "rental") return (target.item as Rental).rental_photos;
  return (target.item as Project).listing_photos;
}

function getFields(target: Target, t: ReturnType<typeof useI18n>["t"]): EditTextField[] {
  if (target.kind === "post") { const p = target.item as Post; return [{ key: "title", label: t("title"), initial: p.title ?? "" }, { key: "content", label: t("description"), initial: p.content ?? "", type: "textarea", required: true }]; }
  if (target.kind === "rental") { const r = target.item as Rental; return [{ key: "title", label: t("title"), initial: r.title, required: true }, { key: "description", label: t("description"), initial: r.description ?? "", type: "textarea" }, { key: "location", label: t("location"), initial: r.location, required: true }, { key: "price_per_day", label: t("price_per_day_label"), initial: String(r.price_per_day), type: "number", required: true }, { key: "min_days", label: t("min_days"), initial: String(r.min_days), type: "number", required: true }]; }
  const p = target.item as Project; return [{ key: "title", label: t("title"), initial: p.title, required: true }, { key: "description", label: t("description"), initial: p.description ?? "", type: "textarea" }, { key: "location", label: t("location"), initial: p.location ?? "" }, { key: "budget", label: t("budget"), initial: p.budget == null ? "" : String(p.budget), type: "number" }];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
}