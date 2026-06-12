import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Send, Heart, CornerDownRight, Pencil, Trash2, Check } from "lucide-react";
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
  parent_id: string | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface LikeState {
  count: number;
  mine: boolean;
}

export function RentalCommentsSheet({
  rentalId,
  onClose,
  onCountChange,
}: {
  rentalId: string;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<CommentRow[]>([]);
  const [likes, setLikes] = useState<Record<string, LikeState>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function deleteComment(id: string) {
    if (!confirm(t("delete_confirm_desc"))) return;
    const { error } = await supabase.from("rental_comments").delete().eq("id", id);
    if (error) {
      toast.error(t("delete_failed"));
      return;
    }
    const next = items.filter((c) => c.id !== id && c.parent_id !== id);
    setItems(next);
    onCountChange?.(next.length);
  }

  async function saveEdit(id: string) {
    const content = editText.trim();
    if (!content) return;
    const { error } = await supabase
      .from("rental_comments")
      .update({ content })
      .eq("id", id);
    if (error) {
      toast.error(t("error_generic"));
      return;
    }
    setItems((arr) => arr.map((c) => (c.id === id ? { ...c, content } : c)));
    setEditingId(null);
  }

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("rental_comments")
        .select("id, content, created_at, user_id, parent_id, profiles(full_name, avatar_url)")
        .eq("rental_id", rentalId)
        .order("created_at", { ascending: true });
      const rows = (data as CommentRow[] | null) ?? [];
      setItems(rows);
      onCountChange?.(rows.length);
      setLoading(false);

      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: likeRows } = await supabase
          .from("rental_comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", ids);
        const map: Record<string, LikeState> = {};
        for (const id of ids) map[id] = { count: 0, mine: false };
        for (const r of likeRows ?? []) {
          const e = map[r.comment_id];
          if (!e) continue;
          e.count += 1;
          if (user && r.user_id === user.id) e.mine = true;
        }
        setLikes(map);
      }
    })();
  }, [rentalId, user, onCountChange]);

  const { tops, repliesByParent } = useMemo(() => {
    const tops: CommentRow[] = [];
    const repliesByParent = new Map<string, CommentRow[]>();
    for (const c of items) {
      if (c.parent_id) {
        const arr = repliesByParent.get(c.parent_id) ?? [];
        arr.push(c);
        repliesByParent.set(c.parent_id, arr);
      } else {
        tops.push(c);
      }
    }
    return { tops, repliesByParent };
  }, [items]);

  async function send() {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    const { data, error } = await supabase
      .from("rental_comments")
      .insert({
        rental_id: rentalId,
        user_id: user.id,
        content,
        parent_id: replyTo?.id ?? null,
      })
      .select("id, content, created_at, user_id, parent_id, profiles(full_name, avatar_url)")
      .single();
    setSending(false);
    if (error || !data) {
      toast.error(t("error_generic"));
      return;
    }
    setText("");
    setReplyTo(null);
    const next = [...items, data as CommentRow];
    setItems(next);
    setLikes((m) => ({ ...m, [(data as CommentRow).id]: { count: 0, mine: false } }));
    onCountChange?.(next.length);
  }

  async function toggleLike(commentId: string) {
    if (!user) return;
    const cur = likes[commentId] ?? { count: 0, mine: false };
    setLikes((m) => ({
      ...m,
      [commentId]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine },
    }));
    if (cur.mine) {
      const { error } = await supabase
        .from("rental_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      if (error) setLikes((m) => ({ ...m, [commentId]: cur }));
    } else {
      const { error } = await supabase
        .from("rental_comment_likes")
        .insert({ comment_id: commentId, user_id: user.id });
      if (error) setLikes((m) => ({ ...m, [commentId]: cur }));
    }
  }

  function renderComment(c: CommentRow, isReply = false) {
    const l = likes[c.id] ?? { count: 0, mine: false };
    return (
      <li key={c.id} className={`flex gap-2.5 ${isReply ? "ml-10" : ""}`}>
        <Link
          to="/users/$userId"
          params={{ userId: c.user_id }}
          onClick={onClose}
          className="active:opacity-60"
        >
          <Avatar
            name={c.profiles?.full_name}
            url={c.profiles?.avatar_url}
            size={isReply ? 26 : 32}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-muted px-3 py-2">
            <Link
              to="/users/$userId"
              params={{ userId: c.user_id }}
              onClick={onClose}
              className="text-xs font-semibold active:opacity-60"
            >
              {c.profiles?.full_name ?? "User"}
            </Link>
            {editingId === c.id ? (
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveEdit(c.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-7 flex-1 rounded-full border border-border bg-background px-3 text-sm outline-none focus:border-[#534AB7]"
                />
                <button
                  onClick={() => void saveEdit(c.id)}
                  className="rounded-full bg-[#534AB7] p-1 text-white active:scale-95"
                  aria-label="Save"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-full bg-muted-foreground/20 p-1 active:scale-95"
                  aria-label="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-0.5 text-sm leading-snug">{c.content}</div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 pl-3 text-[11px] text-muted-foreground">
            <span>{timeAgo(c.created_at, t)}</span>
            <button
              onClick={() => void toggleLike(c.id)}
              className={`flex items-center gap-1 font-medium active:opacity-60 ${
                l.mine ? "text-[#534AB7]" : ""
              }`}
            >
              <Heart className="h-3 w-3" fill={l.mine ? "currentColor" : "none"} />
              {l.count > 0 ? l.count : t("like")}
            </button>
            {!isReply && (
              <button
                onClick={() => setReplyTo(c)}
                className="font-medium active:opacity-60"
              >
                {t("reply")}
              </button>
            )}
            {user?.id === c.user_id && editingId !== c.id && (
              <>
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setEditText(c.content);
                  }}
                  className="flex items-center gap-0.5 font-medium active:opacity-60"
                >
                  <Pencil className="h-3 w-3" /> {t("edit")}
                </button>
                <button
                  onClick={() => void deleteComment(c.id)}
                  className="flex items-center gap-0.5 font-medium text-destructive active:opacity-60"
                >
                  <Trash2 className="h-3 w-3" /> {t("delete")}
                </button>
              </>
            )}
          </div>
        </div>
      </li>
    );
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
          ) : tops.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t("no_comments")}</div>
          ) : (
            <ul className="space-y-3">
              {tops.map((c) => (
                <div key={c.id} className="space-y-2">
                  {renderComment(c)}
                  {(repliesByParent.get(c.id) ?? []).map((r) => renderComment(r, true))}
                </div>
              ))}
            </ul>
          )}
        </div>

        {replyTo && (
          <div className="flex items-center gap-2 border-t border-border bg-muted px-3 py-1.5 text-xs">
            <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 truncate text-muted-foreground">
              {t("replying_to")} <strong>{replyTo.profiles?.full_name ?? "User"}</strong>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="rounded-full p-1 active:bg-background"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder={replyTo ? t("write_reply") : t("write_comment")}
            className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-[#534AB7]"
          />
          <button
            onClick={() => void send()}
            disabled={!text.trim() || sending}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#534AB7] text-white active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
