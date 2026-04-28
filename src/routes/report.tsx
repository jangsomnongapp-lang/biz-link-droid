import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Flag } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a problem" },
      { name: "description", content: "Report a problem to our team." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ReportPage />
    </RequireAuth>
  ),
});

const CATEGORIES = [
  { value: "bug", labelKey: "report_cat_bug" as const },
  { value: "account", labelKey: "report_cat_account" as const },
  { value: "payment", labelKey: "report_cat_payment" as const },
  { value: "abuse", labelKey: "report_cat_abuse" as const },
  { value: "other", labelKey: "report_cat_other" as const },
];

function ReportPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>("bug");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) return;
    if (!details.trim()) {
      toast.error(t("report_details_ph"));
      return;
    }
    setSubmitting(true);
    const reason = `[${category}] ${details.trim()}`;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_kind: "profile",
      target_id: user.id,
      reason,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("report_sent"));
    setDetails("");
    navigate({ to: "/settings" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-10">
      <header className="bg-primary px-3 pb-4 pt-3 text-primary-foreground">
        <div className="flex h-10 items-center">
          <button
            onClick={() => navigate({ to: "/settings" })}
            className="rounded-full p-2 active:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">
            {t("report_problem_title")}
          </h1>
          <span className="w-9" />
        </div>
      </header>

      <main className="px-4 py-4">
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-surface p-3 shadow-card">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100">
            <Flag className="h-4 w-4 text-rose-600" />
          </div>
          <p className="flex-1 text-xs text-muted-foreground">
            {t("report_problem_desc")}
          </p>
        </div>

        <section className="mb-4">
          <h2 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">
            {t("report_category")}
          </h2>
          <div className="overflow-hidden rounded-xl bg-surface shadow-card">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm active:bg-muted ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="font-medium text-foreground">{t(c.labelKey)}</span>
                <span
                  className={`h-4 w-4 rounded-full border-2 ${
                    category === c.value
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  }`}
                />
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <h2 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">
            {t("report_details")}
          </h2>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={6}
            placeholder={t("report_details_ph")}
            className="w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
          />
        </section>

        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("submit")}
        </button>
      </main>
    </div>
  );
}
