import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BriefcaseBusiness, CirclePlus, Home, KeyRound, Menu, MessageCircle, Search, ShoppingBag, Store, Tag, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import logoImg from "@/assets/logo.jpg";

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
  const nav = useNavigate();
  const [postSheetOpen, setPostSheetOpen] = useState(false);

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

  const { data: myStore } = useQuery({
    queryKey: ["my-supplier-store", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("supplier_stores")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as { id: string } | null) ?? null;
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
    {
      to: myStore ? (`/suppliers/${myStore.id}` as const) : "/announce",
      label: myStore ? t("my_store") : t("nav_announce"),
      icon: myStore ? Store : CirclePlus,
      badge: 0,
      prominent: true,
    },
    { to: "/messages", label: t("messages"), icon: MessageCircle, badge: unreadMessages, prominent: false },
    { to: "/settings", label: t("menu"), icon: Menu, badge: 0, prominent: false },
  ];


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
        <Link to="/home" className="tap flex min-w-0 items-center gap-2" aria-label="BuildHub Home">
          <img src={logoImg} alt="BuildHub logo" className="h-7 w-7 shrink-0 rounded-md object-cover" />
          <span className="min-w-0">
            <span className="block truncate font-display text-[16px] font-bold leading-none">BuildHub</span>
            <span className="block truncate text-[9px] leading-tight opacity-80">Work · Workers · Materials</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link to="/search" className="tap rounded-full p-1.5 active:bg-primary-foreground/10" aria-label="Search">
            <Search className="h-5 w-5" />
          </Link>
          <Link to="/alerts" className="tap relative rounded-full p-1.5 active:bg-primary-foreground/10" aria-label={t("nav_alerts")}>
            <Bell className="h-5 w-5" />
            <UnreadBadge count={unreadAlerts} />
          </Link>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid h-[68px] max-w-[480px] grid-cols-5 border-t border-border bg-surface px-1 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_color-mix(in_oklab,var(--foreground)_8%,transparent)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const big = !!myStore && tab.prominent;
          const active = big
            ? path.startsWith(`/suppliers/${myStore.id}`)
            : tab.to === "/home"
              ? path === "/home"
              : path.startsWith(tab.to);
          const content = (
            <>
              <span
                className={`relative grid place-items-center ${
                  big
                    ? "-mt-7 h-16 w-16 rounded-full border-4 border-surface bg-primary text-primary-foreground shadow-card"
                    : tab.prominent
                      ? "-mt-5 h-12 w-12 rounded-full border-4 border-surface bg-primary text-primary-foreground shadow-card"
                      : "h-7 w-8"
                }`}
              >
                <Icon
                  className={`${big ? "h-12 w-12" : tab.prominent ? "h-7 w-7" : "h-5 w-5"} transition-transform duration-300 ${active || tab.prominent ? "text-primary" : "text-muted-foreground"} ${tab.prominent ? "text-primary-foreground" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <UnreadBadge count={tab.badge} />
              </span>
              <span
                className={`${big ? "text-[11px] font-bold" : "text-[10px] font-semibold"} transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {tab.label}
              </span>
            </>
          );
          const onTabClick = () => {
            // Tapping a tab always pulls fresh data for the page you land on.
            if (active) void handleRefresh();
            else pendingTabRefresh.current = true;
          };
          if (big) {
            // Shop owners keep the post menu here too — the sheet also links to their shop.
            return (
              <button
                key={tab.to}
                type="button"
                onClick={() => setPostSheetOpen(true)}
                className="tap relative flex min-w-0 flex-col items-center justify-center gap-0.5 pt-1"
                aria-label={tab.label}
              >
                {content}
              </button>
            );
          }
          if (tab.to === "/announce") {
            return (
              <button
                key={tab.to}
                type="button"
                onClick={() => setPostSheetOpen(true)}
                className="tap relative flex min-w-0 flex-col items-center justify-center gap-0.5 pt-1"
                aria-label={tab.label}
              >
                {content}
              </button>
            );
          }
          return (
            <Link key={tab.to} to={tab.to} onClick={onTabClick} className="tap relative flex min-w-0 flex-col items-center justify-center gap-0.5 pt-1">
              {content}
            </Link>
          );
        })}
      </nav>

      {postSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t("what_to_post")}>
          <button
            type="button"
            aria-label={t("cancel")}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            onClick={() => setPostSheetOpen(false)}
          />
          <div className="ios-sheet relative mx-auto w-full max-w-[480px] rounded-t-3xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-bold">{t("what_to_post")}</h2>
              <button type="button" onClick={() => setPostSheetOpen(false)} className="tap rounded-full p-1.5 text-muted-foreground active:bg-muted" aria-label={t("cancel")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-2">
              {([
                ...(myStore
                  ? [{ to: `/suppliers/${myStore.id}` as const, search: undefined, icon: Store, label: t("my_store"), desc: t("my_store_desc") }]
                  : []),
                { to: "/posts/new", search: undefined, icon: CirclePlus, label: t("new_post"), desc: t("post_normal_desc") },
                { to: "/rentals/new", search: undefined, icon: KeyRound, label: t("tab_rent"), desc: t("post_rent_out_desc") },
                { to: "/marketplace/new", search: { kind: "retail" }, icon: Tag, label: t("tab_retails"), desc: t("post_retail_desc") },
                { to: "/marketplace/new", search: { kind: "secondhand" }, icon: ShoppingBag, label: t("tab_secondhand"), desc: t("post_secondhand_desc") },
              ] as const).map((opt) => {
                const OptIcon = opt.icon;
                return (
                  <button
                    key={`${opt.to}-${opt.search?.kind ?? "x"}`}
                    type="button"
                    className="tap flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left active:bg-muted"
                    onClick={() => {
                      setPostSheetOpen(false);
                      void nav({ to: opt.to, search: opt.search });
                    }}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <OptIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold">{opt.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

