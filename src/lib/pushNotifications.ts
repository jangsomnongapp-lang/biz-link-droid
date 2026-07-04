import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;
let activeUserId: string | null = null;

export async function initPushNotifications(userId: string | null) {
  activeUserId = userId;
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const result = await PushNotifications.requestPermissions();
    if (result.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (token) => {
      console.log("FCM Token:", token.value);
      if (!activeUserId) return;
      try {
        await supabase.from("device_tokens").upsert(
          {
            user_id: activeUserId,
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

    initialized = true;
    await PushNotifications.register();
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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      void Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
    };

    const onRegistration = async (token: { value: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
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
      cleanup();
      reject(new Error(err.error || "Push registration failed"));
    };

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Push registration timed out. Check Firebase config in the Android build."));
    }, 20_000);

    Promise.all([
      PushNotifications.addListener("registration", onRegistration),
      PushNotifications.addListener("registrationError", onError),
    ])
      .then((listenerHandles) => {
        handles.push(...listenerHandles);
        return PushNotifications.register();
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      });
  });
}

