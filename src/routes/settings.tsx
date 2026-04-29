import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Image as ImageIcon,
  Lock,
  Smartphone,
  Globe,
  Bell,
  HelpCircle,
  Flag,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
});

interface ProfileLite {
  full_name: string | null;
  avatar_url: string | null;
  is_provider: boolean;
  is_organization: boolean;
  is_admin: boolean;
}

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, avatar_url, is_provider, is_organization, is_admin")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const subtitle = [
    profile?.is_provider ? t("role_provider") : null,
    profile?.is_organization ? t("role_organization") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-screen flex-col bg-background pb-10">
      {/* Blue header with profile card */}
      <header className="bg-primary px-3 pb-6 pt-3 text-primary-foreground">
        <div className="mb-3 flex h-10 items-center">
          <button
            onClick={() => navigate({ to: "/home" })}
            className="rounded-full p-2 active:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">{t("menu")}</h1>
          <span className="w-9" />
        </div>
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-xl px-1 py-2 active:bg-white/10"
        >
          <Avatar
            name={profile?.full_name}
            url={profile?.avatar_url}
            size={56}
            className="border-2 border-white"
          />
          <div className="flex-1">
            <div className="text-base font-bold">{profile?.full_name ?? "—"}</div>
            <div className="text-xs text-white/80">{subtitle || " "}</div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/80" />
        </Link>
      </header>

      {/* My Account */}
      <Group title={t("my_account")}>
        <Row to="/profile/edit" icon={Pencil} iconBg="bg-amber-100" iconColor="text-amber-600" label={t("edit_profile")} />
        <Row to="/profile/portfolio" icon={ImageIcon} iconBg="bg-emerald-100" iconColor="text-emerald-600" label={t("update_profile")} />
        <Row icon={Lock} iconBg="bg-slate-100" iconColor="text-slate-600" label={t("change_password")} />
        <Row icon={Smartphone} iconBg="bg-slate-200" iconColor="text-slate-700" label={t("change_phone")} />
      </Group>

      {/* Preferences */}
      <Group title={t("preferences")}>
        <button
          onClick={() => setLang(lang === "km" ? "en" : ("km" as Lang))}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted"
        >
          <IconBox icon={Globe} bg="bg-sky-100" color="text-sky-600" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">{t("language")}</div>
            <div className="text-xs text-muted-foreground">{lang === "km" ? "ភាសាខ្មែរ" : "English"}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex w-full items-center gap-3 px-4 py-3">
          <IconBox icon={Bell} bg="bg-amber-100" color="text-amber-500" />
          <div className="flex-1 text-sm font-semibold text-foreground">{t("notifications")}</div>
          <button
            onClick={() => setNotifEnabled((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              notifEnabled ? "bg-primary" : "bg-muted"
            }`}
            aria-pressed={notifEnabled}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                notifEnabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </Group>

      {/* Admin */}
      {profile?.is_admin && (
        <Group title={t("admin")}>
          <Row
            to="/admin/posts"
            icon={ShieldCheck}
            iconBg="bg-rose-100"
            iconColor="text-rose-600"
            label={t("review_posts")}
          />
          <Row
            to="/admin/reports"
            icon={Flag}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            label={t("review_reports")}
          />
        </Group>
      )}

      {/* Support */}
      <Group title={t("support")}>
        <Row to="/help" icon={HelpCircle} iconBg="bg-sky-100" iconColor="text-sky-600" label={t("help_faq")} />
        <Row to="/report" icon={Flag} iconBg="bg-rose-100" iconColor="text-rose-600" label={t("report_problem")} />
        <Row to="/terms" icon={FileText} iconBg="bg-slate-100" iconColor="text-slate-600" label={t("terms")} />
        <Row to="/privacy" icon={ShieldAlert} iconBg="bg-amber-100" iconColor="text-amber-600" label={t("privacy")} />
      </Group>

      {/* Footer actions */}
      <div className="mt-6 flex flex-col items-center gap-2 px-4">
        <button
          onClick={() => void signOut()}
          className="text-sm font-bold text-destructive active:opacity-70"
        >
          {t("logout")}
        </button>
        <button className="text-xs font-medium text-muted-foreground active:opacity-70">
          {t("delete_account")}
        </button>
        <p className="mt-1 text-[11px] text-text-hint">{t("app_name")} v1.0</p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h2 className="px-4 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border bg-surface shadow-card">{children}</div>
    </section>
  );
}

interface RowProps {
  to?: string;
  icon: typeof Pencil;
  iconBg: string;
  iconColor: string;
  label: string;
}

function Row({ to, icon: Icon, iconBg, iconColor, label }: RowProps) {
  const inner = (
    <>
      <IconBox icon={Icon} bg={iconBg} color={iconColor} />
      <div className="flex-1 text-sm font-semibold text-foreground">{label}</div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </>
  );
  if (to) {
    return (
      <Link to={to} className="flex w-full items-center gap-3 px-4 py-3 active:bg-muted">
        {inner}
      </Link>
    );
  }
  return (
    <button className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
      {inner}
    </button>
  );
}

function IconBox({
  icon: Icon,
  bg,
  color,
}: {
  icon: typeof Pencil;
  bg: string;
  color: string;
}) {
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
      <Icon className={`h-4 w-4 ${color}`} />
    </div>
  );
}
