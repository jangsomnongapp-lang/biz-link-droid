import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { OwnerMenu } from "@/components/OwnerMenu";
import { EditTextDialog } from "@/components/EditTextDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { MapPin, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { ListingListSkeleton } from "@/components/SkeletonFeed";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { CAMBODIA_PROVINCES } from "@/components/ProvinceSelect";
import { formatPrice } from "@/lib/price";

export const Route = createFileRoute("/listings/")({
  head: () => ({
    meta: [
      { title: "Construction Projects & Jobs in Cambodia — BuildHub" },
      { name: "description", content: "Browse active construction project listings across Cambodia. Filter by location, category, and budget to find work that fits." },
      { property: "og:title", content: "Construction Projects & Jobs in Cambodia — BuildHub" },
      { property: "og:description", content: "Browse active construction project listings across Cambodia. Filter by location, category, and budget." },
      { property: "og:url", content: "https://buildhubkh.com/listings" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/listings" }],
  }),
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
  currency: string;
  location: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  listing_categories: { categories: { id: string; name_en: string; name_km: string } | null }[];
}

interface CategoryRow {
  id: string;
  name_en: string;
  name_km: string;
}

interface Filters {
  location: string;
  categoryId: string;
  minPrice: string;
  maxPrice: string;
}

const EMPTY_FILTERS: Filters = { location: "", categoryId: "", minPrice: "", maxPrice: "" };

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
          "id, user_id, title, description, budget, currency, location, created_at, profiles(full_name, avatar_url), listing_categories(categories(id, name_en, name_km))"
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

  const { data: categories = [] } = useQuery<CategoryRow[]>({
    queryKey: ["listings:categories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name_en, name_km")
        .eq("is_active", true)
        .order("sort_order");
      return (data as CategoryRow[] | null) ?? [];
    },
  });

  const listings: ListingRow[] = data?.listings ?? [];
  const appliedIds = new Set<string>(data?.appliedIds ?? []);
  const [editTarget, setEditTarget] = useState<ListingRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListingRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);

  const activeCount =
    (filters.location ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0);

  const filtered = useMemo(() => {
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    return listings.filter((l) => {
      if (filters.location && l.location !== filters.location) return false;
      if (filters.categoryId) {
        const has = l.listing_categories.some((c) => c.categories?.id === filters.categoryId);
        if (!has) return false;
      }
      if (min != null && (l.budget == null || l.budget < min)) return false;
      if (max != null && (l.budget == null || l.budget > max)) return false;
      return true;
    });
  }, [listings, filters]);

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

  async function saveEdit(values: Record<string, string>) {
    if (!editTarget) return;
    const title = (values.title ?? "").trim();
    const description = (values.description ?? "").trim() || null;
    const location = (values.location ?? "").trim() || null;
    const budgetRaw = (values.budget ?? "").trim();
    const budget = budgetRaw ? Number(budgetRaw) : null;
    if (!title) return;
    const { error } = await supabase
      .from("listings")
      .update({ title, description, location, budget })
      .eq("id", editTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditTarget(null);
    if (user) qc.invalidateQueries({ queryKey: ["listings:index", user.id] });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("listings").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(t("delete_failed"));
      return;
    }
    toast.success(t("deleted"));
    setDeleteTarget(null);
    if (user) qc.invalidateQueries({ queryKey: ["listings:index", user.id] });
  }

  function openFilter() {
    setDraft(filters);
    setFilterOpen(true);
  }
  function applyFilter() {
    setFilters(draft);
    setFilterOpen(false);
  }
  function clearFilter() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setFilterOpen(false);
  }

  const km = lang === "km";
  const locationLabel = km ? "ទីតាំង" : "Location";
  const priceLabel = km ? "តម្លៃ (USD)" : "Price (USD)";
  const categoryLabel = km ? "ប្រភេទ" : "Category";
  const filterTitle = km ? "តម្រង" : "Filters";
  const applyLabel = km ? "អនុវត្ត" : "Apply";
  const clearLabel = km ? "សម្អាត" : "Clear";
  const allLabel = km ? "ទាំងអស់" : "All";

  return (
    <div className="px-3 pt-3">
      <h1 className="sr-only">Construction Project Marketplace in Cambodia</h1>
      <div className="mb-3 flex items-center gap-2">
        <Link
          to="/listings/new"
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99]"
        >
          {t("new_listing")}
        </Link>
        <button
          onClick={openFilter}
          aria-label={filterTitle}
          className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-foreground shadow-card active:scale-[0.97]"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {activeCount > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {filters.location && (
            <FilterChip
              label={filters.location}
              onClear={() => setFilters({ ...filters, location: "" })}
            />
          )}
          {filters.categoryId && (
            <FilterChip
              label={
                (() => {
                  const c = categories.find((c) => c.id === filters.categoryId);
                  return c ? (km ? c.name_km : c.name_en) : categoryLabel;
                })()
              }
              onClear={() => setFilters({ ...filters, categoryId: "" })}
            />
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <FilterChip
              label={`$${filters.minPrice || "0"} - $${filters.maxPrice || "∞"}`}
              onClear={() => setFilters({ ...filters, minPrice: "", maxPrice: "" })}
            />
          )}
        </div>
      )}

      {loading && <div className="mt-3"><ListingListSkeleton count={3} /></div>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
          {activeCount > 0
            ? km ? "មិនមានលទ្ធផលដែលត្រូវនឹងតម្រង" : "No projects match your filters"
            : km ? "មិនទាន់មានការងារ" : "No projects yet"}
        </div>
      )}

      <h2 className="sr-only">{km ? "គម្រោងសកម្ម" : "Active Projects"}</h2>
      <div className="space-y-3">
        {filtered.map((l) => {
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
                {isOwn && (
                  <div onClick={(e) => e.preventDefault()}>
                    <OwnerMenu
                      onEdit={() => setEditTarget(l)}
                      onDelete={() => setDeleteTarget(l)}
                    />
                  </div>
                )}
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
                    {l.budget ? formatPrice(l.budget, l.currency) : t("to_discuss")}
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

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold">{filterTitle}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 p-4">
            <section>
              <h4 className="mb-2 text-sm font-semibold text-foreground">{locationLabel}</h4>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={!draft.location}
                  onClick={() => setDraft({ ...draft, location: "" })}
                  label={allLabel}
                />
                {CAMBODIA_PROVINCES.map((p) => (
                  <Chip
                    key={p.en}
                    active={draft.location === p.en}
                    onClick={() => setDraft({ ...draft, location: p.en })}
                    label={km ? p.km : p.en}
                  />
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold text-foreground">{priceLabel}</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={draft.minPrice}
                  onChange={(e) => setDraft({ ...draft, minPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                  inputMode="decimal"
                  placeholder={km ? "អប្បបរមា" : "Min"}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
                <input
                  value={draft.maxPrice}
                  onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                  inputMode="decimal"
                  placeholder={km ? "អតិបរមា" : "Max"}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { min: "", max: "100", label: "< $100" },
                  { min: "100", max: "500", label: "$100–500" },
                  { min: "500", max: "1000", label: "$500–1k" },
                  { min: "1000", max: "", label: "$1k+" },
                ].map((p) => (
                  <Chip
                    key={p.label}
                    active={draft.minPrice === p.min && draft.maxPrice === p.max}
                    onClick={() => setDraft({ ...draft, minPrice: p.min, maxPrice: p.max })}
                    label={p.label}
                  />
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold text-foreground">{categoryLabel}</h4>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={!draft.categoryId}
                  onClick={() => setDraft({ ...draft, categoryId: "" })}
                  label={allLabel}
                />
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    active={draft.categoryId === c.id}
                    onClick={() => setDraft({ ...draft, categoryId: c.id })}
                    label={km ? c.name_km : c.name_en}
                  />
                ))}
              </div>
            </section>
          </div>

          <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-border bg-surface p-3">
            <button
              onClick={clearFilter}
              className="h-11 flex-1 rounded-xl border border-border bg-background text-sm font-semibold text-foreground active:scale-[0.99]"
            >
              {clearLabel}
            </button>
            <button
              onClick={applyFilter}
              className="h-11 flex-[2] rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99]"
            >
              {applyLabel}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <EditTextDialog
        open={!!editTarget}
        title={t("edit") + " · " + t("project_detail")}
        fields={[
          { key: "title", label: t("title") ?? "Title", initial: editTarget?.title ?? "", required: true },
          { key: "description", label: t("description") ?? "Description", initial: editTarget?.description ?? "", type: "textarea" },
          { key: "location", label: t("location"), initial: editTarget?.location ?? "" },
          { key: "budget", label: t("budget"), initial: editTarget?.budget != null ? String(editTarget.budget) : "", type: "number" },
        ]}
        onCancel={() => setEditTarget(null)}
        onSave={saveEdit}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        description={t("confirm_delete") ?? undefined}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill border px-3.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {label}
      <button
        onClick={onClear}
        aria-label="Remove filter"
        className="rounded-full p-0.5 text-primary active:bg-primary/20"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
