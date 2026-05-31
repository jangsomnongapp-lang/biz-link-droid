import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/listings/")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ListingsPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface ListingRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  budget: number | null;
  location: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  listing_categories: { categories: { name_en: string; name_km: string } | null }[];
}

function ListingsPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading: loading } = useQuery({
    queryKey: ["listings:index", user?.id ?? null],
    staleTime: 30_000,
    queryFn: async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabase
        .from("listings")
        .select(
          "id, user_id, title, description, budget, location, created_at, profiles(full_name, avatar_url), listing_categories(categories(name_en, name_km))"
        )
        .eq("status", "active")
        .gte("created_at", sixtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(20);
      let applied: string[] = [];
      if (user) {
        const { data: apps } = await supabase
          .from("applications")
          .select("listing_id")
          .eq("applicant_id", user.id);
        applied = (apps ?? []).map((r) => r.listing_id);
      }
      return {
        listings: ((rows as ListingRow[] | null) ?? []),
        appliedIds: applied,
      };
    },
  });

  const listings: ListingRow[] = data?.listings ?? [];
  const appliedIds = new Set<string>(data?.appliedIds ?? []);

  useEffect(() => {
    if (!user) return;
    const inv = () => qc.invalidateQueries({ queryKey: ["listings:index", user.id] });
    const ch = supabase
      .channel(`listings-index:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `applicant_id=eq.${user.id}` }, inv)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  async function apply(listingId: string) {
    if (!user) return;
    const { error } = await supabase
      .from("applications")
      .insert({ listing_id: listingId, applicant_id: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["listings:index", user.id] });
    toast.success(lang === "km" ? "បានដាក់ពាក្យ" : "Applied!");
  }


  return (
    <div className="px-3 pt-3">
      <Link
        to="/listings/new"
        className="mb-3 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99]"
      >
        {t("new_listing")}
      </Link>

      {loading && <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>}
      {!loading && listings.length === 0 && (
        <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
          {lang === "km" ? "មិនទាន់មានការងារ" : "No projects yet"}
        </div>
      )}

      <div className="space-y-3">
        {listings.map((l) => {
          const applied = appliedIds.has(l.id);
          const isOwn = user?.id === l.user_id;
          return (
            <Link
              key={l.id}
              to="/listings/$listingId"
              params={{ listingId: l.id }}
              className="block rounded-xl bg-surface p-3 shadow-card active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <Avatar name={l.profiles?.full_name} url={l.profiles?.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {l.profiles?.full_name ?? "User"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {timeAgo(l.created_at, t)}
                    {l.location ? ` · ${l.location}` : ""}
                  </div>
                </div>
              </div>
              <h3 className="mt-2 text-base font-semibold text-foreground">{l.title}</h3>
              {l.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {l.listing_categories.slice(0, 3).map((lc, i) =>
                  lc.categories ? (
                    <span
                      key={i}
                      className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {lang === "km" ? lc.categories.name_km : lc.categories.name_en}
                    </span>
                  ) : null
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  {l.location && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-destructive" /> {l.location}
                    </span>
                  )}
                  <span className="font-semibold text-success">
                    {l.budget ? `$ ${l.budget}` : t("to_discuss")}
                  </span>
                </div>
                {!isOwn && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (!applied) void apply(l.id);
                    }}
                    disabled={applied}
                    className={`rounded-pill px-4 py-1.5 text-xs font-semibold ${
                      applied
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground active:scale-95"
                    }`}
                  >
                    {applied ? t("applied") : t("apply")}
                  </button>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
