import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "JangSomnong — Find work, find workers" },
      { name: "description", content: "Mobile marketplace connecting construction workers and clients in Cambodia." },
      { name: "theme-color", content: "#1a56a0" },
      { property: "og:title", content: "JangSomnong — Find work, find workers" },
      { name: "twitter:title", content: "JangSomnong — Find work, find workers" },
      { property: "og:description", content: "Mobile marketplace connecting construction workers and clients in Cambodia." },
      { name: "twitter:description", content: "Mobile marketplace connecting construction workers and clients in Cambodia." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4bee9fe9-819f-4655-8038-eec0e6922dd8/id-preview-ea719801--257d13d8-9587-4c64-8336-982de107664d.lovable.app-1777085545837.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4bee9fe9-819f-4655-8038-eec0e6922dd8/id-preview-ea719801--257d13d8-9587-4c64-8336-982de107664d.lovable.app-1777085545837.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
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
  return (
    <I18nProvider>
      <AuthProvider>
        <div className="mx-auto min-h-screen max-w-[480px] bg-background">
          <Outlet />
        </div>
        <Toaster position="top-center" />
      </AuthProvider>
    </I18nProvider>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <a href="/" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Go home
        </a>
      </div>
    </div>
  );
}
