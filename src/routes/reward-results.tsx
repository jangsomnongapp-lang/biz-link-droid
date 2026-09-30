import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reward-results")({
  head: () => ({
    meta: [
      { title: "Draw results — BuildHub" },
      { name: "description", content: "Winners and winning ticket numbers from the last 7 days." },
      { property: "og:title", content: "Draw results — BuildHub" },
      { property: "og:description", content: "Winners and winning ticket numbers from the last 7 days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ResultsPage />
    </RequireAuth>
  ),
});

const TYPE_LABEL: Record<string, { km: string; en: string }> = {
  daily: { km: "ប្រចាំថ្ងៃ", en: "Daily" },
  weekly: { km: "ប្រចាំសប្តាហ៍", en: "Weekly" },
  monthly: { km: "ប្រចាំខែ", en: "Monthly" },
};

function ResultsPage() {
  const { lang } = useI18n();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["draw-results-week"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recent_draw_results");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-white p-4 text-zinc-900">
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav({ to: "/rewards" })}
          aria-label={lang === "km" ? "ត្រឡប់" : "Back"}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="text-base font-bold">{lang === "km" ? "លទ្ធផល" : "Result"}</div>
          <div className="text-[11px] text-zinc-500">{lang === "km" ? "អ្នកឈ្នះ ៧ ថ្ងៃចុងក្រោយ" : "Winners in the last 7 days"}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <div className="py-8 text-center text-sm text-zinc-500">…</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            {lang === "km" ? "មិនទាន់មានអ្នកឈ្នះទេ" : "No winners yet"}
          </div>
        )}
        {data?.map((r) => (
          <div key={r.draw_id} className="flex items-center gap-3 rounded-xl bg-yellow-50 p-3 ring-1 ring-orange-200">
            <Trophy className="h-5 w-5 shrink-0 text-orange-500" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{r.winner_name ?? (lang === "km" ? "អ្នកឈ្នះ" : "Winner")}</div>
              <div className="text-[11px] text-zinc-600">
                {(TYPE_LABEL[r.draw_type]?.[lang === "km" ? "km" : "en"] ?? r.draw_type)} · {r.draw_date}
              </div>
            </div>
            <div className="font-mono text-lg font-black text-orange-600">#{r.ticket_number ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
