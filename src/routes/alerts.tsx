import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Check, MessageCircle, Star, Info } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";

/** Localize a notification by kind. Falls back to stored title/body when unknown. */
function localizeNotif(
  n: { kind: string; title: string; body: string | null; related_user?: { full_name: string | null } | null },
  lang: Lang,
): { title: string; body: string | null } {
  const name = n.related_user?.full_name ?? "";
  const map: Record<string, { title: { km: string; en: string }; body?: { km: string; en: string } }> = {
    application: {
      title: { km: `${name} បានដាក់ពាក្យសុំធ្វើគម្រោងរបស់អ្នក`, en: `${name} applied to your project` },
    },
    accepted: {
      title: { km: "អ្នកត្រូវបានទទួលយកសម្រាប់គម្រោងមួយ", en: "You were accepted for a project" },
    },
    project_request: {
      title: { km: `${name} ចង់ចាប់ផ្តើមគម្រោងជាមួយអ្នក`, en: `${name} wants to start a project with you` },
    },
    project_accepted: {
      title: { km: `${name} បានទទួលយកគម្រោងរបស់អ្នក`, en: `${name} accepted your project` },
    },
    project_completed: {
      title: { km: "គម្រោងត្រូវបានសម្គាល់ថាបញ្ចប់", en: "Project marked completed" },
    },
    project_completion_request: {
      title: { km: "ស្នើបញ្ចប់គម្រោង — សូមបញ្ជាក់", en: "Project finish requested — please confirm" },
    },
    like: {
      title: { km: `${name} បានចូលចិត្តការបង្ហោះរបស់អ្នក`, en: `${name} liked your post` },
    },
    comment: {
      title: { km: `${name} បានបញ្ចេញមតិលើការបង្ហោះរបស់អ្នក`, en: `${name} commented on your post` },
    },
    comment_like: {
      title: { km: `${name} បានចូលចិត្តមតិរបស់អ្នក`, en: `${name} liked your comment` },
    },
    reply: {
      title: { km: `${name} បានឆ្លើយតបមតិរបស់អ្នក`, en: `${name} replied to your comment` },
    },
    message: {
      title: { km: `សារថ្មីពី ${name}`, en: `New message from ${name}` },
    },
    new_listing: {
      title: { km: `${name} បានបង្ហោះការផ្សាយថ្មី`, en: `${name} posted a new listing` },
    },
    rental_approved: {
      title: { km: "ការជួលរបស់អ្នកត្រូវបានអនុម័ត", en: "Your rental was approved" },
    },
    lottery_win: {
      title: { km: "🎉 អ្នកបានឈ្នះការចាប់ឆ្នោតប្រចាំថ្ងៃ!", en: "🎉 You won the daily draw!" },
      body: { km: "ទាមទារក្នុងរយៈពេល ៤៨ ម៉ោង · រង្វាន់ប្រចាំថ្ងៃ $1", en: "Claim within 48 hours · $1 Daily Prize" },
    },
    material_available: {
      title: { km: "អ្នកផ្គត់ផ្គង់មានទំនិញដែលអ្នកស្វែងរក", en: "A supplier has the item you need" },
      body: { km: "ចុចដើម្បីជជែកជាមួយអ្នកផ្គត់ផ្គង់", en: "Tap to chat with the supplier" },
    },
    help_request: {
      title: { km: `សំណើជំនួយឥតគិតថ្លៃពី ${name}`, en: `Free help request from ${name}` },
    },
    help_request_sent: {
      title: { km: "សំណើជំនួយឥតគិតថ្លៃរបស់អ្នកត្រូវបានផ្ញើ", en: "Your free help request was sent" },
      body: { km: "អ្នកគ្រប់គ្រងនឹងទាក់ទងអ្នកក្នុងពេលឆាប់ៗ។", en: "An admin will contact you shortly." },
    },
  };
  const entry = map[n.kind];
  if (!entry) return { title: n.title, body: n.body };
  return {
    title: entry.title[lang],
    body: entry.body ? entry.body[lang] : n.body,
  };
}

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
  const qc = useQueryClient();
  const [items, setItems] = useState<Notif[]>([]);

  useQuery({
    queryKey: ["notifications", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, user_id, kind, title, body, related_user_id, related_listing_id, related_post_id, read_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
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
      return true;
    },
  });

  useEffect(() => {
    if (!user) return;
    const inv = () => qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    const ch = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, inv)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

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
  const { user } = useAuth();
  const { lang } = useI18n();
  const nav = useNavigate();
  const [opening, setOpening] = useState(false);
  const loc = localizeNotif(n, lang);
  const Icon =
    n.kind === "application" || n.kind === "accepted"
      ? Check
      : n.kind === "message" || n.kind === "help_request"
        ? MessageCircle
        : n.kind === "new_listing"
          ? Star
          : Info;
  const iconBg =
    n.kind === "application" || n.kind === "accepted"
      ? "bg-primary text-primary-foreground"
      : n.kind === "message" || n.kind === "help_request"
        ? "bg-success text-white"
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
        <span className="font-semibold">{loc.title}</span>
        {loc.body && <span> {loc.body}</span>}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at, t)}</p>
    </div>
  );

  const cls = `flex items-start gap-3 border-b border-border px-4 py-3 ${
    highlighted ? "bg-primary/5" : ""
  }`;

  async function openChatWith(otherId: string) {
    if (!user || opening) return;
    if (user.id === otherId) return;
    setOpening(true);
    try {
      const [a, b] = [user.id, otherId].sort();
      const { data: existing } = await supabase
        .from("message_threads")
        .select("id")
        .eq("participant_a", a)
        .eq("participant_b", b)
        .maybeSingle();
      let threadId = existing?.id;
      if (!threadId) {
        const { data: created, error } = await supabase
          .from("message_threads")
          .insert({ participant_a: a, participant_b: b })
          .select("id")
          .single();
        if (error) throw error;
        threadId = created.id;
      }
      nav({ to: "/messages/$threadId", params: { threadId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setOpening(false);
    }
  }

  // help_request (admin notification): clicking opens chat with the requester
  if (n.kind === "help_request" && n.related_user_id) {
    return (
      <button onClick={() => void openChatWith(n.related_user_id!)} className={`${cls} w-full text-left active:opacity-60`}>
        {avatar}
        {body}
        {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </button>
    );
  }

  // Material request fan-out → supplier panel
  if (n.kind === "material_request") {
    return (
      <Link to="/online-orders" className={`${cls} active:opacity-60`}>
        {avatar}
        {body}
        {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </Link>
    );
  }
  // Supplier said "I have it" → open chat with supplier
  if (n.kind === "material_available" && n.related_user_id) {
    return (
      <button onClick={() => void openChatWith(n.related_user_id!)} className={`${cls} w-full text-left active:opacity-60`}>
        {avatar}
        {body}
        {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </button>
    );
  }
  // Anonymous "Sorry" → just go to my searches
  if (n.kind === "material_unavailable") {
    return (
      <Link to="/find-material/mine" className={`${cls} active:opacity-60`}>
        {avatar}
        {body}
        {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </Link>
    );
  }

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
