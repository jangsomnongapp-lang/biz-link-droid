import { useI18n } from "@/lib/i18n";

export function timeAgo(iso: string, t: ReturnType<typeof useI18n>["t"]): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("just_now");
  if (m < 60) return `${m} ${t("min_ago")}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t("hour_ago")}`;
  const d = Math.floor(h / 24);
  return `${d} ${t("day_ago")}`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name[0].toUpperCase();
}

const palette = [
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
