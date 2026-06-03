import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { changeMyPhone, deleteMyAccount } from "@/lib/account.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
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
  HardHat,
  Users,
  Trophy,
  Store,
  Send,
  UserCog,
  Gift,
  Ticket,
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
  is_super_user: boolean;
  master_account_id: string | null;
}

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [mySupplierStoreId, setMySupplierStoreId] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [pendingLang, setPendingLang] = useState<Lang | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const changePhoneFn = useServerFn(changeMyPhone);
  const deleteAccountFn = useServerFn(deleteMyAccount);

  async function handleChangePassword() {
    if (newPw.length < 6) { toast.error(t("password_min")); return; }
    if (newPw !== confirmPw) { toast.error(t("password_mismatch")); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("password_changed"));
    setPwOpen(false); setNewPw(""); setConfirmPw("");
  }

  async function handleChangePhone() {
    setBusy(true);
    try {
      await changePhoneFn({ data: { phone: newPhone } });
      toast.success(t("phone_changed"));
      setPhoneOpen(false); setNewPhone("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmLang() {
    if (!pendingLang) return;
    setLang(pendingLang);
    toast.success(pendingLang === "km" ? "បានប្ដូរទៅភាសាខ្មែរ" : "Switched to English");
    setLangOpen(false);
    setPendingLang(null);
  }

  async function handleDeleteAccount() {
    setBusy(true);
    try {
      await deleteAccountFn({});
      setDeleteOpen(false);
      toast.success(t("delete_account"));
      // Navigate away first so no authenticated queries refetch after the user is gone
      navigate({ to: "/login" });
      // Then clear the local session in the background
      void signOut();
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      if (e instanceof Response) {
        try { msg = (await e.text()) || `Error ${e.status}`; } catch { msg = `Error ${e.status}`; }
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, avatar_url, is_provider, is_organization, is_admin, is_super_user, master_account_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    void supabase
      .from("supplier_stores")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMySupplierStoreId(data?.id ?? null));
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
        <button
          type="button"
          onClick={() =>
            mySupplierStoreId
              ? navigate({ to: "/suppliers/$storeId", params: { storeId: mySupplierStoreId } })
              : navigate({ to: "/profile" })
          }
          className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-white/10"
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
        </button>
      </header>

      {/* Discover */}
      <Group title={t("find_worker")}>
        <Row to="/find-worker" icon={HardHat} iconBg="bg-indigo-100" iconColor="text-indigo-600" label={t("find_worker")} />
        <Row to="/invitations" icon={Users} iconBg="bg-violet-100" iconColor="text-violet-600" label={t("my_invitations")} />
      </Group>

      {/* My Account */}
      <Group title={t("my_account")}>
        {mySupplierStoreId ? (
          <>
            <RowButton
              onClick={() => navigate({ to: "/suppliers/$storeId", params: { storeId: mySupplierStoreId } })}
              icon={Store}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              label="Supplier Profile"
            />
            <RowButton
              onClick={() => navigate({ to: "/suppliers/$storeId/edit", params: { storeId: mySupplierStoreId } })}
              icon={Pencil}
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
              label={t("edit_store")}
            />
          </>
        ) : (
          <>
            <Row to="/profile/edit" icon={Pencil} iconBg="bg-amber-100" iconColor="text-amber-600" label={t("edit_profile")} />
            <Row to="/profile/portfolio" icon={ImageIcon} iconBg="bg-emerald-100" iconColor="text-emerald-600" label={t("update_profile")} />
          </>
        )}
        <Row to="/rewards" icon={Gift} iconBg="bg-orange-100" iconColor="text-orange-600" label={lang === "km" ? "BuildHub Rewards" : "BuildHub Rewards"} />
        <RowButton onClick={() => setPwOpen(true)} icon={Lock} iconBg="bg-slate-100" iconColor="text-slate-600" label={t("change_password")} />
        <RowButton onClick={() => setPhoneOpen(true)} icon={Smartphone} iconBg="bg-slate-200" iconColor="text-slate-700" label={t("change_phone")} />
      </Group>

      {/* Preferences */}
      <Group title={t("preferences")}>
        <button
          onClick={() => {
            const next: Lang = lang === "km" ? "en" : "km";
            setPendingLang(next);
            setLangOpen(true);
          }}
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
          <Row
            to="/admin/invitations"
            icon={Trophy}
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            label={t("admin_invitations")}
          />
          <Row
            to="/admin/draws"
            icon={Ticket}
            iconBg="bg-orange-100"
            iconColor="text-orange-600"
            label={lang === "km" ? "គ្រប់គ្រងការចាប់ឆ្នោត" : "Lottery draws"}
          />
          <Row
            to="/admin/suppliers"
            icon={Store}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            label={t("admin_suppliers")}
          />
          <Row
            to="/admin/telegram"
            icon={Send}
            iconBg="bg-sky-100"
            iconColor="text-sky-600"
            label="Telegram notifications"
          />
        </Group>
      )}

      {(profile?.is_super_user || profile?.master_account_id) && (
        <Group title="Super user">
          <RowButton
            onClick={() => navigate({ to: "/superuser/panel" })}
            icon={UserCog}
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            label="Switch identity"
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
          onClick={() => setLogoutOpen(true)}
          className="text-sm font-bold text-destructive active:opacity-70"
        >
          {t("logout")}
        </button>
        <Drawer open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t("logout_confirm_title")}</DrawerTitle>
              <DrawerDescription>{t("logout_confirm_desc")}</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button
                onClick={() => void signOut()}
                className="h-12 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("logout")}
              </Button>
              <Button variant="outline" onClick={() => setLogoutOpen(false)} className="h-12 rounded-xl">
                {t("cancel")}
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <button
          onClick={() => setDeleteOpen(true)}
          className="text-xs font-medium text-muted-foreground active:opacity-70"
        >
          {t("delete_account")}
        </button>
        <p className="mt-1 text-[11px] text-text-hint">{t("app_name")} v1.0</p>
      </div>

      {/* Change password sheet */}
      <Drawer open={pwOpen} onOpenChange={setPwOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("change_password")}</DrawerTitle>
            <DrawerDescription>{t("password_min")}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4">
            <Input
              type="password"
              placeholder={t("new_password")}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <Input
              type="password"
              placeholder={t("confirm_password")}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          <DrawerFooter>
            <Button onClick={handleChangePassword} disabled={busy} className="h-12 rounded-xl">
              {t("save")}
            </Button>
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={busy} className="h-12 rounded-xl">
              {t("cancel")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Change phone sheet */}
      <Drawer open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("change_phone")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <Input
              type="tel"
              placeholder={t("new_phone")}
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <DrawerFooter>
            <Button onClick={handleChangePhone} disabled={busy || newPhone.trim().length < 6} className="h-12 rounded-xl">
              {t("save")}
            </Button>
            <Button variant="outline" onClick={() => setPhoneOpen(false)} disabled={busy} className="h-12 rounded-xl">
              {t("cancel")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete account sheet */}
      <Drawer open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("delete_account_title")}</DrawerTitle>
            <DrawerDescription>{t("delete_account_desc")}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Input
              placeholder={t("delete_confirm_type")}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>
          <DrawerFooter>
            <Button
              onClick={handleDeleteAccount}
              disabled={busy || deleteConfirmText !== "DELETE"}
              className="h-12 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete_account")}
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy} className="h-12 rounded-xl">
              {t("cancel")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Language confirm sheet */}
      <Drawer open={langOpen} onOpenChange={setLangOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{pendingLang === "km" ? "ប្ដូរទៅភាសាខ្មែរ?" : "Switch to English?"}</DrawerTitle>
            <DrawerDescription>
              {pendingLang === "km" ? "អ្នកនឹងប្ដូរភាសាទៅខ្មែរ" : "The app language will change to English."}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button onClick={handleConfirmLang} className="h-12 rounded-xl">
              {t("confirm")}
            </Button>
            <Button variant="outline" onClick={() => { setLangOpen(false); setPendingLang(null); }} className="h-12 rounded-xl">
              {t("cancel")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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

function RowButton({ onClick, icon: Icon, iconBg, iconColor, label }: RowProps & { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
      <IconBox icon={Icon} bg={iconBg} color={iconColor} />
      <div className="flex-1 text-sm font-semibold text-foreground">{label}</div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
