import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type NavigateFn = (opts: { to: string }) => void | Promise<void>;

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

const GOOGLE_WEB_CLIENT_ID =
  "997514086528-6g3c05853170ioct0ijo2b43oall9sem.apps.googleusercontent.com";

function getUrlSafeNonce() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message: string) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function getNoncePair() {
  const rawNonce = getUrlSafeNonce();
  return { rawNonce, nonceDigest: await sha256Hex(rawNonce) };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validateGoogleToken(idToken: string, nonceDigest: string) {
  const claims = decodeJwtPayload(idToken);
  const audience = claims?.aud;
  const nonce = claims?.nonce;

  if (audience !== GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Google token is from a different client ID. Check the Android OAuth client SHA-1/package and the backend Authorized Client IDs.");
  }

  if (nonce && nonce !== nonceDigest) {
    throw new Error("Google returned an old cached token. Please try again.");
  }
}

function isInvalidRefreshTokenError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  return text.includes("Invalid Refresh Token") || text.includes("refresh_token_not_found");
}

async function clearBrokenLocalSessionIfNeeded() {
  try {
    const { error } = await supabase.auth.getSession();
    if (error && isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
  }
}

export async function loginWithGoogle(navigate: NavigateFn) {
  try {
    // Detect Expo WebView wrapper (React Native WebView)
    const isExpoWrapper =
      typeof window !== "undefined" &&
      (window as unknown as { ReactNativeWebView?: { postMessage: (msg: string) => void } }).ReactNativeWebView;

    if (isExpoWrapper) {
      // Google blocks OAuth inside embedded WebViews, so we can't run the
      // Lovable OAuth broker here. Instead, ask the native wrapper to open the
      // web app's own login page in the SYSTEM browser. The user logs in there
      // (Lovable's backend holds the OAuth secret), and the web app hands the
      // session back to the app via a deep link, which the native wrapper
      // injects into this WebView.
      const redirectBack = "buildhubkh://auth/callback";
      const loginUrl = `${window.location.origin}/login?google=1&redirect=${encodeURIComponent(redirectBack)}`;
      (window as unknown as { ReactNativeWebView: { postMessage: (msg: string) => void } }).ReactNativeWebView.postMessage(
        JSON.stringify({ type: "GOOGLE_LOGIN_WEB", payload: { url: loginUrl } })
      );
      return;
    }

    // In the native Capacitor app, use the native Google Sign-In plugin to avoid WebView blocks.
    if (
      typeof window !== "undefined" &&
      (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.()
    ) {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      try {
        await SocialLogin.initialize({
          google: {
            webClientId: GOOGLE_WEB_CLIENT_ID,
            iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
            mode: "online",
          },
        });
      } catch (initErr) {
        console.warn("SocialLogin.initialize warning", initErr);
      }

      const signInOnce = async () => {
        const { rawNonce, nonceDigest } = await getNoncePair();
        const loginResult = await SocialLogin.login({
          provider: "google",
          options: { nonce: nonceDigest },
        });

        const result = loginResult.result;
        if (result.responseType !== "online" || !result.idToken) {
          throw new Error("Google sign-in did not return an ID token. Make sure Google mode is online.");
        }

        validateGoogleToken(result.idToken, nonceDigest);
        return supabase.auth.signInWithIdToken({
          provider: "google",
          token: result.idToken,
          nonce: rawNonce,
        });
      };

      // Always clear the cached Google account first so the user gets the
      // account chooser instead of being signed straight back into the last one.
      await SocialLogin.logout({ provider: "google" }).catch(() => undefined);

      let { error } = await signInOnce();
      if (error) {
        await SocialLogin.logout({ provider: "google" }).catch(() => undefined);
        ({ error } = await signInOnce());
      }
      if (error) throw error;

      await navigate({ to: "/home" });
      return;
    }

    // Web / Lovable preview fallback: call the OAuth broker immediately from the
    // click handler. Awaiting other auth calls first can make browsers treat the
    // Google window as non-user-initiated and render it in a blocked frame.
    console.log("[google-login] starting web flow, origin=", window.location.origin);

    // If this login was launched from the native app (system browser), remember
    // the deep-link redirect target so we can hand the session back to the app
    // after the OAuth round-trip (which drops the original query string).
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    if (redirectParam) {
      localStorage.setItem("buildhub_oauth_redirect", redirectParam);
    }

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      // Force the Google account chooser so signing out really means signing out.
      extraParams: { prompt: "select_account" },
    });
    console.log("[google-login] result", { redirected: result.redirected, hasError: !!result.error });
    if (result.error) throw result.error;
    if (result.redirected) return;
    // Confirm a session actually exists before navigating / showing errors.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      console.warn("[google-login] no session after OAuth returned");
      toast.error("Sign-in did not complete. Please try again.");
      return;
    }
    await navigate({ to: "/home" });
  } catch (err) {
    console.error("[google-login] error", err);
    // If a session was set despite the thrown error, treat it as success.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await navigate({ to: "/home" });
      return;
    }
    toast.error(err instanceof Error ? err.message : "Google sign-in failed");
  }
}
