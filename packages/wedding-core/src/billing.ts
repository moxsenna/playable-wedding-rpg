// Self-serve billing (M18): PayCore integration + owner claim/session helpers.
// The wedding API never talks to Duitku directly. It signs order requests to
// PayCore (HMAC-SHA256, canonical string copied verbatim from PayCore
// docs/external/integration-guide.md §6) and verifies inbound
// payment.succeeded events (§8). Amounts here are server-authoritative — the
// client only sends a tier id, never a price.
export interface BillingTier {
  id: string;
  productKey: string;
  amount: number;
  currency: string;
}

export const BILLING_TIERS: BillingTier[] = [
  { id: "esensial", productKey: "yutemu_esensial", amount: 1500000, currency: "IDR" },
  { id: "signature", productKey: "yutemu_signature", amount: 3500000, currency: "IDR" },
  { id: "bespoke", productKey: "yutemu_bespoke", amount: 7000000, currency: "IDR" },
];

export function tierById(id: string): BillingTier | null {
  return BILLING_TIERS.find((t) => t.id === id) ?? null;
}

export interface CheckoutCustomer {
  name: string;
  whatsapp: string;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WA_RE = /^(\+62|62|0)8\d{8,12}$/;

export function validateCheckoutInput(input: unknown): {
  ok: boolean;
  tier?: BillingTier;
  customer?: CheckoutCustomer;
  error?: string;
} {
  const body = (input ?? {}) as { tier?: unknown; customer?: unknown };
  const tier = typeof body.tier === "string" ? tierById(body.tier) : null;
  if (!tier) return { ok: false, error: "unknown tier" };
  const c = (body.customer ?? {}) as Partial<CheckoutCustomer>;
  const name = typeof c.name === "string" ? c.name.trim() : "";
  const whatsapp =
    typeof c.whatsapp === "string" ? c.whatsapp.replace(/[\s-]/g, "") : "";
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  if (!name || name.length > 80) return { ok: false, error: "bad customer name" };
  if (!WA_RE.test(whatsapp)) return { ok: false, error: "bad whatsapp number" };
  if (!EMAIL_RE.test(email) || email.length > 160) {
    return { ok: false, error: "bad email" };
  }
  return { ok: true, tier, customer: { name, whatsapp, email } };
}

// --- PayCore request signing (outbound: wedding API -> PayCore) ---

const text = new TextEncoder();

export async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", text.encode(data));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    text.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, text.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Canonical: {timestamp}.{METHOD}.{path}.{sha256Hex(rawBody)} (PayCore §6). */
export async function signPayCoreRequest(params: {
  appSecret: string;
  timestamp: string;
  method: string;
  path: string;
  rawBody: string;
}): Promise<string> {
  const bodyHash = await sha256Hex(params.rawBody);
  const message = `${params.timestamp}.${params.method.toUpperCase()}.${params.path}.${bodyHash}`;
  return hmacSha256Hex(params.appSecret, message);
}

// --- PayCore event verification (inbound: PayCore -> wedding API) ---

export function parseEventSignature(header: string | null): string | null {
  if (!header) return null;
  const t = header.trim();
  return t.startsWith("sha256=") ? t.slice(7) : t;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Canonical: {timestamp}.{rawBody} (PayCore §8). Timestamp skew ±5 min. */
export async function verifyPayCoreEvent(params: {
  webhookSecret: string;
  timestampHeader: string | null;
  rawBody: string;
  signatureHeader: string | null;
  maxSkewMs?: number;
  now?: number;
}): Promise<boolean> {
  if (!params.webhookSecret || !params.timestampHeader) return false;
  const t = Date.parse(params.timestampHeader);
  if (Number.isNaN(t)) return false;
  const now = params.now ?? Date.now();
  if (Math.abs(now - t) > (params.maxSkewMs ?? 5 * 60_000)) return false;
  const expected = await hmacSha256Hex(
    params.webhookSecret,
    `${params.timestampHeader}.${params.rawBody}`
  );
  const provided = parseEventSignature(params.signatureHeader);
  return provided !== null && timingSafeEqual(provided, expected);
}

export interface PayCoreEventData {
  order_id: string;
  external_order_id: string;
  app_id: string;
  provider: string;
  provider_reference: string | null;
  amount: number;
  currency: string;
  product_key: string | null;
  fulfillment_data: Record<string, unknown>;
  paid_at: string;
}

export function validatePayCoreEvent(input: unknown): {
  ok: boolean;
  eventId?: string;
  data?: PayCoreEventData;
  error?: string;
} {
  const body = (input ?? {}) as {
    event_id?: unknown;
    event_type?: unknown;
    data?: unknown;
  };
  if (body.event_type !== "payment.succeeded") return { ok: false, error: "unsupported event" };
  if (typeof body.event_id !== "string" || !body.event_id) {
    return { ok: false, error: "missing event_id" };
  }
  const d = (body.data ?? {}) as Partial<PayCoreEventData>;
  if (
    typeof d.order_id !== "string" ||
    typeof d.external_order_id !== "string" ||
    typeof d.amount !== "number" ||
    typeof d.currency !== "string"
  ) {
    return { ok: false, error: "malformed event data" };
  }
  return {
    ok: true,
    eventId: body.event_id,
    data: {
      order_id: d.order_id,
      external_order_id: d.external_order_id,
      app_id: typeof d.app_id === "string" ? d.app_id : "",
      provider: typeof d.provider === "string" ? d.provider : "",
      provider_reference: typeof d.provider_reference === "string" ? d.provider_reference : null,
      amount: d.amount,
      currency: d.currency,
      product_key: typeof d.product_key === "string" ? d.product_key : null,
      fulfillment_data:
        d.fulfillment_data && typeof d.fulfillment_data === "object"
          ? (d.fulfillment_data as Record<string, unknown>)
          : {},
      paid_at: typeof d.paid_at === "string" ? d.paid_at : "",
    },
  };
}

// --- Ids, tokens, TTLs ---

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomToken(prefix: string, n: number): string {
  const g = globalThis.crypto;
  const bytes = g?.getRandomValues
    ? g.getRandomValues(new Uint8Array(n))
    : (() => {
        const out = new Uint8Array(n);
        let seed = Date.now() % 2147483647;
        for (let i = 0; i < out.length; i++) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          out[i] = seed % 256;
        }
        return out;
      })();
  let s = "";
  for (const b of bytes) s += ID_ALPHABET[b % ID_ALPHABET.length];
  return `${prefix}${s}`;
}

function randomHex(nBytes: number): string {
  const g = globalThis.crypto;
  const bytes = g?.getRandomValues
    ? g.getRandomValues(new Uint8Array(nBytes))
    : new Uint8Array(nBytes).fill(1);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** External order id (ours): unguessable, shown to the buyer for polling. */
export function mintExternalOrderId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
  return `YWT-${ymd}-${randomToken("", 4).toUpperCase()}`;
}

/** Single-use claim token: exchanged once for an owner session. */
export function mintClaimToken(): string {
  return `oc_${randomHex(16)}`;
}

/** Owner session token: bound to exactly one project, revocable. */
export function mintOwnerToken(): string {
  return `os_${randomHex(24)}`;
}

export const CLAIM_TTL_MS = 1000 * 60 * 60 * 24 * 7;
export const OWNER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

// --- Store rows ---

export type BillingOrderStatus = "pending" | "paid" | "failed";

export interface BillingOrderRow {
  externalOrderId: string;
  paycoreOrderId: string | null;
  tier: string;
  amount: number;
  currency: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail: string;
  status: BillingOrderStatus;
  projectId: string | null;
  createdAt: number;
  paidAt: number | null;
}

export interface OwnerClaimRow {
  token: string;
  projectId: string;
  tier: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
  revokedAt: number | null;
}

export interface OwnerSessionRow {
  token: string;
  projectId: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}
