import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Sparkles, Trophy, Flame } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "buildhub:ticket_gate_dismissed_on";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Auto-loads on app open for workers (is_provider or is_specialist).
 * Shows a lottery-ticket-style daily availability gate. One check per day.
 */
export function DailyTicketGate() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [boom, setBoom] = useState<{ streak: number } | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      const today = todayISO();
      // Don't re-show if dismissed today
      if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === today) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_provider, is_specialist, member_number")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !profile) return;
      if (!profile.is_provider && !profile.is_specialist) return;

      const { data: check } = await supabase
        .from("daily_availability")
        .select("date")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      if (cancelled || check) return;

      setTicketNumber(profile.member_number ?? null);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  async function answer(available: boolean) {
    if (submitting || !user) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("mark_daily_availability", { _available: available });
    setSubmitting(false);
    localStorage.setItem(DISMISS_KEY, todayISO());
    if (error) {
      toast.error(error.message);
      return;
    }
    if (available) {
      const res = data as { streak?: number };
      setBoom({ streak: res?.streak ?? 1 });
    } else {
      setOpen(false);
      toast(lang === "km" ? "ជួបគ្នាស្អែក!" : "See you tomorrow!");
    }
  }

  function close() {
    localStorage.setItem(DISMISS_KEY, todayISO());
    setOpen(false);
    setBoom(null);
  }

  if (!open) return null;

  if (boom) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white">
        <div className="animate-bounce text-7xl font-black drop-shadow-lg">BOOM!</div>
        <div className="mt-3 text-2xl font-bold">{lang === "km" ? "+៣ សំបុត្រ" : "+3 tickets!"}</div>
        <div className="mt-1 text-sm opacity-90">{lang === "km" ? "ប្រចាំថ្ងៃ · សប្តាហ៍ · ខែ" : "Daily · Weekly · Monthly"}</div>
        {boom.streak > 1 && (
          <div className="mt-6 flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur">
            <Flame className="h-5 w-5" />
            <span className="font-bold">
              {boom.streak} {lang === "km" ? "ថ្ងៃជាប់គ្នា" : "day streak"}
            </span>
          </div>
        )}
        <div className="mt-10 flex gap-3">
          <button
            onClick={() => {
              close();
              nav({ to: "/rewards" });
            }}
            className="rounded-full bg-white px-6 py-3 font-bold text-orange-600 shadow-lg active:scale-95"
          >
            {lang === "km" ? "មើលរង្វាន់" : "View rewards"}
          </button>
          <button
            onClick={close}
            className="rounded-full border-2 border-white/70 px-6 py-3 font-bold text-white active:scale-95"
          >
            {lang === "km" ? "បិទ" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString(lang === "km" ? "km-KH" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const ticketNo = ticketNumber ? `#${String(ticketNumber).padStart(4, "0")}` : "#----";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm">
        {/* Close */}
        <button
          onClick={close}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-3 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-2xl">
            🎉
          </div>
          <h2 className="text-xl font-bold text-white">
            {lang === "km" ? "សំបុត្រថ្ងៃនេះមកដល់ហើយ!" : "Today's ticket is yours!"}
          </h2>
          <p className="mt-1 text-xs text-white/70">
            {lang === "km" ? "បញ្ជាក់ឥឡូវ — ឆែកវត្តមានរបស់អ្នក" : "Validate it now — mark your availability"}
          </p>
        </div>

        {/* Ticket */}
        <div className="overflow-hidden rounded-2xl bg-yellow-300 shadow-2xl">
          {/* Top band */}
          <div className="flex items-center justify-between bg-orange-500 px-4 py-2 text-white">
            <span className="text-sm font-bold">សំណាង</span>
            <span className="text-xs font-black tracking-widest">BUILDHUB</span>
          </div>
          {/* Stars + label */}
          <div className="px-4 pt-3 text-center">
            <div className="text-orange-500">★ ★ ★ ★ ★</div>
            <div className="mt-1 text-[11px] font-bold tracking-widest text-orange-700">
              {lang === "km" ? "សំបុត្រឆ្នោតផ្លូវការ" : "OFFICIAL LOTTERY TICKET"}
            </div>
          </div>
          {/* Dashed divider */}
          <div className="my-2 border-t-2 border-dashed border-orange-400/70 mx-4" />
          {/* Number */}
          <div className="mx-4 rounded-lg border border-orange-300 bg-white px-3 py-3 text-center">
            <div className="text-[10px] tracking-widest text-orange-600">
              {lang === "km" ? "លេខសំបុត្រ" : "TICKET NUMBER"}
            </div>
            <div className="text-4xl font-black text-orange-600">{ticketNo}</div>
            <div className="mt-1 text-[11px] text-slate-500">{dateStr}</div>
          </div>
          {/* Three prizes */}
          <div className="grid grid-cols-3 gap-2 p-3">
            <PrizeCell icon="🍺" label={lang === "km" ? "ប្រចាំថ្ងៃ" : "Daily"} value="$1" />
            <PrizeCell icon="💵" label={lang === "km" ? "សប្តាហ៍" : "Weekly"} value="$15" />
            <PrizeCell icon="🏆" label={lang === "km" ? "ខែ" : "Monthly"} value="$40" />
          </div>
          {/* Footer band */}
          <div className="flex items-center justify-center gap-1 bg-orange-500 px-4 py-2 text-[11px] font-semibold text-white">
            <Sparkles className="h-3 w-3" /> BuildHub Rewards
          </div>
        </div>

        {/* Validate strip */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-yellow-300 px-4 py-3 shadow-lg">
          <div>
            <div className="text-[11px] font-black tracking-widest text-orange-700">
              {lang === "km" ? "បញ្ជាក់ដើម្បីចូលរួម" : "VALIDATE TO ENTER"}
            </div>
            <div className="text-[11px] text-orange-600">
              {lang === "km" ? "ឆែកវត្តមានខាងក្រោម" : "Mark availability below"}
            </div>
          </div>
          <div className="text-2xl font-black text-orange-600">{ticketNo}</div>
        </div>

        {/* Question */}
        <p className="mt-4 text-center text-sm text-white/90">
          {lang === "km" ? "តើអ្នកអាចធ្វើការថ្ងៃនេះទេ?" : "Are you available to work today?"}
        </p>

        {/* Buttons */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            disabled={submitting}
            onClick={() => answer(false)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/10 py-3 text-sm font-semibold text-white backdrop-blur active:scale-[0.98] disabled:opacity-50"
          >
            <X className="h-4 w-4" /> {lang === "km" ? "មិនទាន់" : "Not today"}
          </button>
          <button
            disabled={submitting}
            onClick={() => answer(true)}
            style={{ backgroundColor: "#0F6E56" }}
            className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {lang === "km" ? "បាទ/ចាស!" : "Yes, available!"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrizeCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-white py-2 text-center">
      <div className="text-xl">{icon}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-700">{label}</div>
      <div className="text-xs font-bold text-orange-600">{value}</div>
    </div>
  );
}
