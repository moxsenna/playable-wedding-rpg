// Wedding media boundary (M17.1). Request signing stays in the API
// worker because only it may hold S3 secrets.
import { projectIdSchema } from "@wedding-rpg/contracts";

export const MEDIA_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const PRESIGN_TTL_S = 600;

const KEY_RE = /^weddings\/([a-z0-9-]+)\/gallery\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(webp|jpg|jpeg|png)$/;

export function mediaKeyFor(projectId: string, uuid: string, ext: string): string {
  return `weddings/${projectId}/gallery/${uuid}.${ext}`;
}

export function parseMediaKey(key: string): { projectId: string } | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  if (!projectIdSchema.safeParse(m[1]).success) return null;
  return { projectId: m[1] };
}

export interface UploadIntent {
  ok: boolean;
  projectId?: string;
  contentType?: string;
  ext?: string;
  error?: string;
}

export function validateUploadIntent(input: { projectId?: unknown; contentType?: unknown; sizeBytes?: unknown }): UploadIntent {
  const projectId = String(input.projectId ?? "");
  if (!projectIdSchema.safeParse(projectId).success) {
    return { ok: false, error: "bad project" };
  }
  const contentType = String(input.contentType ?? "");
  const ext = MEDIA_MIME_EXT[contentType];
  if (!ext) return { ok: false, error: "unsupported content type" };
  const size = typeof input.sizeBytes === "number" ? input.sizeBytes : NaN;
  if (!Number.isInteger(size) || size < 1 || size > MEDIA_MAX_BYTES) {
    return { ok: false, error: "size out of range" };
  }
  return { ok: true, projectId, contentType, ext };
}

export function randomUuid(): string {
  const g = globalThis.crypto;
  if (g?.randomUUID) return g.randomUUID();
  const b = g?.getRandomValues ? g.getRandomValues(new Uint8Array(16)) : new Uint8Array(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface S3Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function galleryRefs(snapshot: unknown): string[] {
  const out: string[] = [];
  const pushGallery = (pub: unknown) => {
    const gallery = (pub as { gallery?: unknown })?.gallery;
    if (!Array.isArray(gallery)) return;
    for (const g of gallery) {
      const src = (g as { src?: unknown })?.src;
      if (typeof src === "string" && src.length > 0) out.push(src);
    }
  };
  if (snapshot && typeof snapshot === "object" && "publication" in snapshot) {
    pushGallery((snapshot as { publication?: unknown }).publication);
  } else {
    pushGallery(snapshot);
  }
  return out;
}

export function keyReferenced(refs: string[], key: string): boolean {
  return refs.some((src) => src === key || src.endsWith(`/${key}`));
}
