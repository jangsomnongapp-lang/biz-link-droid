import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, Bot } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/telegram")({
  component: () => (
    <RequireAuth>
      <AdminTelegramPage />
    </RequireAuth>
  ),
});

function AdminTelegramPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [chatId, setChatId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      const admin = !!prof?.is_admin;
      setIsAdmin(admin);
      if (!admin) return;

      // Note: telegram_webhook_secret is intentionally NOT selected — it is hidden
      // from client roles. Admins can rotate it by entering a new value below.
      const { data } = await supabase
        .from("app_settings")
        .select("telegram_chat_id, telegram_webhook_url")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setChatId(data.telegram_chat_id ?? "");
        setWebhookUrl(
          data.telegram_webhook_url ?? `${window.location.origin}/api/public/telegram-notify`
        );
      } else {
        setWebhookUrl(`${window.location.origin}/api/public/telegram-notify`);
      }
    })();
  }, [user]);

  function genSecret() {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    setSecret(
      Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        id: 1,
        telegram_chat_id: chatId.trim() || null,
        telegram_webhook_url: webhookUrl.trim() || null,
        telegram_webhook_secret: secret.trim() || null,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
  }

  async function sendTest() {
    if (!webhookUrl || !secret) {
      toast.error("Save URL & secret first");
      return;
    }
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": secret,
        },
        body: JSON.stringify({
          kind: "post",
          chat_id: chatId,
          data: { user_name: "Test bot", status: "test", content: "Hello from admin panel ✅" },
        }),
      });
      if (!res.ok) {
        toast.error(`Failed: ${await res.text()}`);
        return;
      }
      toast.success("Test sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (isAdmin === false) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Admins only.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-10">
      <header className="bg-primary px-3 pb-4 pt-3 text-primary-foreground">
        <div className="flex h-10 items-center">
          <button
            onClick={() => nav({ to: "/settings" })}
            className="rounded-full p-2 active:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">Telegram notifications</h1>
          <span className="w-9" />
        </div>
      </header>

      <main className="space-y-4 px-4 py-4">
        <div className="flex items-start gap-3 rounded-xl bg-surface p-3 shadow-card">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100">
            <Bot className="h-4 w-4 text-sky-600" />
          </div>
          <p className="flex-1 text-xs text-muted-foreground">
            Configure where new reports, posts, stories and projects are forwarded.
            Add the bot to your Telegram group as admin, then paste the group chat ID below.
          </p>
        </div>

        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-card">
          <label className="block">
            <span className="text-xs font-bold tracking-wider text-muted-foreground">Group chat ID</span>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold tracking-wider text-muted-foreground">Webhook URL</span>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Use the published URL for production, e.g. https://your-app.lovable.app/api/public/telegram-notify
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-bold tracking-wider text-muted-foreground">Webhook secret</span>
            <div className="mt-1 flex gap-2">
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="shared secret"
                className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={genSecret}
                className="h-11 rounded-lg border border-border px-3 text-xs font-semibold active:bg-muted"
              >
                Generate
              </button>
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Must also be saved as the <code>TELEGRAM_WEBHOOK_SECRET</code> server secret.
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={sendTest}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-semibold active:bg-muted"
            >
              <Send className="h-4 w-4" /> Test
            </button>
          </div>
        </div>

        <Link
          to="/settings"
          className="block text-center text-xs text-muted-foreground underline"
        >
          Back to settings
        </Link>
      </main>
    </div>
  );
}
