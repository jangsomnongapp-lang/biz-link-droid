import { Link, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Home, Newspaper, Bell, User, Menu, Search, MessageCircle, Store } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [mySupplierStoreId, setMySupplierStoreId] = useState<string | null>(null);
  const qc = useQueryClient();

  async function handleRefresh() {
    await qc.invalidateQueries();
  }

  useEffect(() => {
    if (!user) {
      setMySupplierStoreId(null);
      return;
    }
    void supabase
      .from("supplier_stores")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMySupplierStoreId(data?.id ?? null));
  }, [user]);

  const tabs = [
    { to: "/home", label: t("nav_home"), icon: Home },
    { to: "/listings", label: t("nav_listings"), icon: Newspaper },
    { to: "/suppliers", label: t("nav_suppliers"), icon: Store },
    { to: "/alerts", label: t("nav_alerts"), icon: Bell },
    { to: "/profile", label: t("nav_profile"), icon: User },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-primary px-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <Link to="/settings" className="rounded-full p-2 active:bg-white/10" aria-label="Menu">
            <Menu className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-bold">{t("app_name")}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/listings/new" className="rounded-full p-2 active:bg-white/10" aria-label="New">
            <Plus className="h-5 w-5" />
          </Link>
          <Link to="/search" className="rounded-full p-2 active:bg-white/10" aria-label="Search">
            <Search className="h-5 w-5" />
          </Link>
          <Link to="/messages" className="relative rounded-full p-2 active:bg-white/10" aria-label="Messages">
            <MessageCircle className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          </Link>
        </div>
      </header>

      <nav className="sticky top-14 z-20 flex border-b border-border bg-surface">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSupplierProfileTab = tab.to === "/profile" && !!mySupplierStoreId;
          const active = isSupplierProfileTab
            ? path === "/profile" || path.startsWith(`/suppliers/${mySupplierStoreId}`)
            : tab.to === "/home"
              ? path === "/home"
              : path.startsWith(tab.to);
          const content = (
            <>
              <Icon
                className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
              {active && <span className="absolute bottom-0 h-0.5 w-10 rounded-full bg-primary" />}
            </>
          );
          return isSupplierProfileTab ? (
            <Link
              key={tab.to}
              to="/suppliers/$storeId"
              params={{ storeId: mySupplierStoreId! }}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              {content}
            </Link>
          ) : (
            <Link
              key={tab.to}
              to={tab.to}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 pb-4">
        <PullToRefresh onRefresh={handleRefresh}>{children}</PullToRefresh>
      </main>
    </div>
  );
}
