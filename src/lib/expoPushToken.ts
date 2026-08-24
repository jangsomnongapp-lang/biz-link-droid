import { supabase } from "@/integrations/supabase/client";

/**
 * Listen for Expo push token from the mobile app wrapper (React Native WebView)
 * and store it in the device_tokens table so push notifications can be delivered.
 *
 * This runs inside the web app when it's loaded inside the Expo wrapper.
 */
export function initExpoPushTokenListener(userId: string | null) {
  // Only run if inside the Expo WebView wrapper
  const isExpoWrapper =
    typeof window !== "undefined" &&
    (window as unknown as { ReactNativeWebView?: { postMessage: (msg: string) => void } }).ReactNativeWebView;

  if (!isExpoWrapper) return () => {};

  const handleMessage = async (event: MessageEvent) => {
    const data = event.data;

    // Check if this is an Expo push token message from the native wrapper
    if (data?.type === "EXPO_PUSH_TOKEN") {
      const { token, platform } = data.payload || {};
      console.log("[expo-push] Received token from app:", token);

      if (!userId || !token) {
        console.warn("[expo-push] Missing userId or token, skipping save");
        return;
      }

      try {
        const { error } = await supabase.from("device_tokens").upsert(
          {
            user_id: userId,
            token: token,
            platform: platform?.toLowerCase?.() || "unknown",
            provider: "expo",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,token" },
        );

        if (error) {
          console.error("[expo-push] Failed to save token:", error);
        } else {
          console.log("[expo-push] Token saved to device_tokens");
        }
      } catch (e) {
        console.error("[expo-push] Exception saving token:", e);
      }
    }
  };

  // Listen for messages dispatched from the native wrapper
  window.addEventListener("message", handleMessage);

  // Also expose a direct handler the wrapper can call
  (window as unknown as Record<string, unknown>).handleExpoPushToken = handleMessage;

  // Optionally request token explicitly if web app loaded after the wrapper already sent it
  try {
    const rnWebView = (window as unknown as { ReactNativeWebView?: { postMessage: (msg: string) => void } }).ReactNativeWebView;
    if (rnWebView?.postMessage) {
      rnWebView.postMessage(
        JSON.stringify({ type: "PUSH_TOKEN_REQUEST" })
      );
    }
  } catch {
    // ignore
  }

  return () => {
    window.removeEventListener("message", handleMessage);
    delete (window as unknown as Record<string, unknown>).handleExpoPushToken;
  };
}
