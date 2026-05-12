import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { SignedImage } from "@/components/SignedImage";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";
import { ArrowLeft, Settings as SettingsIcon, Inbox } from "lucide-react";

export const Route = createFileRoute("/online-orders")({
  component: () => (
    <RequireAuth>
      <OnlineOrdersPage />
    </RequireAuth>
  ),
});

const CATS = [
  { id: "electrical", en: "Electrical", km: "អគ្គិសនី", emoji: "⚡" },
  { id: "cement", en: "Cement", km: "ស៊ីម៉ងត៍", emoji: "🧱" },
  { id: "steel", en: "Steel", km: "ដែក", emoji: "🔩" },
  { id: "zinc", en: "Zinc", km: "ស័ង្កសី", emoji: "🏠" },
  { id: "tools", en: "Tools", km: "ឧបករណ៍", emoji: "🛠️" },
  { id: "timber", en: "Timber", km: "ឈើ", emoji: "🪵" },
  { id: "sanitary", en: "Sanitary", km: "បង្គន់", emoji: "🚿" },
  { id: "paint", en: "Paint", km: "ថ្នាំលាប", emoji: "🎨" },
  { id: "other", en: "Other", km: "ផ្សេងៗ", emoji: "📦" },
] as const;

interface RequestRow {
  id: string;
  user_id: string;
  category: string;
  quantity: number;
  note: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  location_filter: string;
  profile: { full_name: string | null; avatar_url: string | null } | null;
  photos: string[];
}

function OnlineOrdersPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"requests" | "settings">("requests");
  const [minQuantity, setMinQuantity] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [responded, setResponded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: settings } = await supabase
      .from("supplier_settings")
      .select("min_quantity, categories")
      .eq("supplier_id", user.id)
      .maybeSingle();
    if (settings) {
      setMinQuantity(settings.min_quantity);
      setCategories(settings.categories);
    }

    const { data: reqs } = await supabase
      .from("material_requests")
      .select("id, user_id, category, quantity, note, created_at, lat, lng, location_filter")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const list = (reqs ?? []) as Omit<RequestRow, "profile" | "photos">[];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const reqIds = list.map((r) => r.id);
    const [{ data: profs }, { data: phs }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] }),
      reqIds.length
        ? supabase.from("material_request_photos").select("request_id, photo_url, sort_order").in("request_id", reqIds).order("sort_order")
        : Promise.resolve({ data: [] as { request_id: string; photo_url: string; sort_order: number }[] }),
    ]);
    const pMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const photoMap: Record<string, string[]> = {};
    for (const ph of phs ?? []) (photoMap[ph.request_id] ||= []).push(ph.photo_url);
    setRequests(list.map((r) => ({ ...r, profile: pMap.get(r.user_id) ?? null, photos: photoMap[r.id] ?? [] })));

    if (list.length) {
      const { data: my } = await supabase
        .from("material_request_responses")
        .select("request_id")
        .eq("supplier_id", user.id)
        .in("request_id", list.map((r) => r.id));
      setResponded(new Set((my ?? []).map((m) => m.request_id)));
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user]);

  async function saveSettings() {
    if (!user) return;
    const { error } = await supabase
      .from("supplier_settings")
      .upsert({ supplier_id: user.id, min_quantity: minQuantity, categories }, { onConflict: "supplier_id" });
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "km" ? "បានរក្សាទុក" : "Saved");
    void load();
  }

  async function respond(reqId: string, supplierResp: "available" | "unavailable", reqUserId: string) {
    if (!user || busy) return;
    setBusy(reqId);
    const { error } = await supabase
      .from("material_request_responses")
      .insert({ request_id: reqId, supplier_id: user.id, response: supplierResp });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setResponded((s) => new Set(s).add(reqId));
    if (supplierResp === "available") {
      const { data, error: rpcErr } = await supabase.rpc("start_material_chat", {
        _request_id: reqId,
        _supplier_id: user.id,
      });
      if (rpcErr || !data) { toast.error(rpcErr?.message ?? "Error"); return; }
      nav({ to: "/messages/$threadId", params: { threadId: data as string } });
    } else {
      toast.success(lang === "km" ? "បានឆ្លើយតប" : "Response sent");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-10">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <Link to="/profile" className="rounded-full p-2 active:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "ការបញ្ជាទិញតាមអនឡាញ" : "Online orders"}
        </h1>
        <span className="w-9" />
      </header>

      <div className="flex border-b border-border bg-surface">
        <button
          onClick={() => setTab("requests")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold ${
            tab === "requests" ? "border-b-2 border-[#c87000] text-[#c87000]" : "text-muted-foreground"
          }`}
        >
          <Inbox className="h-4 w-4" />
          {lang === "km" ? "សំណើ" : "Requests"}
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold ${
            tab === "settings" ? "border-b-2 border-[#c87000] text-[#c87000]" : "text-muted-foreground"
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          {lang === "km" ? "ការកំណត់" : "My settings"}
        </button>
      </div>

      {tab === "requests" && (
        <div className="flex flex-col gap-2 px-3 pt-3">
          {loading && <div className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>}
          {!loading && categories.length === 0 && (
            <div className="rounded-2xl bg-surface p-6 text-center text-sm text-muted-foreground shadow-card">
              {lang === "km"
                ? "ជ្រើសប្រភេទនៅការកំណត់ដើម្បីទទួលសំណើ"
                : "Select categories in settings to receive requests"}
            </div>
          )}
          {!loading && categories.length > 0 && requests.length === 0 && (
            <div className="rounded-2xl bg-surface p-6 text-center text-sm text-muted-foreground shadow-card">
              {lang === "km" ? "មិនទាន់មានសំណើ" : "No active requests"}
            </div>
          )}
          {requests.map((r) => {
            const cat = CATS.find((c) => c.id === r.category);
            const catLabel = cat ? (lang === "km" ? cat.km : cat.en) : r.category;
            const done = responded.has(r.id);
            const slots = [0, 1, 2];
            const locLabel = r.location_filter === "near_me"
              ? (lang === "km" ? "ក្នុង ២០គម" : "Within 20km")
              : (lang === "km" ? "គ្រប់ទីកន្លែង" : "Anywhere");
            return (
              <div key={r.id} className="overflow-hidden rounded-2xl bg-surface shadow-card">
                {/* Header — requester */}
                <div className="flex items-center gap-3 border-b border-border/60 p-3">
                  <Avatar name={r.profile?.full_name} url={r.profile?.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">
                      {r.profile?.full_name ?? "User"}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {lang === "km" ? "កំពុងស្វែងរក" : "Looking for"} · {cat?.emoji} {catLabel} · 📍 {r.location_filter === "near_me" ? (lang === "km" ? "នៅជិតខ្ញុំ (២០គម)" : "Near me (20km)") : (lang === "km" ? "គ្រប់ទីកន្លែង" : "Anywhere")}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at, t)}</span>
                </div>

                {/* Photos */}
                <div className="px-3 pt-3">
                  <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                    {lang === "km" ? `រូបផលិតផល · ${r.photos.length} មុំ` : `Product photos · ${r.photos.length} angle${r.photos.length === 1 ? "" : "s"}`}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((i) => {
                      const url = r.photos[i];
                      return (
                        <div key={i} className="aspect-square overflow-hidden rounded-xl bg-muted">
                          {url ? (
                            <SignedImage
                              bucket="material-photos"
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground/40">🖼️</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Details */}
                <div className="m-3 rounded-xl bg-muted/40 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === "km" ? "ព័ត៌មានលម្អិតសំណើ" : "Request details"}
                  </p>
                  <DetailRow label={lang === "km" ? "ប្រភេទ" : "Category"} value={`${cat?.emoji ?? ""} ${catLabel}`} />
                  <DetailRow label={lang === "km" ? "ចំនួន" : "Quantity needed"} value={`${r.quantity} ${lang === "km" ? "ឯកតា" : "units"}`} />
                  <DetailRow label={lang === "km" ? "ទីតាំង" : "Location"} value={`📍 ${locLabel}`} />
                  {r.note && (
                    <div className="mt-2 border-t border-border/50 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {lang === "km" ? "កំណត់ចំណាំ" : "Note"}
                      </p>
                      <p className="mt-1 text-xs italic text-foreground">"{r.note}"</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!done ? (
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    <button
                      onClick={() => void respond(r.id, "unavailable", r.user_id)}
                      disabled={busy === r.id}
                      className="flex flex-col items-center justify-center rounded-xl bg-muted py-2.5 text-foreground active:bg-border disabled:opacity-50"
                    >
                      <span className="text-xs font-bold">😕 {lang === "km" ? "សូមអភ័យទោស" : "Sorry"}</span>
                      <span className="text-[10px] text-muted-foreground">{lang === "km" ? "មិនមាន" : "Not available"}</span>
                    </button>
                    <button
                      onClick={() => void respond(r.id, "available", r.user_id)}
                      disabled={busy === r.id}
                      className="flex flex-col items-center justify-center rounded-xl bg-[#c87000] py-2.5 text-white disabled:opacity-50"
                    >
                      <span className="text-xs font-bold">✅ {lang === "km" ? "ខ្ញុំមាន — ទាក់ទង" : "I have it — contact"}</span>
                      <span className="text-[10px] text-white/80">
                        {lang === "km" ? "បើកការសន្ទនា" : `Open chat with ${(r.profile?.full_name ?? "user").split(" ")[0]}`}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="mx-3 mb-3 rounded-xl bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">
                    {lang === "km" ? "បានឆ្លើយតប" : "Responded"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "settings" && (
        <div className="flex flex-col gap-3 p-3">
          <section className="rounded-2xl bg-surface p-4 shadow-card">
            <label className="mb-2 block text-sm font-semibold text-foreground">
              {lang === "km" ? "ចំនួនអប្បបរមា" : "Min quantity"}
            </label>
            <input
              type="number"
              min={1}
              value={minQuantity}
              onChange={(e) => setMinQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-[#c87000] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {lang === "km" ? "ទទួលសំណើតែនៅពេលចំនួនលើសនេះ" : "Only get notified above this quantity"}
            </p>
          </section>

          <section className="rounded-2xl bg-surface p-4 shadow-card">
            <label className="mb-2 block text-sm font-semibold text-foreground">
              {lang === "km" ? "ប្រភេទរបស់ខ្ញុំ" : "My categories"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATS.map((c) => {
                const active = categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      setCategories((cs) => active ? cs.filter((x) => x !== c.id) : [...cs, c.id])
                    }
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-xs font-semibold ${
                      active ? "border-[#c87000] bg-[#c87000]/10 text-[#c87000]" : "border-border text-foreground"
                    }`}
                  >
                    <span className="text-xl">{c.emoji}</span>
                    {lang === "km" ? c.km : c.en}
                  </button>
                );
              })}
            </div>
          </section>

          <button
            onClick={saveSettings}
            className="rounded-xl bg-[#c87000] py-3 text-sm font-bold text-white"
          >
            {lang === "km" ? "រក្សាទុក" : "Save settings"}
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
