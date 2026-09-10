import { neon } from "@neondatabase/serverless";
import { AwsClient } from "aws4fetch";
import {
  NeonStore,
  allowedStatusTransition,
  galleryRefs,
  keyReferenced,
  mediaKeyFor,
  parseMediaKey,
  randomUuid,
  validateUploadIntent,
  MEDIA_MAX_BYTES,
  MEDIA_MIME_EXT,
  PRESIGN_TTL_S,
  mintGuestToken,
  mintPreviewToken,
  neonHttpPool,
  parseGuestCsv,
  signSession,
  summarizeAnalytics,
  validateAnalyticsEvent,
  validateProjectCreate,
  validateProjectUpdate,
  validateVersionSnapshot,
  verifySession,
  type SessionClaims,
  type WeddingStore,
} from "@wedding-rpg/wedding-core";
import {
  projectIdSchema,
  rsvpChoiceSchema,
  rsvpRecordSchema,
  validatePublication,
  type RsvpChoice,
} from "@wedding-rpg/contracts";

interface R2BucketLike {
  get(key: string): Promise<{ body: unknown; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: BodyInit, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
}

interface Env {
  DATABASE_URL?: string;
  ROOM_SECRET?: string;
  ADMIN_KEY?: string;
  DEV_MEMORY_STORE?: string;
  PROJECT_AVATARS_JSON?: string;
  ALLOW_DEV_TOKENS?: string;
  ASSETS?: R2BucketLike;
  MEDIA?: R2BucketLike;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  MEDIA_BUCKET?: string;
}

const MEDIA_EXT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

async function signMediaUpload(
  env: Env,
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; expiresIn: number } | null> {
  const accountId = env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = env.MEDIA_BUCKET ?? "yutemu-wedding-media";
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3" });
  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_S));
  const signed = await client.sign(new Request(url.toString(), { method: "PUT", headers: { "content-type": contentType } }), {
    aws: { signQuery: true },
  });
  return { uploadUrl: signed.url, expiresIn: PRESIGN_TTL_S };
}

const ASSET_CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".png": "image/png",
  ".tsj": "application/json",
};

const MEMORY = new Map<string, WeddingStore>();

async function storeFor(env: Env): Promise<WeddingStore> {
  if (env.DATABASE_URL) {
    const sql = neon(env.DATABASE_URL);
    return new NeonStore(neonHttpPool(sql));
  }
  // Explicit dev-only escape hatch. Production refuses to boot without
  // DATABASE_URL (no silent in-memory fallback — data loss is silent evil).
  if (env.DEV_MEMORY_STORE === "1") {
    const { MemoryStore } = await import("@wedding-rpg/wedding-core");
    let s = MEMORY.get("dev");
    if (!s) {
      s = new MemoryStore();
      MEMORY.set("dev", s);
    }
    return s;
  }
  throw new Error("DATABASE_URL missing and DEV_MEMORY_STORE not set");
}

// Public wedding API: reads are open, writes are session- or admin-gated.
// CORS is permissive so any deployed wedding domain can call it.
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, x-session, x-admin-key",
  "access-control-max-age": "86400",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function unauthorized(): Response {
  return json({ error: "unauthorized" }, 401);
}

async function claimsOf(request: Request, env: Env): Promise<SessionClaims | null> {
  const header = request.headers.get("x-session") ?? "";
  if (!header || !env.ROOM_SECRET) return null;
  const v = await verifySession(header, env.ROOM_SECRET, Date.now());
  return v.ok ? v.claims : null;
}

