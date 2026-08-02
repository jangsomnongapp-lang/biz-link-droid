import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { ArrowLeft, Flag, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  component: () => (
    <RequireAdmin>
      <AdminReportsPage />
    </RequireAdmin>
  ),
});

interface ReportRow {
  id: string;
  reporter_id: string;
  target_kind: "post" | "listing" | "profile";
  target_id: string;
  reason: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
}

type View = "open" | "resolved" | "dismissed" | "stock";

interface StockReportRow {
  id: string;
  reason: string;
  note: string | null;
  created_at: string;
  supplier_catalog_items: { name_en: string } | null;
  supplier_stores: { name: string } | null;
}

function AdminReportsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [view, setView] = useState<View>("open");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [stockRows, setStockRows] = useState<StockReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void supabase
      .rpc("get_my_profile_flags")
      .then(({ data }) => {
        const ok = !!data?.[0]?.is_admin;
        setIsAdmin(ok);
        if (!ok) {
          toast.error("Admin only");
          nav({ to: "/home" });
        }
      });
  }, [user, nav]);

  useEffect(() => {
    if (!isAdmin || view !== "stock") return;
    setLoading(true);
    void supabase
      .from("catalog_stock_reports")
      .select("id, reason, note, created_at, supplier_catalog_items(name_en), supplier_stores(name)")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setStockRows((data ?? []) as unknown as StockReportRow[]);
        setLoading(false);
      });
  }, [isAdmin, view]);

  useEffect(() => {
    if (!isAdmin || view === "stock") return;
    setLoading(true);
    void supabase
      .from("reports")
      .select("id, reporter_id, target_kind, target_id, reason, status, created_at")
      .eq("status", view)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as ReportRow[]);
        setLoading(false);
      });
  }, [isAdmin, view]);

  async function setStatus(id: string, status: "resolved" | "dismissed") {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((p) => p.filter((r) => r.id !== id));
    toast.success(status === "resolved" ? t("resolved") : t("dismissed"));
  }

  function targetLabel(kind: ReportRow["target_kind"]) {
    if (kind === "post") return t("reported_post");
    if (kind === "listing") return t("reported_listing");
    return t("reported_profile");
  }

  function targetLink(r: ReportRow): { to: string; params?: Record<string, string> } {
    if (r.target_kind === "listing") return { to: "/listings/$listingId", params: { listingId: r.target_id } };
    if (r.target_kind === "profile") return { to: "/users/$userId", params: { userId: r.target_id } };
    return { to: "/home", params: undefined };
  }

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-6">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/settings" className="rounded-full p-2 active:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {t("admin")} — {t("review_reports")}
        </h1>
        <span className="rounded-pill bg-destructive px-2.5 py-0.5 text-[11px] font-bold">{rows.length}</span>
      </header>

      <div className="flex gap-2 px-3 pt-3">
        {(["open", "resolved", "dismissed", "stock"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-pill py-2 text-xs font-semibold transition-colors ${
              view === v
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground border border-border"
            }`}
          >
            {v === "open"
              ? t("open_status")
              : v === "resolved"
                ? t("resolved")
                : v === "dismissed"
                  ? t("dismissed")
                  : "Stock"}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 px-3 pt-3">
        {view === "stock" && !loading && (
          <>
            <p className="px-1 text-[11px] text-muted-foreground">
              Client stock reports — internal only, suppliers never see these.
            </p>
            {stockRows.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t("no_reports")}
              </div>
            )}
            {stockRows.map((r) => (
              <article key={r.id} className="rounded-xl bg-surface p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {r.supplier_catalog_items?.name_en ?? "Product"}
                  </p>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(r.created_at, t)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{r.supplier_stores?.name ?? ""}</p>
                <p className="mt-1 text-xs font-semibold text-destructive">{r.reason}</p>
                {r.note && <p className="mt-1 text-sm text-foreground">{r.note}</p>}
              </article>
            ))}
          </>
        )}
        {loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>
        )}
        {!loading && view !== "stock" && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("no_reports")}
          </div>
        )}
        {view !== "stock" && rows.map((r) => {
          const link = targetLink(r);
          return (
            <article key={r.id} className="rounded-xl bg-surface p-3 shadow-card">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Flag className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">{targetLabel(r.target_kind)}</div>
                    <div className="text-[11px] text-muted-foreground">{timeAgo(r.created_at, t)}</div>
                  </div>
                  {r.reason && (
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{r.reason}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      to={link.to}
                      params={link.params as never}
                      className="rounded-pill border border-border px-3 py-1 text-xs font-semibold text-foreground active:bg-muted"
                    >
                      {t("view")}
                    </Link>
                    {view === "open" && (
                      <>
                        <button
                          onClick={() => void setStatus(r.id, "resolved")}
                          className="flex items-center gap-1 rounded-pill bg-success px-3 py-1 text-xs font-semibold text-white active:scale-[0.98]"
                        >
                          <Check className="h-3 w-3" />
                          {t("resolve")}
                        </button>
                        <button
                          onClick={() => void setStatus(r.id, "dismissed")}
                          className="flex items-center gap-1 rounded-pill bg-muted px-3 py-1 text-xs font-semibold text-foreground active:scale-[0.98]"
                        >
                          <X className="h-3 w-3" />
                          {t("dismiss")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
