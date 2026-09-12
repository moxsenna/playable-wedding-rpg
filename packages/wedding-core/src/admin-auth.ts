import { hmacSha256Hex, sha256Hex } from "./billing";

export const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 24;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function randomHex(nBytes: number): string {
  const g = globalThis.crypto;
  const bytes = g?.getRandomValues
    ? g.getRandomValues(new Uint8Array(nBytes))
    : new Uint8Array(nBytes).fill(7);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function mintAdminToken(): string {
  return `as_${randomHex(24)}`;
}

export function validateAdminEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) return null;
  return email;
}

export async function hashAdminPassword(password: string, pepper: string): Promise<string | null> {
  if (!pepper || pepper.length < 16) return null;
  if (typeof password !== "string" || password.length < 8 || password.length > 256) return null;
  const salted = await sha256Hex(`${pepper}:${password.length}:${password}`);
  return hmacSha256Hex(pepper, `admin:${salted}`);
}

export async function verifyAdminPassword(
  password: string,
  pepper: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await hashAdminPassword(password, pepper);
  if (!actual || actual.length !== expectedHash.length) return false;
  let out = 0;
  for (let i = 0; i < actual.length; i++) out |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return out === 0;
}

export interface AdminUserRow {
  email: string;
  passwordHash: string;
  createdAt: number;
}

export interface AdminSessionRow {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}
