import { neon } from "@neondatabase/serverless";
import {
  NeonStore,
  neonHttpPool,
  signSession,
  verifySession,
  type SessionClaims,
  type WeddingStore,
} from "@wedding-rpg/wedding-core";
import {
  rsvpChoiceSchema,
  rsvpRecordSchema,
  validatePublication,
  type RsvpChoice,
} from "@wedding-rpg/contracts";

interface Env {
  DATABASE_URL?: string;
  ROOM_SECRET?: string;
  ADMIN_KEY?: string;
  DEV_MEMORY_STORE?: string;
  PROJECT_AVATARS_JSON?: string;
  ALLOW_DEV_TOKENS?: string;
}

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
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

function avatarsFor(env: Env, projectId: string): string[] {
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
      const avatars = avatarsFor(env, guest.projectId);
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

    if (url.pathname.startsWith("/v1/admin/")) {
      if (!env.ADMIN_KEY || request.headers.get("x-admin-key") !== env.ADMIN_KEY) {
        return unauthorized();
      }
      let body: Record<string, unknown> = {};
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ error: "bad request" }, 400);
      }
      if (url.pathname === "/v1/admin/draft" && request.method === "POST") {
        const checked = validatePublication(body.snapshot);
        if (!checked.ok || !checked.publication) return json({ error: checked.errors[0] }, 400);
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
          snapshot: checked.publication as unknown as Record<string, unknown>,
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
        const checked = validatePublication(v.snapshot);
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
