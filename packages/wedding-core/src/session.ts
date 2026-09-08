import { projectIdSchema, type Guest } from "@wedding-rpg/contracts";

export interface SessionClaims {
  guestId: string;
  projectId: string;
  displayName: string;
  avatarId: string;
  iat: number;
  exp: number;
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const text = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    text.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage === "sign" ? ["sign", "verify"] : ["verify"]
  );
}

export type SessionResult =
  | { ok: true; session: string; claims: SessionClaims }
  | { ok: false; errors: string[] };

export async function signSession(
  guest: Guest,
  avatarId: string,
  avatarAllowlist: readonly string[],
  secret: string,
  now: number
): Promise<SessionResult> {
  if (!secret || secret.length < 16) return { ok: false, errors: ["server misconfigured"] };
  if (!projectIdSchema.safeParse(guest.projectId).success) {
    return { ok: false, errors: ["guest has no project"] };
  }
  if (!avatarAllowlist.includes(avatarId)) {
    return { ok: false, errors: ["avatar not allowed for this wedding"] };
  }
  const claims: SessionClaims = {
    guestId: guest.id,
    projectId: guest.projectId,
    displayName: guest.name,
    avatarId,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const body = b64url(text.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign("HMAC", await importKey(secret, "sign"), text.encode(body));
  return { ok: true, session: `${body}.${b64url(new Uint8Array(sig))}`, claims };
}

export type VerifyResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; errors: string[] };

function parseClaims(bytes: Uint8Array): SessionClaims | null {
  let claims: SessionClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(bytes)) as SessionClaims;
  } catch {
    return null;
  }
  if (
    typeof claims.guestId !== "string" ||
    typeof claims.projectId !== "string" ||
    typeof claims.displayName !== "string" ||
    typeof claims.avatarId !== "string" ||
    typeof claims.exp !== "number"
  ) {
    return null;
  }
  return claims;
}

export async function verifySession(
  session: string,
  secret: string,
  now: number
): Promise<VerifyResult> {
  if (!secret || secret.length < 16) return { ok: false, errors: ["server misconfigured"] };
  const parts = session.split(".");
  if (parts.length !== 2) return { ok: false, errors: ["malformed session"] };
  const [body, sig] = parts;
  let sigBytes: Uint8Array;
  try {
    sigBytes = unb64url(sig);
  } catch {
    return { ok: false, errors: ["malformed session"] };
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    await importKey(secret, "verify"),
    sigBytes.buffer as ArrayBuffer,
    text.encode(body)
  );
  if (!valid) return { ok: false, errors: ["bad signature"] };
  let raw: Uint8Array;
  try {
    raw = unb64url(body);
  } catch {
    return { ok: false, errors: ["malformed session"] };
  }
  const claims = parseClaims(raw);
  if (!claims) return { ok: false, errors: ["malformed claims"] };
  if (now >= claims.exp) return { ok: false, errors: ["session expired"] };
  return { ok: true, claims };
}
