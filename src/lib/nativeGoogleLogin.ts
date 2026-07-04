import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type NavigateFn = (opts: { to: string }) => void | Promise<void>;

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

const GOOGLE_WEB_CLIENT_ID =
  "997514086528-uaepk54496rgh00huddfdep2jbvosb0t.apps.googleusercontent.com";

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

export async function loginWithGoogle(navigate: NavigateFn) {
  try {
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
