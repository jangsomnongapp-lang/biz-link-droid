import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Heart, MessageCircle, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

type AlertContent = {
  avatarUrl: string | null;
  body: string | null;
  kind: string;
  name: string;
  title: string;
  onOpen: () => void;
};

export function LiveActivityAlerts() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    async function getProfile(userId: string | null) {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      return data;
    }

    function showAlert(content: AlertContent) {
      const Icon = content.kind === "message"
        ? MessageCircle
        : content.kind === "like" || content.kind === "comment_like"
          ? Heart
          : content.kind === "comment" || content.kind === "reply"
            ? MessageSquareText
            : Bell;

      toast.custom(
        (toastId) => (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              toast.dismiss(toastId);
              content.onOpen();
            }}
            className="h-auto w-[min(calc(100vw-1.5rem),456px)] justify-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left shadow-lg hover:bg-accent"
          >
            <div className="relative shrink-0">
              <Avatar name={content.name} url={content.avatarUrl} size={42} />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                <Icon className="h-3 w-3" />
              </span>
            </div>
            <span className="min-w-0 flex-1 whitespace-normal">
              <span className="block truncate text-sm font-semibold text-foreground">{content.title}</span>
              {content.body && (
                <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{content.body}</span>
              )}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-primary">
              {lang === "km" ? "ឥឡូវនេះ" : "Now"}
            </span>
          </Button>
        ),
        { duration: 4_000 },
      );
    }

    async function handleNotification(notification: Notification) {
      if (notification.user_id !== userId || notification.kind === "message") return;
      const profile = await getProfile(notification.related_user_id);
      const name = profile?.full_name ?? (lang === "km" ? "នរណាម្នាក់" : "Someone");
      const titleByKind: Record<string, string> = {
        like: lang === "km" ? `${name} បានចូលចិត្តការបង្ហោះរបស់អ្នក` : `${name} liked your post`,
        comment: lang === "km" ? `${name} បានបញ្ចេញមតិលើការបង្ហោះរបស់អ្នក` : `${name} commented on your post`,
        comment_like: lang === "km" ? `${name} បានចូលចិត្តមតិរបស់អ្នក` : `${name} liked your comment`,
        reply: lang === "km" ? `${name} បានឆ្លើយតបមតិរបស់អ្នក` : `${name} replied to your comment`,
      };

      showAlert({
        avatarUrl: profile?.avatar_url ?? null,
        body: notification.body,
        kind: notification.kind,
        name,
        title: titleByKind[notification.kind] ?? notification.title,
        onOpen: () => {
          if (notification.related_post_id) {
            void navigate({ to: "/home", search: { post: notification.related_post_id } });
          } else if (notification.related_listing_id) {
            void navigate({ to: "/listings/$listingId", params: { listingId: notification.related_listing_id } });
          } else {
            void navigate({ to: "/alerts" });
          }
        },
      });
    }

    async function handleMessage(message: Message) {
      if (message.sender_id === userId) return;
      const { data: thread } = await supabase
        .from("message_threads")
        .select("participant_a, participant_b")
        .eq("id", message.thread_id)
        .maybeSingle();
      if (!thread || (thread.participant_a !== userId && thread.participant_b !== userId)) return;

      const profile = await getProfile(message.sender_id);
      const name = profile?.full_name ?? (lang === "km" ? "នរណាម្នាក់" : "Someone");
      showAlert({
        avatarUrl: profile?.avatar_url ?? null,
        body: message.content,
        kind: "message",
        name,
        title: lang === "km" ? `សារថ្មីពី ${name}` : `New message from ${name}`,
        onOpen: () => void navigate({ to: "/messages/$threadId", params: { threadId: message.thread_id } }),
      });
    }

    const channel = supabase
      .channel(`live-activity-alerts:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => void handleNotification(payload.new as Notification),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => void handleMessage(payload.new as Message),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [lang, navigate, user]);

  return null;
}