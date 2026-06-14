import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Truck, HardHat, Wrench, Hammer } from "lucide-react";
import { ProvinceSelect } from "@/components/ProvinceSelect";
import { toast } from "sonner";



export const Route = createFileRoute("/rentals/request/new")({
  component: () => (
    <RequireAuth>
      <NewRentalRequestPage />
    </RequireAuth>
  ),
});

type Cat = "vehicles" | "heavy" | "light" | "tools";

const CATS: { id: Cat; icon: typeof Truck; titleKey: "cat_vehicles" | "cat_heavy" | "cat_light_machinery" | "cat_tools"; descKey: "cat_vehicles_desc" | "cat_heavy_desc" | "cat_light_desc" | "cat_tools_desc" }[] = [
  { id: "vehicles", icon: Truck, titleKey: "cat_vehicles", descKey: "cat_vehicles_desc" },
  { id: "heavy", icon: HardHat, titleKey: "cat_heavy", descKey: "cat_heavy_desc" },
  { id: "light", icon: Wrench, titleKey: "cat_light_machinery", descKey: "cat_light_desc" },
  { id: "tools", icon: Hammer, titleKey: "cat_tools", descKey: "cat_tools_desc" },
];

function NewRentalRequestPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Cat | null>(null);
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const [neededFrom, setNeededFrom] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) return;
    if (!title.trim() || !category || !location.trim()) {
      toast.error(t("fill_required_fields"));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("rental_requests").insert({
        user_id: user.id,
        title: title.trim().slice(0, 120),
        description: description.trim().slice(0, 1000) || null,
        category,
        location: location.trim().slice(0, 120),
        budget_per_day: budget ? Number(budget) : null,
        currency,
        needed_from: neededFrom || null,
      });
      if (error) throw error;
      toast.success(t("rental_request_posted"));
      nav({ to: "/suppliers" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-[#534AB7] px-2 text-white">
        <Link to="/profile" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("rental_request_title")}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-24">
        <Card>
          <Label>{t("details")}</Label>
          <div>
            <p className="mb-1 text-sm font-medium">{t("rental_request_question")} <span className="text-destructive">*</span></p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={t("rental_request_title_ph")}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[#534AB7]"
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{t("description")} <span className="text-xs font-normal text-text-hint">{t("optional")}</span></p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              placeholder={t("rental_request_desc_ph")}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-[#534AB7]"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("category_label")} <span className="text-destructive">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              {CATS.map((c) => {
                const sel = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      sel
                        ? "border-[1.5px] border-[#534AB7] bg-[#EEEDFE]"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{t(c.titleKey)}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{t(c.descKey)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <Label>{t("rental_request_budget_timing")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-sm font-medium">{t("rental_request_max_day")} <span className="text-xs font-normal text-text-hint">{t("optional")}</span></p>
              <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-[#534AB7]">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value === "KHR" ? "KHR" : "USD")}
                  aria-label={t("currency")}
                  className="h-full border-r border-border bg-muted px-2 text-xs font-semibold text-foreground outline-none"
                >
                  <option value="USD">$ USD</option>
                  <option value="KHR">៛ KHR</option>
                </select>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-full flex-1 bg-transparent px-2 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">{t("rental_request_needed_from")} <span className="text-xs font-normal text-text-hint">{t("optional")}</span></p>
              <input
                type="date"
                value={neededFrom}
                onChange={(e) => setNeededFrom(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[#534AB7]"
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{t("location")} <span className="text-destructive">*</span></p>
            <ProvinceSelect value={location} onChange={setLocation} accentClass="focus-within:border-[#534AB7]" />

          </div>
        </Card>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <button
          onClick={submit}
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#534AB7] text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("rental_request_post")}
        </button>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 rounded-xl bg-surface p-3 shadow-card">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-bold text-foreground">{children}</div>;
}
