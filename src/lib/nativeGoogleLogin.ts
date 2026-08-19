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
      // Ask the native Expo app to handle Google login via system browser
      return new Promise<void>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          const data = event.data;
          if (data?.type === "GOOGLE_LOGIN_SUCCESS") {
            window.removeEventListener("message", handler);
            clearTimeout(timeout);
            const idToken = data.payload?.idToken;
            if (!idToken) {
              reject(new Error("No ID token received from app"));
              return;
            }
            supabase.auth
              .signInWithIdToken({
                provider: "google",
                token: idToken,
              })
              .then(({ error }) => {
                if (error) reject(error);
                else {
                  navigate({ to: "/home" });
                  resolve();
                }
              })
              .catch(reject);
          } else if (data?.type === "GOOGLE_LOGIN_ERROR") {
            window.removeEventListener("message", handler);
            clearTimeout(timeout);
            reject(new Error(data.payload?.error || "Google login failed"));
          }
        };

        // Set timeout to avoid hanging
        const timeout = setTimeout(() => {
          window.removeEventListener("message", handler);
          reject(new Error("Google login timed out"));
        }, 120000);

        window.addEventListener("message", handler);

        // Tell the Expo wrapper to start Google login
        (window as unknown as { ReactNativeWebView: { postMessage: (msg: string) => void } }).ReactNativeWebView.postMessage(
          JSON.stringify({ type: "GOOGLE_LOGIN" })
        );
      });
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
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
