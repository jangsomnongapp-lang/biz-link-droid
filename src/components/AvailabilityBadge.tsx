import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Check, Clock, Briefcase } from "lucide-react";

type Status = "available" | "busy" | "available_soon";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// In-memory cache keyed by user id → today's status (null = checked, none set)
const cache = new Map<string, Status | null>();

export function useTodayAvailability(userId?: string | null) {
  const [status, setStatus] = useState<Status | null>(
    userId && cache.has(userId) ? cache.get(userId)! : null,
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void supabase
      .rpc("get_today_availability", { _uid: userId })
      .then(({ data }) => {
        const s = (typeof data === "string" ? data : null) as Status | null;
        cache.set(userId, s);
        if (!cancelled) setStatus(s);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return status;
}

export function AvailabilityBadge({
  userId,
  size = "sm",
}: {
  userId: string;
  size?: "sm" | "md";
}) {
  const { lang } = useI18n();
  const status = useTodayAvailability(userId);
  if (!status) return null;

  const cfg =
    status === "available"
      ? {
          icon: Check,
          bg: "bg-emerald-100 dark:bg-emerald-950",
          fg: "text-emerald-700 dark:text-emerald-300",
          dot: "bg-emerald-500",
          label: lang === "km" ? "មានពេលថ្ងៃនេះ" : "Available today",
        }
      : status === "available_soon"
        ? {
            icon: Clock,
            bg: "bg-amber-100 dark:bg-amber-950",
            fg: "text-amber-700 dark:text-amber-300",
            dot: "bg-amber-500",
            label: lang === "km" ? "មានពេលឆាប់ៗ" : "Available soon",
          }
        : {
            icon: Briefcase,
            bg: "bg-rose-100 dark:bg-rose-950",
            fg: "text-rose-700 dark:text-rose-300",
            dot: "bg-rose-500",
            label: lang === "km" ? "រវល់ថ្ងៃនេះ" : "Busy today",
          };

  const Icon = cfg.icon;
  const padding = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";
  const iconSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${cfg.bg} ${cfg.fg} ${padding}`}
    >
      <span className={`relative flex h-1.5 w-1.5`}>
        {status === "available" && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      <Icon className={iconSize} />
      <span className="whitespace-nowrap">{cfg.label}</span>
    </span>
  );
}
