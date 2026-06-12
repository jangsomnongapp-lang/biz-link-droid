import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { ReportMenu } from "@/components/ReportMenu";
import { OwnerMenu } from "@/components/OwnerMenu";
import { EditTextDialog } from "@/components/EditTextDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rentals/$rentalId")({
  component: () => (
    <RequireAuth>
      <RentalDetailPage />
    </RequireAuth>
  ),
});

interface RentalDetail {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  price_per_day: number;
  min_days: number;
  availability: string;
  available_from: string | null;
  location: string;
  status: string;
  created_at: string;
  rental_photos: { photo_url: string }[];
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    about_me: string | null;
    created_at: string;
  } | null;
}

const CAT_LABELS: Record<string, { km: string; en: string }> = {
  vehicles: { km: "យានជំនិះ", en: "Vehicles" },
  heavy: { km: "គ្រឿងចក្រ", en: "Heavy" },
  light: { km: "ម៉ាស៊ីនស្រាល", en: "Light machinery" },
  tools: { km: "ឧបករណ៍", en: "Tools" },
};

function RentalDetailPage() {
  const { rentalId } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [rental, setRental] = useState<RentalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void supabase
      .from("rental_listings")
      .select("*, rental_photos(photo_url), profiles(full_name, avatar_url, about_me, created_at)")
      .eq("id", rentalId)
      .maybeSingle()
      .then(({ data }) => {
        setRental(data as RentalDetail | null);
        setLoading(false);
      });
  }, [rentalId]);

  async function contact() {
    if (!user || !rental || rental.user_id === user.id) return;
    setContacting(true);
    try {
      const [a, b] = [user.id, rental.user_id].sort();
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
      nav({ to: "/messages/$threadId", params: { threadId }, search: { pin: `rental:${rental.id}` } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContacting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>;
  }
  if (!rental) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Not found</div>;
  }

  const catLabel = CAT_LABELS[rental.category]?.[lang] ?? rental.category;
  const memberSince = rental.profiles?.created_at
    ? new Date(rental.profiles.created_at).getFullYear()
    : "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-[#534AB7] px-2 text-white">
        <Link to="/suppliers" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("rental_detail")}</h1>
        {user && user.id !== rental.user_id ? (
          <ReportMenu targetKind="post" targetId={rental.id} />
        ) : user && user.id === rental.user_id ? (
          <OwnerMenu
            iconClassName="text-white"
            onEdit={() => setEditing(true)}
            onDelete={() => setDeleting(true)}
          />
        ) : (
          <div className="w-9" />
        )}
      </header>

      <div className="flex-1 pb-24">
        {/* Photo carousel */}
        {rental.rental_photos.length > 0 ? (
          <div className="flex snap-x snap-mandatory overflow-x-auto bg-[#EEEDFE]">
            {rental.rental_photos.map((p, i) => (
              <img
                key={i}
                src={p.photo_url}
                alt=""
                className="aspect-[4/3] w-full shrink-0 snap-start object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="aspect-[4/3] w-full bg-[#EEEDFE]" />
        )}

        {/* Info */}
        <div className="bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="rounded-pill bg-[#EEEDFE] px-2.5 py-0.5 text-xs font-semibold text-[#26215C]">
              {catLabel}
            </span>
            <AvailabilityBadge rental={rental} t={t} />
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="flex-1 text-base font-semibold text-foreground">{rental.title}</h2>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#534AB7]">${rental.price_per_day}</div>
              <div className="text-[11px] text-muted-foreground">{t("per_day")}</div>
            </div>
          </div>
          {rental.description && (
            <p className="mt-2 text-sm text-foreground">{rental.description}</p>
          )}
        </div>

        {/* Listed by */}
        <div className="mt-2 bg-surface p-4 shadow-card">
          <h3 className="mb-2 text-sm font-bold">{t("listed_by")}</h3>
          <div className="flex items-center gap-3">
            <Avatar name={rental.profiles?.full_name} url={rental.profiles?.avatar_url} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{rental.profiles?.full_name ?? "User"}</div>
              <div className="text-[11px] text-muted-foreground">
                {rental.location}
                {memberSince ? ` · Member since ${memberSince}` : ""}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Link
                to="/users/$userId"
                params={{ userId: rental.user_id }}
                className="rounded-full border border-[#534AB7] px-3 py-1.5 text-xs font-semibold text-[#534AB7] active:bg-[#EEEDFE]"
              >
                {t("view_profile")}
              </Link>
              {user && user.id !== rental.user_id && (
                <button
                  onClick={() => void contact()}
                  disabled={contacting}
                  className="rounded-full bg-[#534AB7] px-3 py-1.5 text-xs font-semibold text-white active:scale-[0.99] disabled:opacity-60"
                >
                  {t("contact")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details table */}
        <div className="mt-2 bg-surface p-4 shadow-card">
          <h3 className="mb-2 text-sm font-bold">{t("details")}</h3>
          <dl className="divide-y divide-border text-sm">
            <Row label={t("category_label")} value={catLabel} />
            <Row label={t("price_per_day_label")} value={`$${rental.price_per_day}`} />
            <Row label={t("min_days")} value={`${rental.min_days} day${rental.min_days > 1 ? "s" : ""}`} />
            <Row label={t("location")} value={rental.location} icon={<MapPin className="h-3.5 w-3.5 text-destructive" />} />
            <Row
              label={t("available_from")}
              value={
                rental.availability === "now"
                  ? t("available_now")
                  : rental.available_from ?? "—"
              }
              valueClass="text-success font-semibold"
            />
          </dl>
        </div>
      </div>

      {user && user.id !== rental.user_id && (
        <div className="sticky bottom-0 border-t border-border bg-surface p-3">
          <button
            onClick={() => void contact()}
            disabled={contacting}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#534AB7] text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {contacting ? t("loading") : t("contact_to_rent")}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, icon, valueClass }: { label: string; value: string; icon?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`flex items-center gap-1 text-foreground ${valueClass ?? ""}`}>
        {icon}
        {value}
      </dd>
    </div>
  );
}

function AvailabilityBadge({ rental, t }: { rental: RentalDetail; t: ReturnType<typeof useI18n>["t"] }) {
  if (rental.availability === "now") {
    return (
      <span className="rounded-pill bg-[#e8f8f0] px-2.5 py-0.5 text-xs font-semibold text-[#27ae60]">
        {t("available_now")}
      </span>
    );
  }
  return (
    <span className="rounded-pill bg-[#fff8e1] px-2.5 py-0.5 text-xs font-semibold text-[#b07d00]">
      {t("booked_until")} {rental.available_from ?? ""}
    </span>
  );
}
