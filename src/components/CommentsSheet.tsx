import { useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { toast } from "sonner";

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export function CommentsSheet({
  postId,
  onClose,
  onCountChange,
}: {
  postId: string;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from("post_comments")
      .select("id, content, created_at, user_id, profiles(full_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const rows = (data as CommentRow[] | null) ?? [];
        setItems(rows);
        setLoading(false);
        onCountChange?.(rows.length);
      });
  }, [postId, onCountChange]);

  async function send() {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: user.id, content })
      .select("id, content, created_at, user_id, profiles(full_name, avatar_url)")
      .single();
    setSending(false);
    if (error || !data) {
      toast.error(t("error_generic"));
      return;
    }
    setText("");
    const next = [...items, data as CommentRow];
    setItems(next);
    onCountChange?.(next.length);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-[80vh] flex-col rounded-t-2xl bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold">{t("comments")}</h3>
          <button onClick={onClose} className="rounded-full p-1 active:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">{t("loading")}</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t("no_comments")}</div>
          ) : (
            <ul className="space-y-3">
              {items.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar name={c.profiles?.full_name} url={c.profiles?.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl bg-muted px-3 py-2">
                      <div className="text-xs font-semibold">{c.profiles?.full_name ?? "User"}</div>
                      <div className="mt-0.5 text-sm leading-snug">{c.content}</div>
                    </div>
                    <div className="mt-1 pl-3 text-[11px] text-muted-foreground">
                      {timeAgo(c.created_at, t)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder={t("write_comment")}
            className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => void send()}
            disabled={!text.trim() || sending}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
