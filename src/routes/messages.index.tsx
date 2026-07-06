import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { MessageListSkeleton } from "@/components/SkeletonFeed";

const REF_PREFIX = "__REF__:";
const ATT_PREFIX = "__ATT__:";

function formatPreview(content: string | null, lang: "km" | "en"): string {
  if (!content) return lang === "km" ? "សារថ្មី" : "New conversation";
  if (content.startsWith(REF_PREFIX)) {
    try {
      const ref = JSON.parse(content.slice(REF_PREFIX.length)) as { kind?: string; title?: string | null };
      const kindWord =
        ref.kind === "rental" ? (lang === "km" ? "ការជួល" : "rental")
        : ref.kind === "listing" ? (lang === "km" ? "ការងារ" : "job")
        : ref.kind === "store" ? (lang === "km" ? "ហាង" : "shop")
        : (lang === "km" ? "ផលិតផល" : "product");
      const label = lang === "km" ? `📌 កំពុងសួរអំពី${kindWord}នេះ` : `📌 Asking about this ${kindWord}`;
      return ref.title ? `${label}: ${ref.title}` : label;
    } catch {
      return lang === "km" ? "សារថ្មី" : "New conversation";
    }
  }
  if (content.startsWith(ATT_PREFIX)) {
    return lang === "km" ? "📎 ឯកសារភ្ជាប់" : "📎 Attachment";
  }
  return content;
}

export const Route = createFileRoute("/messages/")({
  component: () => (
    <RequireAuth>
      <MessagesListPage />
    </RequireAuth>
  ),
});

interface Thread {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message: string | null;
  last_message_at: string;
}
interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

function MessagesListPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [profiles, setProfiles] = useState<Record<string, OtherProfile>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      const { data } = await supabase
        .from("message_threads")
        .select("*")
        .or(`participant_a.eq.${user!.id},participant_b.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (cancelled) return;
      const ths = (data ?? []) as Thread[];
      setThreads(ths);

      const otherIds = Array.from(
        new Set(ths.map((t) => (t.participant_a === user!.id ? t.participant_b : t.participant_a))),
      );
      if (otherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", otherIds);
        if (cancelled) return;
        const map: Record<string, OtherProfile> = {};
        for (const p of profs ?? []) map[p.id] = p;
        setProfiles((prev) => ({ ...prev, ...map }));
      }

      const unreadMap: Record<string, number> = {};
      for (const th of ths) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", th.id)
          .neq("sender_id", user!.id)
          .is("read_at", null);
        if (cancelled) return;
        if (count && count > 0) unreadMap[th.id] = count;
      }
      setUnread(unreadMap);
      if (showSpinner) setLoading(false);
    }

    void load(true);

    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_threads", filter: `participant_a=eq.${user.id}` },
        () => void load(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_threads", filter: `participant_b=eq.${user.id}` },
        () => void load(false),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as {
            thread_id: string;
            sender_id: string;
            content: string | null;
            created_at: string;
          };
          let known = false;
          setThreads((prev) => {
            const idx = prev.findIndex((t) => t.id === msg.thread_id);
            if (idx === -1) return prev;
            known = true;
            const updated: Thread = {
              ...prev[idx],
              last_message: msg.content,
              last_message_at: msg.created_at,
            };
            const next = prev.slice();
            next.splice(idx, 1);
            return [updated, ...next];
          });
          if (!known) {
            // New thread we don't have yet — fall back to full load
            void load(false);
            return;
          }
          if (msg.sender_id !== user!.id) {
            setUnread((prev) => ({
              ...prev,
              [msg.thread_id]: (prev[msg.thread_id] ?? 0) + 1,
            }));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { thread_id: string; sender_id: string; read_at: string | null };
          const old = payload.old as { read_at: string | null };
          // Read receipt for messages TO the current user clears unread
          if (msg.sender_id !== user!.id && !old.read_at && msg.read_at) {
            setUnread((prev) => {
              const cur = prev[msg.thread_id] ?? 0;
              if (cur <= 0) return prev;
              const next = { ...prev };
              const dec = cur - 1;
              if (dec <= 0) delete next[msg.thread_id];
              else next[msg.thread_id] = dec;
              return next;
            });
          }
        },
      )
      .subscribe();


    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter((th) => {
      const otherId = th.participant_a === user?.id ? th.participant_b : th.participant_a;
      const name = profiles[otherId]?.full_name?.toLowerCase() ?? "";
      return name.includes(q) || formatPreview(th.last_message, lang).toLowerCase().includes(q);
    });
  }, [threads, profiles, search, user, lang]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/home" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">{t("messages")}</h1>
        <button className="rounded-full p-2 active:bg-white/10" aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
      </header>

      <div className="bg-surface p-3">
        <div className="flex h-10 items-center gap-2 rounded-pill bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_messages")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 bg-surface">
        {loading ? (
          <MessageListSkeleton count={5} />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            {t("no_messages_yet")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((th) => {
              const otherId = th.participant_a === user?.id ? th.participant_b : th.participant_a;
              const other = profiles[otherId];
              const cnt = unread[th.id] ?? 0;
              return (
                <li key={th.id}>
                  <Link
                    to="/messages/$threadId"
                    params={{ threadId: th.id }}
                    className="flex items-center gap-3 px-4 py-3 active:bg-muted"
                  >
                    <Avatar name={other?.full_name} url={other?.avatar_url} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {other?.full_name ?? "—"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {formatPreview(th.last_message, lang)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        {timeAgo(th.last_message_at, t)}
                      </span>
                      {cnt > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                          {cnt}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
            <li className="py-10 text-center text-xs text-text-hint">{t("no_more_messages")}</li>
          </ul>
        )}
      </div>
    </div>
  );
}
