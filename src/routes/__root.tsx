import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useState } from "react";
import { queryPersister, shouldPersistQuery } from "@/lib/query-persist";
import { installFixedOverlayAudit } from "@/lib/dev-fixed-overlay-audit";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { DailyTicketGate } from "@/components/DailyTicketGate";
import { LiveActivityAlerts } from "@/components/LiveActivityAlerts";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "BuildHub — Find work, find workers" },
      { name: "description", content: "Mobile marketplace connecting construction workers and clients in Cambodia." },
      { name: "google-site-verification", content: "YOoqpLLQz8Vzu_FBJ6FR5Ulv5IxYgytqu9uSJ5-Lrsc" },
      { name: "theme-color", content: "#1a56a0" },
      { property: "og:title", content: "BuildHub — Find work, find workers" },
      { name: "twitter:title", content: "BuildHub — Find work, find workers" },
      { property: "og:description", content: "Mobile marketplace connecting construction workers and clients in Cambodia." },
      { name: "twitter:description", content: "Mobile marketplace connecting construction workers and clients in Cambodia." },
      { property: "og:image", content: "https://buildhubkh.com/og-image-v2.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://buildhubkh.com/og-image-v2.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="km">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000, // 5 min stale-while-revalidate
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false, // realtime channels handle freshness
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );
  useEffect(() => {
    installFixedOverlayAudit();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <div className="mx-auto min-h-screen max-w-[480px] bg-background">
            <Outlet />
          </div>
          <DailyTicketGate />
           <LiveActivityAlerts />
          <Toaster position="top-center" />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="mt-2 text-muted-foreground">{t("page_not_found")}</p>
        <a href="/" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          {t("go_home")}
        </a>
      </div>
    </div>
  );
}
