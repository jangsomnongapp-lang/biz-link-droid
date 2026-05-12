import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";
import { ArrowLeft, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/find-material/mine")({
  component: () => (
    <RequireAuth>
      <MyMaterialSearchesPage />
    </RequireAuth>
  ),
});

interface RequestRow {
  id: string;
  category: string;
  quantity: number;
  note: string | null;
  status: string;
  created_at: string;
  responses: { supplier_id: string; profile: { full_name: string | null; avatar_url: string | null } | null }[];
}

const CAT_LABEL: Record<string, { en: string; km: string; emoji: string }> = {
  electrical: { en: "Electrical", km: "អគ្គិសនី", emoji: "⚡" },
  cement: { en: "Cement", km: "ស៊ីម៉ងត៍", emoji: "🧱" },
  steel: { en: "Steel", km: "ដែក", emoji: "🔩" },
  zinc: { en: "Zinc", km: "ស័ង្កសី", emoji: "🏠" },
  tools: { en: "Tools", km: "ឧបករណ៍", emoji: "🛠️" },
  timber: { en: "Timber", km: "ឈើ", emoji: "🪵" },
  sanitary: { en: "Sanitary", km: "បង្គន់", emoji: "🚿" },
  paint: { en: "Paint", km: "ថ្នាំលាប", emoji: "🎨" },
  other: { en: "Other", km: "ផ្សេងៗ", emoji: "📦" },
};

function MyMaterialSearchesPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: reqs } = await supabase
      .from("material_requests")
      .select("id, category, quantity, note, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const list = (reqs ?? []) as Omit<RequestRow, "responses">[];
    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = list.map((r) => r.id);
    const { data: resps } = await supabase
      .from("material_request_responses")
      .select("request_id, supplier_id")
      .in("request_id", ids)
      .eq("response", "available");
    const supplierIds = Array.from(new Set((resps ?? []).map((r) => r.supplier_id)));
    const { data: profs } = supplierIds.length
      ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", supplierIds)
      : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const grouped: Record<string, RequestRow["responses"]> = {};
    for (const r of resps ?? []) {
      (grouped[r.request_id] ||= []).push({
        supplier_id: r.supplier_id,
        profile: profMap.get(r.supplier_id) ?? null,
      });
    }
    setRows(list.map((r) => ({ ...r, responses: grouped[r.id] ?? [] })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user]);

  async function cancel(id: string) {
    if (busy) return;
    setBusy(id);
    const { error } = await supabase
      .from("material_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.filter((r) => r.id !== id));
    toast.success(lang === "km" ? "បានបោះបង់" : "Closed");
  }

  async function openChat(reqId: string, supplierId: string) {
    const { data, error } = await supabase.rpc("start_material_chat", {
      _request_id: reqId,
      _supplier_id: supplierId,
    });
    if (error || !data) { toast.error(error?.message ?? "Error"); return; }
    nav({ to: "/messages/$threadId", params: { threadId: data as string } });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-10">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <Link to="/find-material" className="rounded-full p-2 active:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "ការស្វែងរករបស់ខ្ញុំ" : "My searches"}
        </h1>
        <span className="w-9" />
      </header>

      <div className="px-3 py-2 text-center text-xs text-muted-foreground">
        {lang === "km" ? `${rows.length} នៃ ១០ សកម្ម` : `${rows.length} of 10 active`}
      </div>

      {loading && <div className="p-8 text-center text-sm text-muted-foreground">{t("loading")}</div>}

      {!loading && rows.length === 0 && (
        <div className="m-4 rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
          {lang === "km" ? "មិនទាន់មានការស្វែងរក" : "No active searches"}
        </div>
      )}

      <div className="flex flex-col gap-2 px-3">
        {rows.map((r) => {
          const cat = CAT_LABEL[r.category] ?? CAT_LABEL.other;
          const replies = r.responses.length;
          return (
            <div key={r.id} className="rounded-2xl bg-surface p-3 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-sm font-bold text-foreground">{lang === "km" ? cat.km : cat.en}</span>
                  {replies > 0 ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                      {lang === "km" ? `${replies} ឆ្លើយតប` : `${replies} ${replies === 1 ? "reply" : "replies"}`}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {lang === "km" ? "កំពុងរង់ចាំ" : "waiting"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at, t)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {r.quantity} {lang === "km" ? "ឯកតា" : "units"}{r.note ? ` · ${r.note}` : ""}
              </div>

              {replies > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {r.responses.map((resp) => (
                    <button
                      key={resp.supplier_id}
                      onClick={() => void openChat(r.id, resp.supplier_id)}
                      className="flex items-center gap-2 rounded-xl bg-success/10 px-2 py-2 text-left active:bg-success/20"
                    >
                      <Avatar name={resp.profile?.full_name} url={resp.profile?.avatar_url} size={32} />
                      <div className="flex-1 text-sm font-semibold text-foreground">
                        {resp.profile?.full_name ?? "Supplier"}
                      </div>
                      <MessageCircle className="h-4 w-4 text-success" />
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => void cancel(r.id)}
                disabled={busy === r.id}
                className="mt-2 w-full rounded-xl bg-[#a13a3a] py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {lang === "km" ? "បានរក · បោះបង់" : "Found it · Cancel"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
