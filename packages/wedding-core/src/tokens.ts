// M16 server-side token + slug helpers. Crypto-random, URL-safe, unique-checked by caller.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function mintGuestToken(randomBytes?: (n: number) => Uint8Array): string {
  const bytes =
    randomBytes?.(12) ??
    (() => {
      const g = globalThis.crypto;
      if (g?.getRandomValues) return g.getRandomValues(new Uint8Array(12));
      // Deterministic fallback is test-only; production workerd always has crypto.
      const out = new Uint8Array(12);
      let seed = Date.now() % 2147483647;
      for (let i = 0; i < out.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        out[i] = seed % 256;
      }
      return out;
    })();
  let s = "";
  for (const b of bytes) s += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return `gt_${s}`;
}

export function mintPreviewToken(randomBytes?: (n: number) => Uint8Array): string {
  const bytes =
    randomBytes?.(16) ??
    (() => {
      const g = globalThis.crypto;
      if (g?.getRandomValues) return g.getRandomValues(new Uint8Array(16));
      const out = new Uint8Array(16);
      let seed = (Date.now() + 7) % 2147483647;
      for (let i = 0; i < out.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        out[i] = seed % 256;
      }
      return out;
    })();
  return `pv_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
