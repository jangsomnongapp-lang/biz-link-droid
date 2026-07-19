import { Link, useNavigate } from "@tanstack/react-router";
import { useI18n, type Lang } from "@/lib/i18n";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/jangsomnong-logo.jpg";

export default function Welcome() {
  const { t, lang, setLang } = useI18n();
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && user) nav({ to: "/home" });
  }, [user, loading, nav]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between bg-primary px-6 pb-10 pt-6 text-primary-foreground">
      {/* Language switch */}
      <div className="flex w-full justify-end">
        <div className="flex overflow-hidden rounded-pill bg-white/95 text-xs font-semibold text-foreground shadow-card">
          {(["en", "km"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
                lang === l ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              <span className="text-base leading-none">{l === "km" ? "🇰🇭" : "🇬🇧"}</span>
              <span>{l === "km" ? "Khmer" : "English"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-card">
          <img
            src={logo}
            alt="BuildHub Construction Marketplace Logo"
            className="h-full w-full object-cover border"
          />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-sm mx-[0px] my-[20px] mb-[0px]">
          {t("app_name")} <span className="sr-only">— Construction Marketplace in Cambodia</span>
        </h1>
        <p className="text-base text-white/85">{t("tagline")}</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link
          to="/register"
          className="flex h-14 items-center justify-center rounded-2xl bg-white text-base font-semibold text-primary active:scale-[0.98] transition"
        >
          {t("register")}
        </Link>
        <Link
          to="/login"
          className="flex h-14 items-center justify-center rounded-2xl border-2 border-white/70 text-base font-semibold text-white active:scale-[0.98] transition"
        >
          {t("have_account")}
        </Link>
      </div>
    </main>
  );
}
