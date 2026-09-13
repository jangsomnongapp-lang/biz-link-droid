import { Link, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Home, Newspaper, Bell, User, Menu, Search, MessageCircle, Store } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";

// Remembers where the user was on each page so going back lands in the same spot.
const scrollMemory = new Map<string, number>();

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}


export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [mySupplierStoreId, setMySupplierStoreId] = useState<string | null>(null);
  const qc = useQueryClient();

  async function handleRefresh() {
    // Only refresh what is on screen right now — other pages keep their data.
    await qc.invalidateQueries({ type: "active" });
  }

  // Save the position while scrolling, and put it back when returning to a page.
  useEffect(() => {
    const key = path;
    let raf = 0;
    let tries = 0;
    const target = scrollMemory.get(key) ?? 0;
    const restore = () => {
      window.scrollTo(0, target);
      tries += 1;
      if (tries < 20 && Math.abs(window.scrollY - target) > 2) {
        raf = requestAnimationFrame(restore);
      }
    };
    if (target > 0) raf = requestAnimationFrame(restore);

    const onScroll = () => {
      scrollMemory.set(key, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [path]);


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

  const { data: unreadAlerts = 0 } = useQuery({
    queryKey: ["unread-alerts", user?.id ?? null],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages", user?.id ?? null],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("unread_message_count", { _user_id: user!.id });
      return (data as number | null) ?? 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    const inv = () => {
      qc.invalidateQueries({ queryKey: ["unread-alerts", user.id] });
      qc.invalidateQueries({ queryKey: ["unread-messages", user.id] });
    };
    const ch = supabase
      .channel(`appshell-unread:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, inv)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  const tabs = [
    { to: "/home", label: t("nav_home"), icon: Home, badge: 0 },
    { to: "/listings", label: t("nav_listings"), icon: Newspaper, badge: 0 },
    { to: "/suppliers", label: t("nav_suppliers"), icon: Store, badge: 0 },
    { to: "/alerts", label: t("nav_alerts"), icon: Bell, badge: unreadAlerts },
    { to: "/profile", label: t("nav_profile"), icon: User, badge: 0 },
  ] as const;


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-primary px-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <Link to="/settings" className="tap rounded-full p-2 active:bg-white/10" aria-label="Menu">
            <Menu className="h-6 w-6" />
          </Link>
          <span className="text-lg font-bold">{t("app_name")}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/search" className="tap rounded-full p-2 active:bg-white/10" aria-label="Search">
            <Search className="h-5 w-5" />
          </Link>
          <Link to="/messages" className="tap relative rounded-full p-2 active:bg-white/10" aria-label="Messages">
            <MessageCircle className="h-5 w-5" />
            <UnreadBadge count={unreadMessages} />
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
              <span className="relative">
                <Icon
                  className={`h-5 w-5 transition-transform duration-300 ${active ? "scale-110 text-primary" : "text-muted-foreground"}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <UnreadBadge count={tab.badge} />
              </span>
              <span className={`text-[10px] font-medium transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
              {active && <span className="ios-fade absolute bottom-0 h-0.5 w-10 rounded-full bg-primary" />}
            </>
          );
          return isSupplierProfileTab ? (
            <Link
              key={tab.to}
              to="/suppliers/$storeId"
              params={{ storeId: mySupplierStoreId! }}
              className="tap relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              {content}
            </Link>
          ) : (
            <Link
              key={tab.to}
              to={tab.to}
              className="tap relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 pb-4">
        <PullToRefresh onRefresh={handleRefresh}>
          <div key={path} className="ios-page">
            {children}
          </div>
        </PullToRefresh>
      </main>
    </div>
  );
}

