import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { X, Sparkles, Flame, ChevronDown, Check, Clock, Briefcase } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "buildhub:ticket_gate_dismissed_on";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Status = "available" | "busy" | "available_soon";

/**
 * Two-screen daily gate for workers (is_provider or is_specialist).
 * Step 1: BOOM lottery ticket. Step 2: 3-state availability picker.
 * Skipped if user already checked in today or dismissed today.
 */
export function DailyTicketGate() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [previewNumber, setPreviewNumber] = useState<number | null>(null);
  const [assignedNumber, setAssignedNumber] = useState<number | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [boom, setBoom] = useState(false);
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (loading || !user) return;
    const userId = user.id;
    let cancelled = false;

    // Wait until Supabase session is actually restored — otherwise auth.uid()
    // is null inside the RPC and the ticket is silently skipped.
    async function waitForSession(maxMs = 8000): Promise<boolean> {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user?.id === userId) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    }

    async function waitForWorkerProfile(maxMs = 8000) {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_provider, is_specialist, full_name, member_number")
          .eq("id", userId)
          .maybeSingle();
        if (profile) return profile;
        await new Promise((r) => setTimeout(r, 300));
      }
      return null;
    }

    async function tryIssue(attempts = 5): Promise<any | null> {
      for (let i = 0; i < attempts; i++) {
        const { data, error } = await supabase.rpc("issue_daily_ticket_if_missing");
        if (!error) return data;
        // transient — wait then retry
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
      return null;
    }

    async function runDailyTicketCheck() {
      const ok = await waitForSession();
      if (cancelled || !ok) return;

      const profile = await waitForWorkerProfile();
      if (cancelled || !profile) return;
      if (!profile.is_provider && !profile.is_specialist) return;

      // ALWAYS try to issue today's ticket — even if the user dismissed the
      // popup earlier today. Dismiss flag only controls whether the UI shows.
      const issued = await tryIssue();
      if (cancelled || !issued) return;
      const res = (issued ?? {}) as {
        ticket_number?: number;
        streak?: number;
        already?: boolean;
        skipped?: boolean;
      };
      if (res.skipped) return;

      const today = todayISO();
      if (res.already) {
        const { data: availability } = await supabase
          .from("daily_availability")
          .select("id")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();
        if (cancelled || availability) return;
      }

      // Ticket was issued or already exists. Suppress UI only if user dismissed today.
      if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === today) return;

      setProfileName(profile.full_name ?? "");
      setAssignedNumber(res.ticket_number ?? null);
      setPreviewNumber(res.ticket_number ?? null);
      setStreak(res.streak ?? 1);
      setStep(1);
      setBoom(true);
      setOpen(true);
    }

    void runDailyTicketCheck();

    const rerunWhenAppIsOpened = () => {
      if (document.visibilityState === "visible") void runDailyTicketCheck();
    };
    window.addEventListener("focus", rerunWhenAppIsOpened);
    document.addEventListener("visibilitychange", rerunWhenAppIsOpened);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", rerunWhenAppIsOpened);
      document.removeEventListener("visibilitychange", rerunWhenAppIsOpened);
    };
  }, [user, loading]);

  async function submit(status: Status) {
    if (submitting || !user) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("mark_daily_availability", { _status: status });
    setSubmitting(false);
    localStorage.setItem(DISMISS_KEY, todayISO());
    if (error) {
      toast.error(error.message);
      return;
    }
    const res = (data ?? {}) as { ticket_number?: number; streak?: number };
    if (status === "busy") {
      toast(lang === "km" ? "ជួបគ្នាស្អែក!" : "See you tomorrow!");
      setOpen(false);
      return;
    }
    setAssignedNumber(res.ticket_number ?? previewNumber ?? null);
    setStreak(res.streak ?? 1);
    setBoom(true);
  }

  function close() {
    localStorage.setItem(DISMISS_KEY, todayISO());
    setOpen(false);
    setBoom(false);
  }

  function skip() {
    close();
  }

  if (!open) return null;

  // BOOM celebration after availability submitted
  if (boom) {
    const num = assignedNumber ? `#${String(assignedNumber).padStart(4, "0")}` : "#----";
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white">
        <div className="animate-bounce text-7xl font-black drop-shadow-lg">BOOM!</div>
        <div className="mt-3 text-2xl font-bold">{num}</div>
        <div className="mt-1 text-sm opacity-90">
          {lang === "km" ? "សំបុត្ររបស់អ្នកត្រូវបានបញ្ជាក់" : "Your ticket is validated"}
        </div>
        {streak > 1 && (
          <div className="mt-6 flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur">
            <Flame className="h-5 w-5" />
            <span className="font-bold">
              {streak} {lang === "km" ? "ថ្ងៃជាប់គ្នា" : "day streak"}
            </span>
          </div>
        )}
        <button
          onClick={close}
          className="mt-10 rounded-full bg-white px-8 py-3 font-bold text-orange-600 shadow-lg active:scale-95"
        >
          {lang === "km" ? "បន្ត" : "Continue"}
        </button>
      </div>
    );
  }

  // Step 2 — Availability picker
  if (step === 2) {
    const greet = lang === "km" ? "សួស្តី" : "Good morning";
    const name = profileName.split(" ")[0] || (lang === "km" ? "" : "");
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0f1117] p-4">
        <div className="mx-auto w-full max-w-sm pt-6">
          <button
            onClick={skip}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#0F6E56] text-2xl font-bold text-white">
              {(profileName[0] ?? "?").toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-white">
              {greet}{name ? `, ${name}` : ""} 👋
            </h2>
            <p className="mt-1 text-xs text-white/60">
              {lang === "km" ? "តើអ្នកមានវត្តមានយ៉ាងណាថ្ងៃនេះ?" : "What is your availability today?"}
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            <StatusButton
              icon={<Check className="h-5 w-5" />}
              title={lang === "km" ? "មានពេលថ្ងៃនេះ" : "Available today"}
              subtitle={lang === "km" ? "ខ្ញុំទំនេរ និងរកការងារ" : "I am free and looking for work"}
              color="#0F6E56"
              onClick={() => submit("available")}
              disabled={submitting}
            />
            <StatusButton
              icon={<Briefcase className="h-5 w-5" />}
              title={lang === "km" ? "រវល់ថ្ងៃនេះ" : "Busy today"}
              subtitle={lang === "km" ? "ខ្ញុំមានការងារធ្វើ" : "I have work today"}
              color="#7c2d2d"
              onClick={() => submit("busy")}
              disabled={submitting}
            />
            <StatusButton
              icon={<Clock className="h-5 w-5" />}
              title={lang === "km" ? "មានពេលឆាប់ៗ" : "Available soon"}
              subtitle={lang === "km" ? "ទំនេរចាប់ពីថ្ងៃណាមួយ" : "Free from a specific date"}
              color="#EF9F27"
              onClick={() => submit("available_soon")}
              disabled={submitting}
            />
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-white/80">
              <span>🎁</span>
              <span className="font-semibold">
                {lang === "km" ? "ឆែក = ចូលឆ្នោតថ្ងៃនេះ" : "Mark status = enter today's draw"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-white/55">
              {lang === "km" ? "រង្វាន់ថ្ងៃនេះ" : "Prize today"}: 2🍺 · {lang === "km" ? "សប្តាហ៍" : "Weekly"} $15 · {lang === "km" ? "ខែ" : "Monthly"} $40
            </div>
          </div>

          <button
            onClick={skip}
            className="mx-auto mt-4 block text-xs text-white/50 underline-offset-2 hover:underline"
          >
            {lang === "km" ? "រំលងថ្ងៃនេះ — មិនចូលឆ្នោត" : "Skip for today — no prize entry"}
          </button>
        </div>
      </div>
    );
  }

  // Step 1 — BOOM lottery ticket
  const today = new Date();
  const dateStr = today.toLocaleDateString(lang === "km" ? "km-KH" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const ticketNo = previewNumber ? `#${String(previewNumber).padStart(4, "0")}` : "#----";

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0f1117] p-4">
      <div className="mx-auto w-full max-w-sm pt-2">
        <button
          onClick={skip}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 text-center">
          <div className="mb-1 text-3xl">🎉</div>
          <h2 className="text-xl font-bold text-white">
            {lang === "km" ? "សំបុត្រថ្ងៃនេះមកដល់ហើយ!" : "Today's ticket is yours!"}
          </h2>
          <p className="mt-1 text-xs text-white/60">
            {lang === "km" ? "បញ្ជាក់ឥឡូវ — ឆែកវត្តមានរបស់អ្នក" : "Validate it now — mark your availability"}
          </p>
        </div>

        {/* Lottery Ticket */}
        <div className="overflow-hidden rounded-2xl border-2 border-[#c4b800] bg-[#f5e642] shadow-2xl">
          <div className="flex items-center justify-between bg-[#c87000] px-4 py-2 text-white">
            <span className="text-sm font-bold">ជាងសំណង់</span>
            <span className="text-xs font-black tracking-widest">BUILDHUB</span>
          </div>
          <div className="px-4 pt-3 text-center">
            <div className="text-[#c87000]">★ ★ ★ ★ ★</div>
            <div className="mt-1 text-[11px] font-bold tracking-widest text-[#7a4500]">
              {lang === "km" ? "សំបុត្រឆ្នោតផ្លូវការ" : "OFFICIAL LOTTERY TICKET"}
            </div>
          </div>
          <div className="my-2 mx-4 border-t-2 border-dashed border-[#c87000]/70" />
          <div className="mx-4 rounded-lg border border-[#c87000]/40 bg-white px-3 py-3 text-center">
            <div className="text-[10px] tracking-widest text-[#c87000]">
              {lang === "km" ? "លេខសំបុត្រ" : "TICKET NUMBER"}
            </div>
            <div className="text-5xl font-black text-[#c87000]">{ticketNo}</div>
            <div className="mt-1 text-[11px] text-slate-500">{dateStr}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-3">
            <PrizeCell icon="🍺" label={lang === "km" ? "ប្រចាំថ្ងៃ" : "Daily"} value="$1" />
            <PrizeCell icon="💵" label={lang === "km" ? "សប្តាហ៍" : "Weekly"} value="$15" />
            <PrizeCell icon="🏆" label={lang === "km" ? "ខែ" : "Monthly"} value="$40" />
          </div>
          <div className="flex items-center justify-center gap-1 bg-[#c87000] px-4 py-2 text-[11px] font-semibold text-white">
            <Sparkles className="h-3 w-3" /> 🎁 BuildHub Rewards · Siem Reap 2026
          </div>
        </div>

        {/* Stub */}
        <div className="my-2 mx-2 border-t-2 border-dashed border-white/30" />
        <div className="mx-2 flex items-center justify-between rounded-xl bg-[#f5e642] px-4 py-3 shadow-lg">
          <div>
            <div className="text-[11px] font-black tracking-widest text-[#7a4500]">
              {lang === "km" ? "បញ្ជាក់ដើម្បីចូលរួម" : "VALIDATE TO ENTER"}
            </div>
            <div className="text-[11px] text-[#c87000]">
              {lang === "km" ? "ឆែកវត្តមានខាងក្រោម" : "Mark availability below"}
            </div>
          </div>
          <div className="text-2xl font-black text-[#c87000]">{ticketNo}</div>
        </div>

        <p className="mt-4 text-center text-xs text-white/70">
          {lang === "km" ? "ចុចខាងក្រោមដើម្បីបញ្ជាក់សំបុត្ររបស់អ្នក" : "Tap below to validate your ticket"}
        </p>

        <button
          onClick={() => setStep(2)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F6E56] py-4 text-base font-bold text-white shadow-lg active:scale-[0.98]"
        >
          {lang === "km" ? "បន្តទៅឆែកវត្តមាន" : "Continue to availability"}
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function StatusButton({
  icon,
  title,
  subtitle,
  color,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left active:scale-[0.99] disabled:opacity-50"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold" style={{ color }}>
          {title}
        </div>
        <div className="text-[11px] text-white/55">{subtitle}</div>
      </div>
    </button>
  );
}

function PrizeCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#c87000]/30 bg-white py-2 text-center">
      <div className="text-xl">{icon}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-700">{label}</div>
      <div className="text-xs font-bold text-[#c87000]">{value}</div>
    </div>
  );
}
