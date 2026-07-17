import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, EyeOff, Send } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { requestPasswordResetTelegram, verifyResetCodeAndSetPassword } from "@/lib/password-reset.functions";
import { Button } from "@/components/ui/button";
import logo from "@/assets/jangsomnong-logo.jpg";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — BuildHub" },
      { name: "description", content: "Reset your BuildHub password via Telegram verification." },
      { property: "og:title", content: "Reset password — BuildHub" },
      { property: "og:description", content: "Reset your BuildHub password via Telegram verification." },
      { property: "og:url", content: "https://buildhubkh.com/forgot-password" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/forgot-password" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const startTelegramReset = useServerFn(requestPasswordResetTelegram);
  const verify = useServerFn(verifyResetCodeAndSetPassword);

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [resetId, setResetId] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [code, setCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const km = lang === "km";

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    try {
      const result = await startTelegramReset({ data: { phone } });
      setResetId(result.resetId);
      setBotUrl(result.botUrl);
      setStep(2);
      window.open(result.botUrl, "_blank", "noopener,noreferrer");
      toast.success(km ? "សូមផ្ទៀងផ្ទាត់លេខរបស់អ្នកក្នុង Telegram" : "Verify your number in Telegram");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await verify({ data: { resetId, code, newPassword: newPwd } });
      toast.success(km ? "ប្តូរពាក្យសម្ងាត់រួចរាល់" : "Password updated");
      nav({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary px-6 pb-10 pt-6 text-primary-foreground">
      <Link to="/login" className="-ml-2 inline-flex w-fit items-center gap-1 rounded-full p-2 active:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="mt-4 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white">
          <img src={logo} alt="BuildHub" className="h-full w-full object-cover" />
        </div>
        <h1 className="text-xl font-bold">
          {km ? "កំណត់ពាក្យសម្ងាត់ឡើងវិញ" : "Reset password"}
        </h1>
        <p className="text-sm text-white/85">
          {step === 1
            ? km
              ? "បញ្ចូលលេខទូរស័ព្ទ ហើយផ្ទៀងផ្ទាត់ក្នុង Telegram"
              : "Enter your phone, then verify it in Telegram"
            : km
              ? "បញ្ចូលលេខកូដ ៦ ខ្ទង់ និងពាក្យសម្ងាត់ថ្មី"
              : "Enter the 6-digit code and a new password"}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={onSend} className="mt-8 space-y-4">
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
          <Button
            type="submit"
            disabled={busy}
            className="h-14 w-full rounded-2xl bg-background text-base font-semibold text-primary active:scale-[0.98]"
          >
            <Send className="h-5 w-5" />
            {busy ? t("loading") : km ? "បន្តជាមួយ Telegram" : "Continue with Telegram"}
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="mt-8 space-y-4">
          <a
            href={botUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary-foreground/40 bg-primary-foreground/10 text-sm font-semibold text-primary-foreground"
          >
            <Send className="h-4 w-4" />
            {km ? "បើក Telegram ដើម្បីទទួលលេខកូដ" : "Open Telegram to get the code"}
          </a>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/85">
              {km ? "លេខកូដ ៦ ខ្ទង់" : "6-digit code"}
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="h-12 w-full rounded-xl bg-white px-3 text-center text-lg font-semibold tracking-[0.4em] text-foreground outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/85">
              {km ? "ពាក្យសម្ងាត់ថ្មី" : "New password"}
            </label>
            <div className="flex h-12 items-center overflow-hidden rounded-xl bg-white text-foreground">
              <input
                type={showPwd ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
                placeholder="••••••"
                minLength={6}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="px-3 text-primary">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={busy || code.length !== 6 || newPwd.length < 6}
            className="h-14 w-full rounded-2xl bg-background text-base font-semibold text-primary active:scale-[0.98]"
          >
            {busy ? t("loading") : km ? "រក្សាទុកពាក្យសម្ងាត់ថ្មី" : "Update password"}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => setStep(1)}
            className="w-full text-xs text-primary-foreground/80"
          >
            {km ? "ចាប់ផ្តើមម្តងទៀត" : "Start again"}
          </Button>
        </form>
      )}
    </div>
  );
}
