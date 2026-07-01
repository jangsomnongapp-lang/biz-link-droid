import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;

export async function initPushNotifications(userId: string | null) {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const result = await PushNotifications.requestPermissions();
    if (result.receive !== "granted") return;

    await PushNotifications.register();
    initialized = true;

    await PushNotifications.addListener("registration", async (token) => {
      console.log("FCM Token:", token.value);
      if (!userId) return;
      try {
        await supabase.from("device_tokens").upsert(
          {
            user_id: userId,
            token: token.value,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,token" },
        );
      } catch (e) {
        console.error("Failed to save device token", e);
      }
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });

    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received:", notification);
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
      console.log("Push action:", notification);
    });
  } catch (e) {
    console.error("initPushNotifications failed", e);
  }
}
