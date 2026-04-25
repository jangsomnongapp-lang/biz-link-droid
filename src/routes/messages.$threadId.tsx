import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MoreHorizontal, Paperclip, Send } from "lucide-react";

export const Route = createFileRoute("/messages/$threadId")({
  component: () => (
    <RequireAuth>
      <ConversationPage />
    </RequireAuth>
  ),
});

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}
interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

function ConversationPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { threadId } = useParams({ from: "/messages/$threadId" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: thread } = await supabase
        .from("message_threads")
        .select("participant_a, participant_b")
        .eq("id", threadId)
        .maybeSingle();
      if (!thread) return;
      const otherId = thread.participant_a === user.id ? thread.participant_b : thread.participant_a;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      setOther(profile);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Message[]);

      // Mark received messages as read
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    })();

    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as Message]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    if (!user || !text.trim()) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ thread_id: threadId, sender_id: user.id, content });
    if (error) {
      setText(content);
    }
    setSending(false);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-primary px-2 text-primary-foreground">
        <Link to="/messages" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar name={other?.full_name} url={other?.avatar_url} size={36} />
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold">{other?.full_name ?? "—"}</div>
          <div className="text-[11px] text-white/80">{t("online")}</div>
        </div>
        <button className="rounded-full p-2 active:bg-white/10" aria-label="More">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        <div className="mx-auto w-fit rounded-pill bg-muted px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
          {t("today")}
        </div>
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-surface text-foreground shadow-card"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div
                  className={`mt-0.5 text-right text-[10px] ${
                    mine ? "text-white/75" : "text-muted-foreground"
                  }`}
                >
                  {time}
                  {mine && (m.read_at ? " ✓✓" : " ✓")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-surface p-2">
        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 text-muted-foreground active:bg-muted" aria-label="Attach">
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={t("write_message")}
            className="h-10 flex-1 rounded-pill bg-background px-4 text-sm outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-50"
            aria-label={t("send")}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
