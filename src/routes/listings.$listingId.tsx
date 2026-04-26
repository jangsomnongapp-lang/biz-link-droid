import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { ArrowLeft, MapPin, Share2, ChevronRight, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/listings/$listingId")({
  component: () => (
    <RequireAuth>
      <ListingDetailPage />
    </RequireAuth>
  ),
});

interface DetailRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  budget: number | null;
  location: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  listing_categories: { categories: { name_en: string; name_km: string } | null }[];
  listing_photos: { photo_url: string }[];
}

interface Applicant {
  id: string;
  applicant_id: string;
  created_at: string;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

function ListingDetailPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const { listingId } = useParams({ from: "/listings/$listingId" });
  const [listing, setListing] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [postedCount, setPostedCount] = useState(0);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [contactingId, setContactingId] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("listings")
      .select(
        "id, user_id, title, description, budget, location, status, created_at, profiles(full_name, avatar_url), listing_categories(categories(name_en, name_km)), listing_photos(photo_url)"
      )
      .eq("id", listingId)
      .maybeSingle()
      .then(({ data }) => {
        setListing(data as DetailRow | null);
        setLoading(false);
        if (data) {
          void supabase
            .from("listings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", data.user_id)
            .then(({ count }) => setPostedCount(count ?? 0));
        }
      });
    if (user) {
      void supabase
        .from("applications")
        .select("id")
        .eq("listing_id", listingId)
        .eq("applicant_id", user.id)
        .maybeSingle()
        .then(({ data }) => setApplied(!!data));
    }
  }, [listingId, user]);

  // Load applicants when current user owns the listing
  useEffect(() => {
    if (!user || !listing || listing.user_id !== user.id) return;
    void supabase
      .from("applications")
      .select("id, applicant_id, created_at, status, profiles!applications_applicant_id_fkey(full_name, avatar_url)")
      .eq("listing_id", listing.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setApplicants((data as Applicant[] | null) ?? []));
  }, [user, listing]);

  async function confirmApply() {
    if (!user || !listing) return;
    setShowConfirm(false);
    const { error } = await supabase
      .from("applications")
      .insert({ listing_id: listing.id, applicant_id: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setApplied(true);
    toast.success(lang === "km" ? "បានដាក់ពាក្យ" : "Applied!");
  }

  async function finishProject() {
    if (!listing) return;
    setFinishing(true);
    const { error } = await supabase
      .from("listings")
      .update({ status: "finished" })
      .eq("id", listing.id);
    setFinishing(false);
    setShowFinishConfirm(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setListing({ ...listing, status: "finished" });
    toast.success(t("project_finished"));
  }

  async function messageApplicant(applicantId: string) {
    if (!user) return;
    setContactingId(applicantId);
    try {
      const [a, b] = [user.id, applicantId].sort();
      const { data: existing } = await supabase
        .from("message_threads")
        .select("id")
        .eq("participant_a", a)
        .eq("participant_b", b)
        .maybeSingle();
      let threadId = existing?.id;
      if (!threadId) {
        const { data: created, error } = await supabase
          .from("message_threads")
          .insert({ participant_a: a, participant_b: b })
          .select("id")
          .single();
        if (error) throw error;
        threadId = created.id;
      }
      nav({ to: "/messages/$threadId", params: { threadId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContactingId(null);
    }
  }

  async function shareListing() {
    if (!listing) return;
    const url = `${window.location.origin}/listings/${listing.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url });
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share_link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }

  if (loading)
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>;
  if (!listing)
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Not found</div>;

  const isOwn = user?.id === listing.user_id;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/listings" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("project_detail")}</h1>
        <button
          onClick={() => void shareListing()}
          className="rounded-full p-2 active:bg-white/10"
          aria-label={t("share")}
        >
          <Share2 className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 space-y-2 pb-24">
        {/* Author */}
        <div className="flex items-center gap-3 bg-surface p-4 shadow-card">
          <Avatar name={listing.profiles?.full_name} url={listing.profiles?.avatar_url} size={44} />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">{listing.profiles?.full_name ?? "User"}</div>
            <div className="text-xs text-muted-foreground">
              {timeAgo(listing.created_at, t)}
              {listing.location ? ` · ${listing.location}` : ""}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <h2 className="flex-1 text-lg font-bold text-foreground">{listing.title}</h2>
            {listing.status === "finished" && (
              <span className="flex shrink-0 items-center gap-1 rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("finished")}
              </span>
            )}
          </div>
          {listing.description && <p className="mt-2 text-sm leading-relaxed text-foreground">{listing.description}</p>}
        </div>

        {/* Categories */}
        <div className="bg-surface p-4 shadow-card">
          <div className="text-sm font-semibold text-foreground">{t("specialty_needed")}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {listing.listing_categories.map((lc, i) =>
              lc.categories ? (
                <span
                  key={i}
                  className="rounded-pill bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {lang === "km" ? lc.categories.name_km : lc.categories.name_en}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Loc & budget */}
        <div className="grid grid-cols-2 gap-px bg-border">
          <div className="bg-surface p-4">
            <div className="text-xs font-medium text-muted-foreground">{t("location")}</div>
            <div className="mt-1 flex items-center gap-1 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-destructive" /> {listing.location ?? "—"}
            </div>
          </div>
          <div className="bg-surface p-4">
            <div className="text-xs font-medium text-muted-foreground">{t("budget")}</div>
            <div className="mt-1 text-sm font-bold text-success">
              {listing.budget ? `$ ${listing.budget}` : t("to_discuss")}
            </div>
          </div>
        </div>

        {/* Photos */}
        {listing.listing_photos.length > 0 && (
          <div className="bg-surface p-4 shadow-card">
            <div className="mb-2 text-sm font-semibold text-foreground">{t("photos")}</div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {listing.listing_photos.map((p, i) => (
                <img key={i} src={p.photo_url} className="h-32 w-32 shrink-0 rounded-lg object-cover" alt="" />
              ))}
            </div>
          </div>
        )}

        {/* Applicants (owner only) */}
        {isOwn && (
          <div className="bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">{t("applicants_title")}</div>
              <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {applicants.length}
              </span>
            </div>
            {applicants.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">{t("no_applicants")}</div>
            ) : (
              <ul className="divide-y divide-border">
                {applicants.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <Link
                      to="/users/$userId"
                      params={{ userId: a.applicant_id }}
                      className="flex flex-1 items-center gap-3 active:opacity-70"
                    >
                      <Avatar name={a.profiles?.full_name} url={a.profiles?.avatar_url} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {a.profiles?.full_name ?? "User"}
                        </div>
                        <div className="text-xs text-muted-foreground">{timeAgo(a.created_at, t)}</div>
                      </div>
                    </Link>
                    <button
                      onClick={() => void messageApplicant(a.applicant_id)}
                      disabled={contactingId === a.applicant_id}
                      className="flex items-center gap-1 rounded-pill bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t("message")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}


        <div className="bg-surface p-4 shadow-card">
          <div className="mb-3 text-sm font-semibold text-foreground">{t("about_client")}</div>
          <Link
            to="/users/$userId"
            params={{ userId: listing.user_id }}
            className="flex items-center gap-3 active:bg-muted"
          >
            <Avatar name={listing.profiles?.full_name} url={listing.profiles?.avatar_url} size={40} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-primary">{listing.profiles?.full_name ?? "User"}</div>
              <div className="text-xs text-muted-foreground">
                {postedCount} {t("projects_posted").toLowerCase()}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Bottom apply / finish */}
      {isOwn ? (
        listing.status !== "finished" && (
          <div className="sticky bottom-0 border-t border-border bg-surface p-3">
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-success text-sm font-semibold text-success-foreground active:scale-[0.99]"
            >
              <CheckCircle2 className="h-5 w-5" />
              {t("mark_finished")}
            </button>
          </div>
        )
      ) : (
        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface p-3">
          <button className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-primary text-sm font-semibold text-primary active:scale-[0.99]">
            {t("contact")}
          </button>
          <button
            onClick={() => !applied && listing.status !== "finished" && setShowConfirm(true)}
            disabled={applied || listing.status === "finished"}
            className={`flex h-12 flex-[2] items-center justify-center rounded-xl text-sm font-semibold active:scale-[0.99] ${
              applied || listing.status === "finished"
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {listing.status === "finished" ? t("finished") : applied ? t("applied") : t("apply")}
          </button>
        </div>
      )}

      {/* Finish confirm modal */}
      {showFinishConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setShowFinishConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-surface p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-center text-lg font-bold text-foreground">{t("finish_confirm_title")}</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">{t("finish_confirm_desc")}</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border-2 border-border text-sm font-semibold text-foreground"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => void finishProject()}
                disabled={finishing}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-success text-sm font-semibold text-success-foreground disabled:opacity-50"
              >
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-surface p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              ✋
            </div>
            <h3 className="text-center text-lg font-bold text-foreground">{t("apply_confirm_title")}</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">{listing.title}</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border-2 border-border text-sm font-semibold text-foreground"
              >
                {t("cancel")}
              </button>
              <button
                onClick={confirmApply}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
