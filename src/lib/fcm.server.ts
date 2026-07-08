// FCM HTTP v1 sender for Cloudflare Workers runtime (Web Crypto only).

let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT_JSON is not set");
  const trimmed = raw.trim();
  const parsed = JSON.parse(trimmed) as Partial<ServiceAccount>;
  if (
    !parsed.client_email ||
    !parsed.private_key ||
    !parsed.project_id ||
    !parsed.token_uri ||
    !parsed.private_key.includes("BEGIN PRIVATE KEY")
  ) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON must be the full Firebase service-account JSON");
  }
  return parsed as ServiceAccount;
}

async function mintAccessToken(): Promise<{ token: string; projectId: string }> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.exp > now + 60) {
    return { token: cachedToken.token, projectId: sa.project_id };
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + json.expires_in };
  return { token: json.access_token, projectId: sa.project_id };
}

export interface FcmSendResult {
  token: string;
  ok: boolean;
  status: number;
  errorCode?: string;
}

export async function sendFcmToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<FcmSendResult[]> {
  if (tokens.length === 0) return [];
  const { token: accessToken, projectId } = await mintAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  return Promise.all(
    tokens.map(async (deviceToken) => {
      const message = {
        message: {
          token: deviceToken,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
          android: {
            priority: "high" as const,
            notification: {
              sound: "default",
              channel_id: "buildhub_high_v2",
              notification_priority: "PRIORITY_HIGH" as const,
              default_sound: true,
              default_vibrate_timings: true,
            },
          },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default", "content-available": 1, "interruption-level": "time-sensitive" } },
          },
        },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      let errorCode: string | undefined;
      if (!res.ok) {
        try {
          const body = (await res.json()) as { error?: { status?: string; details?: Array<{ errorCode?: string }> } };
          errorCode = body.error?.details?.[0]?.errorCode ?? body.error?.status;
        } catch {
          errorCode = `HTTP_${res.status}`;
        }
      }
      return { token: deviceToken, ok: res.ok, status: res.status, errorCode };
    }),
  );
}
