import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { phoneLoginEmails, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { loginWithGoogle } from "@/lib/nativeGoogleLogin";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/jangsomnong-logo.jpg";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

// Only accept same-origin relative paths to prevent open-redirect abuse.
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function LoginPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const goNext = () => {
    if (target) window.location.href = target;
    else nav({ to: "/home" });
  };

  useEffect(() => {
    if (!loading && user) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let loginError: Error | null = null;
      for (const email of phoneLoginEmails(phone)) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          loginError = null;
          break;
        }
        loginError = error;
      }
      if (loginError) throw loginError;
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function signInWithGoogle() {
    await loginWithGoogle(target ? () => { window.location.href = target; } : nav);
  }

  return (

    <div className="flex min-h-screen flex-col bg-primary px-6 pb-10 pt-6 text-primary-foreground">
      <Link to="/" className="-ml-2 inline-flex w-fit items-center gap-1 rounded-full p-2 active:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-card">
          <img src={logo} alt="BuildHub" className="h-full w-full object-cover border" />
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
          <Link to="/forgot-password" className="mt-2 block w-full text-right text-xs text-white/80 underline">
            {t("forgot_password")}
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-base font-semibold text-primary active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? t("loading") : t("login")}
        </button>
      </form>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/30" />
        <span className="text-xs text-white/80">{t("or")}</span>
        <div className="h-px flex-1 bg-white/30" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 text-base font-semibold text-white active:scale-[0.98]"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.33v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.11z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {t("login_with_google")}
      </button>


      <div className="mt-auto pt-8 text-center text-sm">
        <span className="text-white/80">{t("no_account")} </span>
        <Link to="/register" className="font-semibold underline">
          {t("register")}
        </Link>
      </div>
    </div>
  );
}
