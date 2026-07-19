import { useI18n } from "@/lib/i18n";
import logo from "@/assets/jangsomnong-logo.jpg";

export function SplashScreen() {
  const { t } = useI18n();

  return (
    <main
      aria-busy="true"
      aria-label={t("loading")}
      className="relative flex min-h-screen flex-col items-center justify-center bg-primary px-6 text-primary-foreground"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="splash-logo flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-white/90 bg-white shadow-card">
          <img
            src={logo}
            alt="BuildHub"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight drop-shadow-sm">
            {t("app_name")}
          </h1>
          <p className="text-sm text-white/85">{t("tagline")}</p>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-3">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
          <div className="splash-progress h-full rounded-full bg-white" />
        </div>
        <span className="text-xs font-medium text-white/80">{t("loading")}</span>
      </div>
    </main>
  );
}
