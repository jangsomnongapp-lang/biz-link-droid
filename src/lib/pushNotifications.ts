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

export interface PushTokenResult {
  token: string;
  platform: string;
}

/** Re-request permissions and return the FCM/APNs token (works even after init). */
export async function getPushToken(userId: string | null): Promise<PushTokenResult> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Push notifications are only available on native platforms");
  }

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const result = await PushNotifications.requestPermissions();
  if (result.receive !== "granted") {
    throw new Error("Push notification permission not granted");
  }

    return new Promise((resolve, reject) => {
      let settled = false;

      const onRegistration = async (token: { value: string }) => {
        if (settled) return;
        settled = true;
        if (!userId) {
          resolve({ token: token.value, platform: Capacitor.getPlatform() });
          return;
        }
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
        resolve({ token: token.value, platform: Capacitor.getPlatform() });
      };

      const onError = (err: { error: string }) => {
        if (settled) return;
        settled = true;
        reject(new Error(err.error || "Push registration failed"));
      };

      PushNotifications.addListener("registration", onRegistration).catch(reject);
      PushNotifications.addListener("registrationError", onError).catch(reject);
      PushNotifications.register().catch(reject);
    });
}

