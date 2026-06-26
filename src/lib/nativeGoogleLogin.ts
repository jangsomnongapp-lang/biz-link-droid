import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type NavigateFn = (opts: { to: string }) => void | Promise<void>;

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export async function loginWithGoogle(navigate: NavigateFn) {
  try {
    // In the native Capacitor app, use the native Google Sign-In plugin to avoid WebView blocks.
    if (
      typeof window !== "undefined" &&
      (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.()
    ) {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      const loginResult = await SocialLogin.login({
        provider: "google",
        options: { scopes: ["email", "profile"] },
      });
      console.log("Native Google login result", loginResult);

      const result = loginResult.result;
      if (result.responseType !== "online" || !result.idToken) {
        throw new Error("Google sign-in did not return an online ID token.");
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: result.idToken,
      });
      if (error) throw error;

      await navigate({ to: "/home" });
      return;
    }

    // Web / Lovable preview fallback: use the Lovable OAuth broker.
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error;
    if (result.redirected) return;
    await navigate({ to: "/home" });
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : "Google sign-in failed");
  }
}