async function avatarsFor(env: Env, store: WeddingStore, projectId: string): Promise<string[]> {
  const pool = await store.getAvatarPool(projectId).catch(() => [] as string[]);
  if (pool.length > 0) return pool;
  try {
    const all = JSON.parse(env.PROJECT_AVATARS_JSON ?? "{}") as Record<string, string[]>;
    return all[projectId] ?? ["guest_01"];
  } catch {
    return ["guest_01"];
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === "/health") return json({ ok: true });

    let store: WeddingStore;
    try {
      store = await storeFor(env);
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }

    if (url.pathname === "/v1/dev/tokens" && request.method === "GET") {
      if (env.ALLOW_DEV_TOKENS !== "1") return json({ error: "not found" }, 404);
      const guests = await store.listGuests(url.searchParams.get("project") ?? "");
      return json({ guests: guests.map((g) => ({ name: g.name, projectId: g.projectId, token: g.token })) });
    }

    // Dev-only guest minting for probes. Refused unless ALLOW_DEV_TOKENS=1
    // (never set in production). Registers into whichever store the worker
    // booted with (Neon in live probes, memory with DEV_MEMORY_STORE=1).
    if (url.pathname === "/v1/dev/guests" && request.method === "POST") {
      if (env.ALLOW_DEV_TOKENS !== "1") return json({ error: "not found" }, 404);
      let body: { projectId?: string; name?: string };
      try {
        body = (await request.json()) as { projectId?: string; name?: string };
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const projectId = (body.projectId ?? "").trim();
      const name = (body.name ?? "").trim();
      if (!projectId || !name) return json({ error: "projectId + name required" }, 400);
      const id = `guest-dev-${Date.now()}-${name.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
      const token = `gt_dev_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
      try {
        const raw = (store as unknown as { rawPool?: () => { query(t: string, p?: unknown[]): Promise<unknown> } }).rawPool?.();
        if (raw) {
          await raw.query(
            `INSERT INTO guests (id, project_id, name, token, created_at) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO NOTHING`,
            [id, projectId, name, token, Date.now()]
          );
        } else {
          const mem = store as unknown as {
            guests: { guests: { id: string; projectId: string; name: string; token: string; createdAt: number }[] };
          };
          mem.guests.guests.push({ id, projectId, name, token, createdAt: Date.now() });
        }
      } catch {
        return json({ error: "mint failed" }, 500);
      }
      return json({ guest: { id, projectId, name, token } });
    }

    if (url.pathname === "/v1/session" && request.method === "POST") {
      let body: { token?: string; avatarId?: string };
      try {
        body = (await request.json()) as { token?: string; avatarId?: string };
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const guest = await store.findGuestByToken(body.token ?? "");
      if (!guest) return json({ error: "unknown token" }, 404);
      const avatars = await avatarsFor(env, store, guest.projectId);
      const signed = await signSession(
        guest,
        body.avatarId ?? avatars[0] ?? "guest_01",
        avatars,
        env.ROOM_SECRET ?? "",
        Date.now()
      );
      if (!signed.ok) return json({ error: signed.errors[0] ?? "forbidden" }, 403);
      return json({
        session: signed.session,
        guest: {
          guestId: signed.claims.guestId,
          projectId: signed.claims.projectId,
          displayName: signed.claims.displayName,
          avatarId: signed.claims.avatarId,
        },
      });
    }

    if (url.pathname === "/v1/rsvp" && request.method === "GET") {
      const claims = await claimsOf(request, env);
      if (!claims) return unauthorized();
      return json({ records: await store.listRsvps(claims.projectId) });
    }

    if (url.pathname === "/v1/rsvp" && request.method === "POST") {
      const claims = await claimsOf(request, env);
      if (!claims) return unauthorized();
      let body: { attending?: string; partySize?: number };
      try {
        body = (await request.json()) as { attending?: string; partySize?: number };
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const guest = (await store.listGuests(claims.projectId)).find((g) => g.id === claims.guestId);
      if (!guest) return json({ error: "unknown guest" }, 404);
      if (!rsvpChoiceSchema.safeParse(body.attending ?? "hadir").success) {
        return json({ error: "attending must be hadir or tidak" }, 400);
      }
      const parsed = rsvpRecordSchema.safeParse({
        token: guest.token,
        projectId: claims.projectId,
        name: claims.displayName,
        attending: (body.attending ?? "hadir") as RsvpChoice,
        partySize: typeof body.partySize === "number" ? body.partySize : 1,
        updatedAt: Date.now(),
      });
      if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "bad rsvp" }, 400);
      const r = await store.upsertRsvp(parsed.data);
      return json({ record: r.record, created: r.created });
    }

    if (url.pathname === "/v1/guestbook" && request.method === "GET") {
      const project = url.searchParams.get("project") ?? "";
      return json({ entries: await store.listGuestbook(project) });
    }

    if (url.pathname === "/v1/guestbook" && request.method === "POST") {
      const claims = await claimsOf(request, env);
      if (!claims) return unauthorized();
      let body: { message?: string };
      try {
        body = (await request.json()) as { message?: string };
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const name = claims.displayName.trim();
      const message = (body.message ?? "").trim();
      if (name.length === 0 || name.length > 40) return json({ error: "bad name" }, 400);
      if (message.length === 0 || message.length > 280) return json({ error: "bad message" }, 400);
      if (/https?:\/\//i.test(message)) return json({ error: "no links" }, 400);
      const entry = await store.insertGuestbook({
        id: `gb-${Date.now()}-${claims.guestId}`,
        projectId: claims.projectId,
        name,
        message,
        createdAt: Date.now(),
      });
      return json({ entry });
    }

    if (url.pathname === "/v1/publication" && request.method === "GET") {
      const project = url.searchParams.get("project") ?? "";
      const publication = url.searchParams.get("publication") ?? "";
      const v = await store.findActive(project, publication);
      if (!v) return json({ error: "no active publication" }, 404);
      return json({ snapshot: v.snapshot, version: v.version });
    }

    // Public world-config resolution: project -> pinned template manifest
    // ref. Null manifestRef means "use the local dev manifest". No auth:
    // the manifest itself carries no secrets.
    if (url.pathname === "/v1/world-config" && request.method === "GET") {
      const project = url.searchParams.get("project") ?? "";
      if (!project) return json({ error: "project required" }, 400);
      const manifestRef = await store.findWorldManifestRef(project);
      return json({ project, manifestRef });
    }

    // Immutable asset proxy: serves versioned world/dependency files from
    // the R2 bucket through the API origin (same CORS policy). Paths are
    // constrained to the published layout so no arbitrary bucket reads.
    // The version manifest is rewritten with absolute asset bases so Phaser
    // resolves pinned deps against this origin however the page was served.
    if (url.pathname.startsWith("/v1/assets/") && request.method === "GET") {
      if (!env.ASSETS) return json({ error: "assets not bound" }, 500);
      const key = url.pathname.slice("/v1/assets/".length);
      if (
        !key ||
        key.includes("..") ||
        key.startsWith("/") ||
        !/^(garden-village-v1\/v\d+\/|assets\/(environment|avatars)\/[0-9a-f]{12}\/)[A-Za-z0-9._/-]+$/.test(key)
      ) {
        return json({ error: "bad asset key" }, 400);
      }
      const obj = await env.ASSETS.get(key);
      if (!obj) return json({ error: "not found" }, 404);
      const origin = new URL(request.url).origin;
      const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
      if (key.endsWith("/manifest.json")) {
        const manifest = (await new Response(obj.body as BodyInit).json()) as {
          environment?: { base?: string };
          avatars?: { prefix?: string };
        };
        const abs = (p: string) => (/^https?:\/\//i.test(p) ? p : `${origin}/v1/assets/${p.replace(/^\//, "")}`);
        if (manifest.environment && typeof manifest.environment.base === "string") {
          manifest.environment.base = abs(manifest.environment.base);
        }
        if (manifest.avatars && typeof manifest.avatars.prefix === "string") {
          manifest.avatars.prefix = abs(manifest.avatars.prefix);
        }
        return new Response(JSON.stringify(manifest), {
          status: 200,
          headers: { "content-type": "application/json", ...CORS, "cache-control": "public, max-age=31536000, immutable" },
        });
      }
      const contentType =
        obj.httpMetadata?.contentType ?? ASSET_CONTENT_TYPES[ext] ?? "application/octet-stream";
      return new Response(obj.body as BodyInit, {
        status: 200,
        headers: { "content-type": contentType, ...CORS, "cache-control": "public, max-age=31536000, immutable" },
      });
    }

    if (url.pathname.startsWith("/v1/guest/") && request.method === "GET") {
      const token = decodeURIComponent(url.pathname.slice("/v1/guest/".length));
      if (!token || token.includes("/")) return json({ error: "bad token" }, 400);
      const guest = await store.findGuestByToken(token);
      if (!guest) return json({ error: "unknown token" }, 404);
      const project = await store.getProject(guest.projectId);
      if (!project) return json({ error: "unknown project" }, 404);
      if (project.status === "archived") return json({ error: "wedding archived" }, 410);
      if (project.status !== "live") return json({ error: "wedding not live" }, 403);
      const active = await store.findActive(project.id, project.id).catch(() => null);
      const manifestRef = await store.findWorldManifestRef(project.id).catch(() => null);
      const avatars = await avatarsFor(env, store, project.id);
      const signed = await signSession(
        guest,
        avatars[0] ?? "guest_01",
        avatars,
        env.ROOM_SECRET ?? "",
        Date.now()
      ).catch(() => null);
      try {
        await store.recordAnalyticsEvent({
          projectId: project.id,
          guestId: guest.id,
          type: "guest_link_opened",
          at: Date.now(),
        });
      } catch {
        /* analytics must never break guest bootstrap */
      }
      return json({
        guest: { id: guest.id, projectId: guest.projectId, name: guest.name },
        project: { id: project.id, name: project.name, status: project.status },
        session: signed && signed.ok ? signed.session : null,
        sessionGuest:
          signed && signed.ok
            ? { displayName: signed.claims.displayName, avatarId: signed.claims.avatarId }
            : null,
        publication: active ? { snapshot: active.snapshot, version: active.version } : null,
        world: { manifestRef },
        realtime: { enabled: manifestRef != null, room: project.id },
      });
    }

    if (url.pathname.startsWith("/v1/preview/") && request.method === "GET") {
      const token = decodeURIComponent(url.pathname.slice("/v1/preview/".length));
      const resolved = await store.resolvePreviewToken(token, Date.now());
      if (!resolved) return json({ error: "unknown preview" }, 404);
      const v = await store.findVersion(resolved.versionId);
      if (!v || v.projectId !== resolved.projectId) return json({ error: "unknown version" }, 404);
      return json({ snapshot: v.snapshot, version: v.version, status: v.status, projectId: v.projectId });
    }

    if (url.pathname === "/v1/analytics" && request.method === "POST") {
      let body: { token?: string; type?: string; guestId?: string };
      try {
        body = (await request.json()) as { token?: string; type?: string; guestId?: string };
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const checked = validateAnalyticsEvent({ type: String(body.type ?? ""), guestId: body.guestId });
      if (!checked.ok) return json({ error: checked.errors[0] ?? "bad event" }, 400);
      let projectId = "";
      let guestId: string | null = null;
      const claims = await claimsOf(request, env);
      if (claims) {
        projectId = claims.projectId;
        guestId = claims.guestId;
      } else if (body.token) {
        const guest = await store.findGuestByToken(body.token);
        if (!guest) return json({ error: "unknown token" }, 404);
        projectId = guest.projectId;
        guestId = guest.id;
      } else {
        return json({ error: "token or session required" }, 401);
      }
      try {
        await store.recordAnalyticsEvent({
          projectId,
          guestId,
          type: String(body.type),
          at: Date.now(),
        });
      } catch {
        return json({ error: "analytics unavailable" }, 500);
      }
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/v1/media/") && request.method === "GET") {
      if (!env.MEDIA) return json({ error: "media not bound" }, 500);
      const key = decodeURIComponent(url.pathname.slice("/v1/media/".length));
      if (!parseMediaKey(key)) return json({ error: "bad media key" }, 400);
      const obj = await env.MEDIA.get(key);
      if (!obj) return json({ error: "not found" }, 404);
      const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
      return new Response(obj.body as BodyInit, {
        status: 200,
        headers: {
          "content-type": obj.httpMetadata?.contentType ?? MEDIA_EXT_TYPES[ext] ?? "application/octet-stream",
          ...CORS,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname.startsWith("/v1/admin/")) {
      if (!env.ADMIN_KEY || request.headers.get("x-admin-key") !== env.ADMIN_KEY) {
        return unauthorized();
      }
      const readBody = async (): Promise<Record<string, unknown>> => {
        try {
          return (await request.json()) as Record<string, unknown>;
        } catch {
          return {};
        }
      };
      if (url.pathname === "/v1/admin/projects" && request.method === "GET") {
        return json({ projects: await store.listProjects() });
      }
      if (url.pathname === "/v1/admin/projects" && request.method === "POST") {
        const body = await readBody();
        const checked = validateProjectCreate(body);
        if (!checked.ok) return json({ error: checked.errors[0] }, 400);
        const id = `${checked.slug}-${Date.now().toString(36)}`;
        if (!projectIdSchema.safeParse(id).success) return json({ error: "bad project id" }, 400);
        const existing = await store.listProjects();
        if (existing.some((p) => p.slug === checked.slug)) return json({ error: "slug taken" }, 409);
        const now = Date.now();
        const row = {
          id,
          name: checked.name ?? "Untitled",
          slug: checked.slug ?? "wedding",
          status: "draft" as const,
          createdAt: now,
          updatedAt: now,
        };
        try {
          await store.createProject(row);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (/slug-taken|project exists|duplicate/i.test(msg)) return json({ error: "slug taken" }, 409);
          throw e;
        }
        await store.recordAudit(id, "admin", "project.create", row.slug, now);
        return json({ project: row }, 201);
      }
      if (url.pathname.startsWith("/v1/admin/projects/") && request.method === "PATCH") {
        const id = decodeURIComponent(url.pathname.slice("/v1/admin/projects/".length));
        const body = await readBody();
        const checked = validateProjectUpdate(body);
        if (!checked.ok) return json({ error: checked.errors[0] }, 400);
        const cur = await store.getProject(id);
        if (!cur) return json({ error: "unknown project" }, 404);
        if (checked.patch.status && !allowedStatusTransition(cur.status, checked.patch.status)) {
          return json({ error: "archived projects cannot go live directly" }, 400);
        }
        const next = await store.updateProject(id, checked.patch, Date.now());
        await store.recordAudit(id, "admin", "project.update", JSON.stringify(checked.patch).slice(0, 200), Date.now());
        return json({ project: next });
      }
      if (url.pathname === "/v1/admin/guests" && request.method === "GET") {
        const project = url.searchParams.get("project") ?? "";
        if (!project) return json({ error: "project required" }, 400);
        const guests = await store.listGuests(project);
        const rsvps = await store.listRsvps(project).catch(() => []);
        const byToken = new Map(rsvps.map((r) => [r.token, r]));
        return json({
          guests: guests.map((g) => ({
            id: g.id,
            projectId: g.projectId,
            name: g.name,
            token: g.token,
            createdAt: g.createdAt,
            rsvp: byToken.get(g.token)?.attending ?? null,
          })),
        });
      }
      if (url.pathname === "/v1/admin/guests" && request.method === "POST") {
        const body = await readBody();
        const projectId = String(body.projectId ?? "");
        const name = String(body.name ?? "").trim();
        if (!projectIdSchema.safeParse(projectId).success) return json({ error: "bad project" }, 400);
        if (!name || name.length > 80) return json({ error: "guest name must be 1..80 characters" }, 400);
        const project = await store.getProject(projectId);
        if (!project) return json({ error: "unknown project" }, 404);
        for (let attempt = 0; attempt < 5; attempt++) {
          const token = mintGuestToken();
          if (await store.findGuestByToken(token)) continue;
          const id = `guest-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
          const row = {
            id,
            projectId,
            name,
            token,
            createdAt: Date.now(),
            phone: typeof body.phone === "string" ? body.phone.slice(0, 32) : undefined,
            email: typeof body.email === "string" ? body.email.slice(0, 120) : undefined,
            group: typeof body.group === "string" ? body.group.slice(0, 64) : undefined,
            notes: typeof body.notes === "string" ? body.notes.slice(0, 280) : undefined,
          };
          try {
            await store.insertGuest(row);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (/token-taken|duplicate/i.test(msg)) continue;
            throw e;
          }
          await store.recordAudit(projectId, "admin", "guest.create", id, Date.now());
          return json({ guest: { id, projectId, name, token, createdAt: row.createdAt } }, 201);
        }
        return json({ error: "token collision — retry" }, 409);
      }
      if (url.pathname === "/v1/admin/guests/import" && request.method === "POST") {
        const body = await readBody();
        const projectId = String(body.projectId ?? "");
        if (!projectIdSchema.safeParse(projectId).success) return json({ error: "bad project" }, 400);
        const project = await store.getProject(projectId);
        if (!project) return json({ error: "unknown project" }, 404);
        const csvText = typeof body.csv === "string" ? body.csv : "";
        const rowsInput = Array.isArray(body.rows) ? (body.rows as unknown[]) : null;
        const parsed = rowsInput
          ? { valid: rowsInput.length, rows: rowsInput }
          : parseGuestCsv(csvText);
        let created = 0;
        let skipped = 0;
        const rejected: { rowNumber: number; reason: string }[] = [];
        const existing = new Set((await store.listGuests(projectId)).map((g) => g.name.toLowerCase()));
        if (rowsInput) {
          let n = 0;
          for (const raw of rowsInput as { name?: unknown }[]) {
            n++;
            const name = String((raw as { name?: unknown }).name ?? "").trim();
            if (!name) {
              rejected.push({ rowNumber: n, reason: "missing name" });
              continue;
            }
            if (name.length > 80) {
              rejected.push({ rowNumber: n, reason: "name too long" });
              continue;
            }
            if (existing.has(name.toLowerCase())) {
              skipped++;
              continue;
            }
            const token = mintGuestToken();
            if (await store.findGuestByToken(token)) {
              rejected.push({ rowNumber: n, reason: "token collision — retry" });
              continue;
            }
            await store.insertGuest({
              id: `guest-${Date.now().toString(36)}-${n}-${Math.floor(Math.random() * 1e4).toString(36)}`,
              projectId,
              name,
              token,
              createdAt: Date.now(),
            });
            existing.add(name.toLowerCase());
            created++;
          }
        } else {
          const csvParsed = parsed as ReturnType<typeof parseGuestCsv>;
          for (const item of csvParsed.valid) {
            if (existing.has(item.row.name.toLowerCase())) {
              skipped++;
              continue;
            }
            const token = mintGuestToken();
            if (await store.findGuestByToken(token)) {
              rejected.push({ rowNumber: item.rowNumber, reason: "token collision — retry" });
              continue;
            }
            await store.insertGuest({
              id: `guest-${Date.now().toString(36)}-${item.rowNumber}-${Math.floor(Math.random() * 1e4).toString(36)}`,
              projectId,
              name: item.row.name,
              token,
              createdAt: Date.now(),
              phone: item.row.phone,
              email: item.row.email,
              group: item.row.group,
              notes: item.row.notes,
            });
            existing.add(item.row.name.toLowerCase());
            created++;
          }
          for (const r of csvParsed.rejected) rejected.push({ rowNumber: r.rowNumber, reason: r.reason });
          skipped += csvParsed.skippedBlank;
        }
        await store.recordAudit(projectId, "admin", "guests.import", `created=${created} skipped=${skipped} rejected=${rejected.length}`, Date.now());
        return json({ created, skipped, rejected });
      }
      if (url.pathname.startsWith("/v1/admin/guests/") && (request.method === "PATCH" || request.method === "DELETE")) {
        const id = decodeURIComponent(url.pathname.slice("/v1/admin/guests/".length));
        const body = request.method === "PATCH" ? await readBody() : {};
        const projectId = String(url.searchParams.get("project") ?? body.projectId ?? "");
        if (!projectId) return json({ error: "project required" }, 400);
        if (request.method === "DELETE") {
          const ok = await store.deleteGuest(projectId, id);
          if (!ok) return json({ error: "unknown guest" }, 404);
          await store.recordAudit(projectId, "admin", "guest.delete", id, Date.now());
          return json({ ok: true });
        }
        const name = typeof body.name === "string" ? body.name : "";
        try {
          const next = await store.updateGuest(projectId, id, { name });
          if (!next) return json({ error: "unknown guest" }, 404);
          return json({ guest: next });
        } catch {
          return json({ error: "bad guest name" }, 400);
        }
      }
      if (url.pathname === "/v1/admin/guest-links" && request.method === "GET") {
        const project = url.searchParams.get("project") ?? "";
        if (!project) return json({ error: "project required" }, 400);
        const guests = await store.listGuests(project);
        return json({
          links: guests.map((g) => ({ name: g.name, token: g.token, createdAt: g.createdAt })),
        });
      }
      if (url.pathname === "/v1/admin/versions" && request.method === "GET") {
        const project = url.searchParams.get("project") ?? "";
        if (!project) return json({ error: "project required" }, 400);
        return json({ versions: await store.listVersions(project) });
      }
      if (url.pathname.startsWith("/v1/admin/versions/") && request.method === "GET") {
        const v = await store.findVersion(decodeURIComponent(url.pathname.slice("/v1/admin/versions/".length)));
        if (!v) return json({ error: "unknown version" }, 404);
        return json({ version: v });
      }
      if (url.pathname === "/v1/admin/templates" && request.method === "GET") {
        return json({ templates: await store.listTemplateVersions() });
      }
      if (url.pathname === "/v1/admin/world-config" && request.method === "GET") {
        const project = url.searchParams.get("project") ?? "";
        if (!project) return json({ error: "project required" }, 400);
        return json({ config: await store.getWorldConfig(project) });
      }
      if (url.pathname === "/v1/admin/world-config" && request.method === "POST") {
        const body = await readBody();
        const projectId = String(body.projectId ?? "");
        if (!projectIdSchema.safeParse(projectId).success) return json({ error: "bad project" }, 400);
        if (!(await store.getProject(projectId))) return json({ error: "unknown project" }, 404);
        const templates = await store.listTemplateVersions();
        const templateVersionId = String(body.templateVersionId ?? "");
        if (!templates.some((t) => t.id === templateVersionId)) return json({ error: "unknown template version" }, 400);
        const ambient = body.ambientPreset == null || body.ambientPreset === "" ? null : String(body.ambientPreset);
        if (ambient !== null && !["garden-day", "garden-golden-hour", "garden-evening"].includes(ambient)) {
          return json({ error: "unknown ambient preset" }, 400);
        }
        const music = body.musicRef == null || body.musicRef === "" ? null : String(body.musicRef);
        if (music !== null && (music.length > 256 || /[<>"']/.test(music))) return json({ error: "bad music ref" }, 400);
        const row = { id: `worldcfg-${projectId}`, projectId, templateVersionId, ambientPreset: ambient, musicRef: music };
        await store.upsertWorldConfig(row);
        await store.recordAudit(projectId, "admin", "world.update", templateVersionId, Date.now());
        return json({ config: row });
      }
      if (url.pathname === "/v1/admin/avatar-pool" && request.method === "GET") {
        const project = url.searchParams.get("project") ?? "";
        if (!project) return json({ error: "project required" }, 400);
        return json({ avatarIds: await store.getAvatarPool(project) });
      }
      if (url.pathname === "/v1/admin/avatar-pool" && request.method === "POST") {
        const body = await readBody();
        const projectId = String(body.projectId ?? "");
        if (!projectIdSchema.safeParse(projectId).success) return json({ error: "bad project" }, 400);
        if (!(await store.getProject(projectId))) return json({ error: "unknown project" }, 404);
        const ids = Array.isArray(body.avatarIds) ? body.avatarIds : null;
        if (!ids || ids.length === 0 || ids.length > 24) return json({ error: "1..24 avatar ids required" }, 400);
        const clean = [...new Set(ids.map((x) => String(x ?? "")))];
        if (clean.some((x) => !/^[a-z0-9_]+$/i.test(x) || x.length > 64)) {
          return json({ error: "bad avatar id" }, 400);
        }
        await store.setAvatarPool(projectId, clean);
        await store.recordAudit(projectId, "admin", "avatars.update", `${clean.length} avatars`, Date.now());
        return json({ avatarIds: clean });
      }
      if (url.pathname === "/v1/admin/media/upload-url" && request.method === "POST") {
        const body = await readBody();
        const intent = validateUploadIntent({
          projectId: body.projectId,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
        });
        if (!intent.ok) return json({ error: intent.error }, 400);
        if (!(await store.getProject(intent.projectId as string))) return json({ error: "unknown project" }, 404);
        const key = mediaKeyFor(intent.projectId as string, randomUuid(), intent.ext as string);
        const publicUrl = `${new URL(request.url).origin}/v1/media/${key}`;
        const signed = await signMediaUpload(env, key, intent.contentType as string).catch(() => null);
        if (signed) {
          return json({ mode: "presigned", key, publicUrl, uploadUrl: signed.uploadUrl, expiresIn: signed.expiresIn });
        }
        if (!env.MEDIA) return json({ error: "media storage not configured" }, 500);
        return json({ mode: "proxy", key, publicUrl });
      }
      if (url.pathname === "/v1/admin/media/upload" && request.method === "POST") {
        if (!env.MEDIA) return json({ error: "media storage not configured" }, 500);
        const projectId = url.searchParams.get("projectId") ?? "";
        const key = decodeURIComponent(url.searchParams.get("key") ?? "");
        const contentType = url.searchParams.get("contentType") ?? "";
        const parsed = parseMediaKey(key);
        if (!parsed || parsed.projectId !== projectId) return json({ error: "bad media key" }, 400);
        if (!(await store.getProject(projectId))) return json({ error: "unknown project" }, 404);
        const ext = MEDIA_MIME_EXT[contentType];
        if (!ext || !key.endsWith(`.${ext}`)) return json({ error: "unsupported content type" }, 400);
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength < 1 || bytes.byteLength > MEDIA_MAX_BYTES) {
          return json({ error: "size out of range" }, 400);
        }
        await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
        await store.recordAudit(projectId, "admin", "media.upload", key, Date.now());
        return json({ key, size: bytes.byteLength });
      }
      if (url.pathname === "/v1/admin/media/complete" && request.method === "POST") {
        if (!env.MEDIA) return json({ error: "media storage not configured" }, 500);
        const body = await readBody();
        const projectId = String(body.projectId ?? "");
        const key = String(body.key ?? "");
        const parsed = parseMediaKey(key);
        if (!parsed || parsed.projectId !== projectId) return json({ error: "bad media key" }, 400);
        const head = await env.MEDIA.head(key);
        if (!head) return json({ error: "object missing" }, 404);
        if (head.size < 1 || head.size > MEDIA_MAX_BYTES) {
          await env.MEDIA.delete(key).catch(() => undefined);
          return json({ error: "size out of range" }, 400);
        }
        await store.recordAudit(projectId, "admin", "media.complete", key, Date.now());
        return json({ ok: true, size: head.size });
      }
      if (url.pathname === "/v1/admin/media" && request.method === "DELETE") {
        if (!env.MEDIA) return json({ error: "media storage not configured" }, 500);
        const body = await readBody();
        const projectId = String(body.projectId ?? "");
        const key = String(body.key ?? "");
        const parsed = parseMediaKey(key);
        if (!parsed || parsed.projectId !== projectId) return json({ error: "bad media key" }, 400);
        const versions = await store.listVersions(projectId);
        const active = versions.find((v) => v.status === "active");
        if (active && keyReferenced(galleryRefs(active.snapshot), key)) {
          return json({ error: "referenced by active publication" }, 409);
        }
        await env.MEDIA.delete(key);
        await store.recordAudit(projectId, "admin", "media.delete", key, Date.now());
        return json({ ok: true });
      }
      if (url.pathname === "/v1/admin/preview" && request.method === "POST") {
        const body = await readBody();
        const v = await store.findVersion(String(body.versionId ?? ""));
        if (!v) return json({ error: "unknown version" }, 404);
        const token = mintPreviewToken();
        await store.createPreviewToken(token, v.projectId, v.id, Date.now() + 1000 * 60 * 60 * 24);
        return json({ previewToken: token });
      }
      if (url.pathname === "/v1/admin/analytics" && request.method === "GET") {
        const project = url.searchParams.get("project") ?? "";
        if (!project) return json({ error: "project required" }, 400);
        const guests = await store.listGuests(project).catch(() => []);
        const events = await store.listAnalyticsEvents(project).catch(() => []);
        const rsvps = await store.listRsvps(project).catch(() => []);
        const wishes = await store.listGuestbook(project).catch(() => []);
        const summary = summarizeAnalytics(
          events.map((e) => ({ projectId: e.projectId, guestId: e.guestId, type: e.type, at: e.at })),
          guests.length
        );
        return json({ summary: { ...summary, rsvps: rsvps.length, wishes: wishes.length } });
      }
      let body: Record<string, unknown> = await readBody();
      if (url.pathname === "/v1/admin/draft" && request.method === "POST") {
        const checked = validateVersionSnapshot(body.snapshot);
        if (!checked.ok || !checked.snapshot) return json({ error: checked.errors[0] }, 400);
        const projectId = String(body.projectId ?? "");
        const publicationId = String(body.publicationId ?? "");
        if (!projectId || !publicationId) return json({ error: "projectId + publicationId required" }, 400);
        const n = await store.maxVersionNumber(projectId, publicationId);
        const version = {
          id: `pv-${Date.now()}`,
          projectId,
          publicationId,
          version: n + 1,
          status: "draft" as const,
          snapshot: checked.snapshot,
          createdAt: Date.now(),
        };
        await store.insertVersion(version);
        await store.recordAudit(projectId, "admin", "draft", version.id, Date.now());
        return json({ version });
      }
      if (url.pathname === "/v1/admin/publish" && request.method === "POST") {
        const v = await store.findVersion(String(body.versionId ?? ""));
        if (!v) return json({ error: "unknown version" }, 404);
        if (v.status !== "draft") return json({ error: "only drafts publish" }, 400);
        const checked = validateVersionSnapshot(v.snapshot);
        if (!checked.ok) return json({ error: checked.errors[0] }, 400);
        await store.updateVersionStatus(v.id, "published");
        await store.recordAudit(v.projectId, "admin", "publish", v.id, Date.now());
        return json({ version: { ...v, status: "published" } });
      }
      if (url.pathname === "/v1/admin/activate" && request.method === "POST") {
        const v = await store.findVersion(String(body.versionId ?? ""));
        if (!v) return json({ error: "unknown version" }, 404);
        if (v.status !== "published") return json({ error: "only published versions activate" }, 400);
        try {
          const active = await store.activateExclusive(v.projectId, v.publicationId, v.id);
          await store.recordAudit(v.projectId, "admin", "activate", v.id, Date.now());
          return json({ version: active });
        } catch {
          return json({ error: "activation conflict — retry" }, 409);
        }
      }
      return json({ error: "unknown admin action" }, 404);
    }

    return json({ error: "not found" }, 404);
  },
};
