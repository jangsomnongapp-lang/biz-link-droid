import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { phoneToEmail, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/jangsomnong-logo.jpg";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/home" });
  }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password,
      });
      if (error) throw error;
      nav({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary px-6 pb-10 pt-6 text-primary-foreground">
      <Link to="/" className="-ml-2 inline-flex w-fit items-center gap-1 rounded-full p-2 active:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white">
          <img src={logo} alt="JangSomnong" className="h-full w-full object-cover" />
        </div>
        <h1 className="text-2xl font-bold">{t("app_name")}</h1>
        <p className="text-sm text-white/85">{t("welcome_back")}</p>
      </div>

      <form onSubmit={submit} className="mt-10 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/85">{t("phone")}</label>
          <div className="flex h-12 items-center overflow-hidden rounded-xl bg-white text-foreground">
            <span className="border-r border-border px-3 text-sm font-medium text-muted-foreground">+855</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder={t("phone_ph")}
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/85">{t("password")}</label>
          <div className="flex h-12 items-center overflow-hidden rounded-xl bg-white text-foreground">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
              placeholder="••••••"
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="px-3 text-primary">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button type="button" className="mt-2 block w-full text-right text-xs text-white/80">
            {t("forgot_password")}
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-base font-semibold text-primary active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("login")}
        </button>
      </form>

      <div className="mt-auto pt-8 text-center text-sm">
        <span className="text-white/80">{t("no_account")} </span>
        <Link to="/register" className="font-semibold underline">
          {t("register")}
        </Link>
      </div>
    </div>
  );
}
