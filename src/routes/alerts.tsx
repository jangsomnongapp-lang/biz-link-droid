import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Check, MessageCircle, Star, Info } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/alerts")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <AlertsPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  related_user_id: string | null;
  related_post_id: string | null;
  related_listing_id: string | null;
  read_at: string | null;
  created_at: string;
  related_user?: { full_name: string | null; avatar_url: string | null } | null;
}

function AlertsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Notif[];
      const userIds = Array.from(new Set(rows.map((r) => r.related_user_id).filter(Boolean) as string[]));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const r of rows) {
          if (r.related_user_id && map.has(r.related_user_id)) {
            const p = map.get(r.related_user_id)!;
            r.related_user = { full_name: p.full_name, avatar_url: p.avatar_url };
          }
        }
      }
      setItems(rows);
    })();
  }, [user]);

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    setItems((arr) => arr.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  }

  const unread = items.filter((n) => !n.read_at);
  const read = items.filter((n) => n.read_at);

  return (
    <div>
      <header className="flex h-12 items-center justify-between bg-primary px-4 text-primary-foreground">
        <h2 className="text-base font-semibold">{t("notifications")}</h2>
        {unread.length > 0 && (
          <button onClick={() => void markAllRead()} className="text-xs font-semibold">
            {t("mark_all_read")}
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="px-6 py-20 text-center text-sm text-muted-foreground">{t("no_notifications")}</div>
      ) : (
        <div className="bg-surface">
          {unread.length > 0 && <SectionLabel title={t("new_section")} />}
          {unread.map((n) => (
            <NotifRow key={n.id} n={n} t={t} highlighted />
          ))}
          {read.length > 0 && <SectionLabel title={t("earlier")} />}
          {read.map((n) => (
            <NotifRow key={n.id} n={n} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="bg-background px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </div>
  );
}

function NotifRow({ n, t, highlighted }: { n: Notif; t: ReturnType<typeof useI18n>["t"]; highlighted?: boolean }) {
  const Icon =
    n.kind === "application" || n.kind === "accepted"
      ? Check
      : n.kind === "message"
        ? MessageCircle
        : n.kind === "new_listing"
          ? Star
          : Info;
  const iconBg =
    n.kind === "application" || n.kind === "accepted"
      ? "bg-primary text-primary-foreground"
      : n.kind === "message"
        ? "bg-success text-white"
        : n.kind === "new_listing"
          ? "bg-warning text-white"
          : "bg-warning text-white";

  const avatar = (
    <div className="relative">
      <Avatar name={n.related_user?.full_name} url={n.related_user?.avatar_url} size={40} />
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface ${iconBg}`}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    </div>
  );

  const body = (
    <div className="min-w-0 flex-1">
      <p className="text-sm leading-snug text-foreground">
        <span className="font-semibold">{n.title}</span>
        {n.body && <span> {n.body}</span>}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at, t)}</p>
    </div>
  );

  const cls = `flex items-start gap-3 border-b border-border px-4 py-3 ${
    highlighted ? "bg-primary/5" : ""
  }`;

  return (
    <div className={cls}>
      {n.related_user_id ? (
        <Link to="/users/$userId" params={{ userId: n.related_user_id }} className="active:opacity-60">
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      {n.related_post_id ? (
        <Link to="/home" search={{ post: n.related_post_id }} className="min-w-0 flex-1 active:opacity-60">
          {body}
        </Link>
      ) : n.related_listing_id ? (
        <Link to="/listings/$listingId" params={{ listingId: n.related_listing_id }} className="min-w-0 flex-1 active:opacity-60">
          {body}
        </Link>
      ) : n.related_user_id ? (
        <Link to="/users/$userId" params={{ userId: n.related_user_id }} className="min-w-0 flex-1 active:opacity-60">
          {body}
        </Link>
      ) : (
        body
      )}
      {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </div>
  );
}
