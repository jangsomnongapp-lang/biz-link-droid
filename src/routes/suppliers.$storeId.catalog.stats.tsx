import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Flame, Lightbulb, AlertTriangle, BarChart3 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { catalogCopy } from "@/lib/catalog-copy";

export const Route = createFileRoute("/suppliers/$storeId/catalog/stats")({
  head: () => ({
    meta: [
      { title: "My Stats — Supplier Panel | BuildHub" },
      {
        name: "description",
        content:
          "Private supplier statistics: profile views, material requests, chats, response rate and local market demand for your BuildHub store.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "My Stats — Supplier Panel | BuildHub" },
      {
        property: "og:description",
        content: "Track demand, requests and market gaps for your BuildHub catalogue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <CatalogStatsPage />
    </RequireAuth>
  ),
});

interface Stats {
  days: number;
  views: number;
  prev_views: number;
  requests: number;
  prev_requests: number;
  chats: number;
  prev_chats: number;
  response_rate: number | null;
  daily: Array<{ day: string; count: number }>;
  top_products: Array<{ id: string; name_en: string; name_km: string | null; count: number }>;
  search_gaps: Array<{ term: string; count: number }>;
  opportunity: { term: string; count: number } | null;
  attention: { name_en: string; name_km: string | null; count: number } | null;
}

const PERIODS = [
  { key: "7d", days: 7 },
  { key: "month", days: 30 },
  { key: "3m", days: 90 },
] as const;

function CatalogStatsPage() {
  const { storeId } = Route.useParams();
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = (key: Parameters<typeof catalogCopy>[1]) => catalogCopy(lang, key);

  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("month");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const days = PERIODS.find((p) => p.key === period)?.days ?? 30;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data: store } = await supabase
        .from("supplier_stores")
        .select("user_id")
        .eq("id", storeId)
        .maybeSingle();
      if (cancelled) return;
      if (store && user && store.user_id !== user.id) {
        nav({ to: "/suppliers/$storeId", params: { storeId } });
        return;
      }
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const res = await rpc("catalog_stats", { _store_id: storeId, _days: days });
      if (cancelled) return;
      setStats((res.data as Stats | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, user, nav, days]);

  const pct = (curr: number, prev: number) => {
    if (!prev) return curr > 0 ? "+100%" : "0%";
    const v = Math.round(((curr - prev) / prev) * 100);
    return `${v > 0 ? "+" : ""}${v}%`;
  };
  const abs = (curr: number, prev: number) => {
    const v = curr - prev;
    return `${v > 0 ? "+" : ""}${v}`;
  };
  const tone = (curr: number, prev: number) =>
    curr > prev ? "text-emerald-400" : curr < prev ? "text-rose-400" : "text-white/50";

  const maxDaily = Math.max(1, ...(stats?.daily ?? []).map((d) => d.count));
  const maxTop = Math.max(1, ...(stats?.top_products ?? []).map((d) => d.count));
  const maxGap = Math.max(1, ...(stats?.search_gaps ?? []).map((d) => d.count));
  const productName = (p: { name_en: string; name_km: string | null }) =>
    lang === "km" && p.name_km ? p.name_km : p.name_en;

  return (
    <div className="min-h-screen bg-[#0f1420] pb-28 text-white">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-[#0f1420]/95 px-3 py-3 backdrop-blur">
        <Link
          to="/suppliers/$storeId/catalog/manage"
          params={{ storeId }}
          className="rounded-full p-1.5 active:bg-white/10"
          aria-label={c("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex items-center gap-1.5 text-[15px] font-semibold">
          <BarChart3 className="h-4 w-4 text-primary" /> {c("my_stats")}
        </h1>
      </header>

      <div className="space-y-3 p-3">
        {/* Period selector */}
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
                period === p.key ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70"
              }`}
            >
              {c(p.key === "7d" ? "period_7d" : p.key === "month" ? "period_month" : "period_3m")}
            </button>
          ))}
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-2 gap-2.5">
          <Card
            label={c("profile_views")}
            value={loading ? "—" : String(stats?.views ?? 0)}
            hint={c("vs_last_period").replace(
              "{v}",
              pct(stats?.views ?? 0, stats?.prev_views ?? 0),
            )}
            hintClass={tone(stats?.views ?? 0, stats?.prev_views ?? 0)}
          />
          <Card
            label={c("material_requests")}
            value={loading ? "—" : String(stats?.requests ?? 0)}
            hint={c("vs_last_period").replace(
              "{v}",
              abs(stats?.requests ?? 0, stats?.prev_requests ?? 0),
            )}
            hintClass={tone(stats?.requests ?? 0, stats?.prev_requests ?? 0)}
          />
          <Card
            label={c("chats_started")}
            value={loading ? "—" : String(stats?.chats ?? 0)}
            hint={c("from_requests").replace("{n}", String(stats?.requests ?? 0))}
          />
          <Card
            label={c("response_rate")}
            value={loading || stats?.response_rate == null ? "—" : `${stats.response_rate}%`}
            hint={
              stats?.response_rate == null
                ? c("no_stats_yet")
                : stats.response_rate >= 80
                  ? c("above_average")
                  : c("below_average")
            }
            hintClass={
              stats?.response_rate != null && stats.response_rate >= 80
                ? "text-emerald-400"
                : "text-amber-400"
            }
          />
        </div>

        {/* Daily requests chart */}
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="text-[13px] font-bold">{c("requests_per_day")}</h2>
          {stats?.daily?.length ? (
            <div className="mt-3 flex h-28 items-end gap-[3px] overflow-x-auto">
              {stats.daily.map((d, i) => {
                const isToday = i === stats.daily.length - 1;
                return (
                  <div key={d.day} className="flex min-w-[8px] flex-1 flex-col items-center gap-1">
                    <span
                      className={`w-full rounded-t ${isToday ? "bg-primary" : "bg-white/20"}`}
                      style={{ height: `${Math.max(4, (d.count / maxDaily) * 92)}px` }}
                      title={`${d.day}: ${d.count}`}
                    />
                    <span className="text-[8px] text-white/40">
                      {isToday ? c("today_label") : new Date(d.day).getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-white/50">{c("no_stats_yet")}</p>
          )}
        </section>

        {/* Most requested products */}
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold">
            <Flame className="h-4 w-4 text-orange-400" /> {c("most_requested_products")}
          </h2>
          {stats?.top_products?.length ? (
            <ul className="mt-2.5 space-y-2">
              {stats.top_products.map((p) => (
                <Row key={p.id} label={productName(p)} count={p.count} max={maxTop} barClass="bg-primary" />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-white/50">{c("no_stats_yet")}</p>
          )}
        </section>

        {/* Search gaps */}
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="text-[13px] font-bold">🔎 {c("search_gaps")}</h2>
          {stats?.search_gaps?.length ? (
            <ul className="mt-2.5 space-y-2">
              {stats.search_gaps.map((g) => (
                <Row
                  key={g.term}
                  label={g.term}
                  count={g.count}
                  max={maxGap}
                  barClass="bg-orange-400"
                />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-white/50">{c("no_stats_yet")}</p>
          )}
        </section>

        {/* Insight cards — max 2 */}
        {stats?.opportunity && (
          <div className="flex gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <div>
              <p className="text-[12px] font-bold text-sky-200">{c("opportunity")}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-sky-100/85">
                {c("opportunity_text")
                  .replace("{term}", stats.opportunity.term)
                  .replace("{n}", String(stats.opportunity.count))}
              </p>
            </div>
          </div>
        )}
        {stats?.attention && (
          <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-[12px] font-bold text-amber-200">{c("attention")}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-amber-100/85">
                {c("attention_text")
                  .replace("{name}", productName(stats.attention))
                  .replace("{n}", String(stats.attention.count))}
              </p>
            </div>
          </div>
        )}

        <p className="pt-1 text-center text-[10px] text-white/35">{c("internal_panel_note")}</p>
      </div>
    </div>
  );
}

function Row({
  label,
  count,
  max,
  barClass,
}: {
  label: string;
  count: number;
  max: number;
  barClass: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-[42%] truncate text-[11px] capitalize text-white/80">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <span
          className={`block h-full rounded-full ${barClass}`}
          style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
        />
      </span>
      <span className="w-6 text-right text-[11px] font-bold text-white/70">{count}</span>
    </li>
  );
}

function Card({
  label,
  value,
  hint,
  hintClass = "text-white/50",
}: {
  label: string;
  value: string;
  hint: string;
  hintClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className={`mt-1 text-[10px] ${hintClass}`}>{hint}</p>
    </div>
  );
}
