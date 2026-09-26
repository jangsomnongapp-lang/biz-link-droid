import { Link, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BriefcaseBusiness, CirclePlus, HardHat, Home, Menu, MessageCircle, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const qc = useQueryClient();

  async function handleRefresh() {
    // Only refresh what is on screen right now — other pages keep their data.
    await qc.invalidateQueries({ type: "active" });
  }

  // A tab tap marks a refresh; it runs once the destination page has mounted.
  const pendingTabRefresh = useRef(false);
  useEffect(() => {
    if (!pendingTabRefresh.current) return;
    pendingTabRefresh.current = false;
    const id = setTimeout(() => void handleRefresh(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

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


  const { data: unreadAlerts = 0 } = useQuery({
    queryKey: ["unread-alerts", user?.id ?? null],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages", user?.id ?? null],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase.rpc("unread_message_count", { _user_id: user.id });
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
    { to: "/home", label: t("nav_home"), icon: Home, badge: 0, prominent: false },
    { to: "/listings", label: t("nav_listings"), icon: BriefcaseBusiness, badge: 0, prominent: false },
    { to: "/announce", label: t("nav_announce"), icon: CirclePlus, badge: 0, prominent: true },
    { to: "/messages", label: t("messages"), icon: MessageCircle, badge: unreadMessages, prominent: false },
    { to: "/settings", label: t("menu"), icon: Menu, badge: 0, prominent: false },
  ] as const;


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 grid min-h-[74px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-primary px-4 pb-3 pt-safe-top text-primary-foreground shadow-sm">
        <Link to="/home" className="tap flex min-w-0 items-center gap-2.5" aria-label="BuildHub Home">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-foreground text-primary">
            <HardHat className="h-7 w-7" strokeWidth={2.5} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[22px] font-bold leading-6">BuildHub</span>
            <span className="block truncate text-[10px] font-medium leading-4 opacity-85">Build · Work · Supply · Grow</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Link to="/search" className="tap rounded-full p-2 active:bg-primary-foreground/10" aria-label="Search">
            <Search className="h-6 w-6" />
          </Link>
          <Link to="/alerts" className="tap relative rounded-full p-2 active:bg-primary-foreground/10" aria-label={t("nav_alerts")}>
            <Bell className="h-6 w-6" />
            <UnreadBadge count={unreadAlerts} />
          </Link>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid h-[68px] max-w-[480px] grid-cols-5 border-t border-border bg-surface px-1 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_color-mix(in_oklab,var(--foreground)_8%,transparent)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.to === "/home" ? path === "/home" : path.startsWith(tab.to);
          const content = (
            <>
              <span className={`relative grid place-items-center ${tab.prominent ? "-mt-5 h-12 w-12 rounded-full border-4 border-surface bg-primary text-primary-foreground shadow-card" : "h-7 w-8"}`}>
                <Icon
                  className={`${tab.prominent ? "h-7 w-7" : "h-5 w-5"} transition-transform duration-300 ${active || tab.prominent ? "text-primary" : "text-muted-foreground"} ${tab.prominent ? "text-primary-foreground" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <UnreadBadge count={tab.badge} />
              </span>
              <span className={`text-[10px] font-semibold transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </>
          );
          const onTabClick = () => {
            // Tapping a tab always pulls fresh data for the page you land on.
            if (active) void handleRefresh();
            else pendingTabRefresh.current = true;
          };
          return (
            <Link key={tab.to} to={tab.to} onClick={onTabClick} className="tap relative flex min-w-0 flex-col items-center justify-center gap-0.5 pt-1">
              {content}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 pb-[76px]">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="ios-page">
            {children}
          </div>
        </PullToRefresh>
      </main>
    </div>
  );
}

