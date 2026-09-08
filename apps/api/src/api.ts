import {
  activateVersion,
  addGuestbookEntry,
  createDraft,
  createGuestStore,
  createGuestbookStore,
  createRsvpStore,
  createVersionStore,
  findGuestByToken,
  publishDraft,
  registerGuest,
  signSession,
  submitRsvp,
  verifySession,
  type GuestStore,
  type GuestbookStore,
  type RsvpStore,
  type SessionClaims,
  type VersionStore,
} from "@wedding-rpg/wedding-core";
import { validatePublication } from "@wedding-rpg/contracts";

interface Env {
  ROOM_SECRET?: string;
  ADMIN_KEY?: string;
  SEED_JSON?: string;
  PROJECT_AVATARS_JSON?: string;
  ALLOW_DEV_TOKENS?: string;
}

interface Seed {
  projects?: { id: string }[];
  guests?: { projectId: string; name: string }[];
}

interface Store {
  guests: GuestStore;
  rsvps: RsvpStore;
  guestbook: GuestbookStore;
  versions: VersionStore;
  avatars: Record<string, string[]>;
  seeded: boolean;
}

const stores = new Map<string, Store>();

function storeFor(key: string): Store {
  let s = stores.get(key);
  if (!s) {
    s = {
      guests: createGuestStore(),
      rsvps: createRsvpStore(),
      guestbook: createGuestbookStore(),
      versions: createVersionStore(),
      avatars: {},
      seeded: false,
    };
    stores.set(key, s);
  }
  return s;
}

function seed(env: Env, store: Store): void {
  if (store.seeded) return;
  store.seeded = true;
  try {
    store.avatars = JSON.parse(env.PROJECT_AVATARS_JSON ?? "{}") as Record<string, string[]>;
  } catch {
    store.avatars = {};
  }
  let parsed: Seed = {};
  try {
    parsed = JSON.parse(env.SEED_JSON ?? "{}") as Seed;
  } catch {
    parsed = {};
  }
  const now = Date.now();
  for (const g of parsed.guests ?? []) {
    registerGuest(store.guests, g.projectId, g.name, now);
  }
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const store = storeFor("default");
    seed(env, store);

    if (url.pathname === "/health") return json({ ok: true });

    // Dev-only probe helper: returns seeded guest tokens. Refused unless the
    // worker was started with ALLOW_DEV_TOKENS=1 (never set in production).
    if (url.pathname === "/v1/dev/tokens" && request.method === "GET") {
      if (env.ALLOW_DEV_TOKENS !== "1") return json({ error: "not found" }, 404);
      return json({
        guests: store.guests.guests.map((g) => ({
          name: g.name,
          projectId: g.projectId,
          token: g.token,
        })),
      });
    }

    if (url.pathname === "/v1/session" && request.method === "POST") {
      let body: { token?: string; avatarId?: string };
      try {
        body = (await request.json()) as { token?: string; avatarId?: string };
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const guest = findGuestByToken(store.guests, body.token ?? "");
      if (!guest) return json({ error: "unknown token" }, 404);
      const avatars = store.avatars[guest.projectId] ?? ["guest_01"];
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
      return json({
        records: store.rsvps.records.filter((r) => r.projectId === claims.projectId),
      });
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
      const guest = findGuestByToken(
        store.guests,
        store.guests.guests.find((g) => g.id === claims.guestId)?.token ?? ""
      );
      if (!guest) return json({ error: "unknown guest" }, 404);
      const r = submitRsvp(
        store.guests,
        store.rsvps,
        {
          token: guest.token,
          projectId: claims.projectId,
          name: claims.displayName,
          attending: (body.attending === "tidak" ? "tidak" : "hadir") as "hadir" | "tidak",
          partySize: typeof body.partySize === "number" ? body.partySize : 1,
        },
        Date.now()
      );
      if (!r.ok) return json({ error: r.errors[0] }, 400);
      return json({ record: r.record, created: r.created });
    }

    if (url.pathname === "/v1/guestbook" && request.method === "GET") {
      const project = url.searchParams.get("project") ?? "";
      return json({
        entries: store.guestbook.entries.filter((e) => e.projectId === project),
      });
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
      const r = addGuestbookEntry(
        store.guestbook,
        claims.projectId,
        { name: claims.displayName, message: body.message ?? "" },
        Date.now()
      );
      if (!r.ok) return json({ error: r.errors[0] }, 400);
      return json({ entry: r.entry });
    }

    if (url.pathname === "/v1/publication" && request.method === "GET") {
      const project = url.searchParams.get("project") ?? "";
      const publication = url.searchParams.get("publication") ?? "";
      const v = store.versions.versions.find(
        (x) => x.projectId === project && x.publicationId === publication && x.status === "active"
      );
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
        const r = createDraft(
          store.versions,
          String(body.projectId ?? ""),
          String(body.publicationId ?? ""),
          checked.publication,
          Date.now()
        );
        if (!r.ok) return json({ error: r.errors[0] }, 400);
        return json({ version: r.version });
      }
      if (url.pathname === "/v1/admin/publish" && request.method === "POST") {
        const r = publishDraft(store.versions, String(body.versionId ?? ""));
        if (!r.ok) return json({ error: r.errors[0] }, 400);
        return json({ version: r.version });
      }
      if (url.pathname === "/v1/admin/activate" && request.method === "POST") {
        const target = store.versions.versions.find((v) => v.id === String(body.versionId ?? ""));
        if (!target) return json({ error: "unknown version" }, 404);
        const r = activateVersion(store.versions, target.id);
        if (!r.ok) return json({ error: r.errors[0] }, 400);
        return json({ version: r.version });
      }
      return json({ error: "unknown admin action" }, 404);
    }

    return json({ error: "not found" }, 404);
  },
};
