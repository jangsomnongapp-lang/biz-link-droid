import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { getPushToken } from "@/lib/pushNotifications";
import { ArrowLeft, RefreshCw, Copy, Bell } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/debug")({
  component: () => (
    <RequireAuth>
      <PushDebugPage />
    </RequireAuth>
  ),
});

interface DeviceTokenRow {
  id: string;
  token: string;
  platform: string;
  created_at: string;
  updated_at: string;
}

function PushDebugPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [savedRows, setSavedRows] = useState<DeviceTokenRow[]>([]);
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const [latestPlatform, setLatestPlatform] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingToken, setLoadingToken] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadSavedRows();
  }, [user]);

  async function loadSavedRows() {
    if (!user) return;
    setLoadingSaved(true);
    try {
      const { data, error } = await supabase
        .from("device_tokens")
        .select("id, token, platform, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setSavedRows((data ?? []) as DeviceTokenRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load saved tokens");
    } finally {
      setLoadingSaved(false);
    }
  }

  async function refreshToken() {
    if (!user) return;
    setLoadingToken(true);
    try {
      const result = await getPushToken(user.id);
      setLatestToken(result.token);
      setLatestPlatform(result.platform);
      toast.success(lang === "km" ? "បានទទួលថូឃែន" : "Token refreshed");
      await loadSavedRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get token");
    } finally {
      setLoadingToken(false);
    }
  }

  function testLocalNotification() {
    if (!("Notification" in window)) {
      toast.error(lang === "km" ? "កម្មវិធីរុករកមិនគាំទ្រ" : "Browser does not support notifications");
      return;
    }
    const show = () => {
      new Notification(lang === "km" ? "សាកល្បងការជូនដំណឹង" : "Test Notification", {
        body: lang === "km" ? "នេះជាការជូនដំណឹងសាកល្បងក្នុងកម្មវិធី" : "This is a local test notification from BuildHub",
        icon: "/favicon.ico",
      });
      toast.success(lang === "km" ? "បានផ្ញើការជូនដំណឹង" : "Notification sent");
    };
    if (Notification.permission === "granted") {
      show();
    } else if (Notification.permission !== "denied") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") show();
        else toast.error(lang === "km" ? "គ្មានការអនុញ្ញាត" : "Permission denied");
      });
    } else {
      toast.error(lang === "km" ? "ការជូនដំណឹងត្រូវបានបិទ" : "Notifications are blocked");
    }
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success(lang === "km" ? "បានចម្លង" : "Copied");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/profile" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "ព័ត៌មាន Push Notification" : "Push Debug"}
        </h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {lang === "km" ? "វេទិកាសកម្មភាព" : "Runtime"}
            </h2>
          </div>
          <div className="space-y-1 text-sm text-foreground">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Native platform</span>
              <span className="font-medium">{isNative ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">{Capacitor.getPlatform()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-medium truncate max-w-[180px]">{user?.id ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {lang === "km" ? "សាកល្បងការជូនដំណឹង" : "Send test notification"}
            </h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {lang === "km"
              ? "ផ្ញើការជូនដំណឹងសាកល្បងទៅឧបករណ៍នេះ ដើម្បីផ្ទៀងផ្ទាត់ការអនុញ្ញាត។"
              : "Send a local test notification to this device to verify permission."}
          </p>
          <button
            type="button"
            onClick={testLocalNotification}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground active:scale-95"
          >
            <Bell className="h-3.5 w-3.5" />
            {lang === "km" ? "ផ្ញើសាកល្បង" : "Send test"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                {lang === "km" ? "ថូឃែនថ្មីបំផុត" : "Latest FCM token"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void refreshToken()}
              disabled={loadingToken}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingToken ? "animate-spin" : ""}`} />
              {lang === "km" ? "ធ្វើឱ្យថ្មី" : "Refresh"}
            </button>
          </div>

          {!isNative && (
            <p className="text-sm text-muted-foreground">
              {lang === "km"
                ? "ថូឃែនអាចធ្វើបានតែនៅលើឧបករណ៍ដើរដោយអេបប៉ុណ្ណោះ"
                : "Token can only be obtained on a native device."}
            </p>
          )}

          {latestToken ? (
            <div className="space-y-2">
              <div className="break-all rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
                {latestToken}
              </div>
              {latestPlatform && (
                <div className="text-xs text-muted-foreground">
                  Platform: <span className="font-medium text-foreground">{latestPlatform}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => copyToClipboard(latestToken)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary active:opacity-70"
              >
                <Copy className="h-3.5 w-3.5" />
                {lang === "km" ? "ចម្លងថូឃែន" : "Copy token"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-text-hint">
              {lang === "km" ? "ចុច Refresh ដើម្បីទទួលថូឃែនថ្មី" : "Tap Refresh to get the current token."}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                {lang === "km" ? "បានរក្សាទុកក្នុងប៉ាត់ថឺឃែន" : "Saved device_tokens"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadSavedRows()}
              disabled={loadingSaved}
              className="rounded-full p-2 active:bg-muted"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loadingSaved ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingSaved ? (
            <p className="text-sm text-text-hint">{lang === "km" ? "កំពុងផ្ទុក..." : "Loading..."}</p>
          ) : savedRows.length === 0 ? (
            <p className="text-sm text-text-hint">
              {lang === "km"
                ? "មិនទាន់មានថូឃែនត្រូវបានរក្សាទុក"
                : "No device tokens saved yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {savedRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="mb-2 break-all font-mono text-xs leading-relaxed text-foreground">
                    {row.token}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="rounded-pill bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {row.platform}
                    </span>
                    <span>{new Date(row.updated_at).toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(row.token)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary active:opacity-70"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {lang === "km" ? "ចម្លង" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
