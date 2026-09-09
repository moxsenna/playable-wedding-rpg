import { createWeddingGame } from "@wedding-rpg/game";
import { validatePublication } from "@wedding-rpg/contracts";
import { DEMO_NPC_BINDINGS } from "../weddings/demo-bindings";
import { resolveWeddingId } from "../weddings/select";
import { loadProfile } from "../weddings/profile";
import { guestTokenFromPath, resolveApiBase } from "../weddings/runtime";

const DEFAULT_MANIFEST_URL = "assets/worlds/garden-village-v1/manifest.json";
const DEFAULT_AVATAR_ID = "guest_male_batik_burgundy_01";

function resolvePlayerAvatarId(): string {
  const stored = loadProfile()?.avatarId;
  if (stored && /^[a-z0-9_]+$/i.test(stored)) return stored;
  return DEFAULT_AVATAR_ID;
}

function manifestFromQuery(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const direct = new URLSearchParams(window.location.search).get("manifest");
  if (direct && /^(https?:\/\/|\/|assets\/)/i.test(direct)) return direct;
  return undefined;
}

async function pinnedManifestUrl(projectId: string): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const q = new URLSearchParams(window.location.search);
  if (q.get("manifest") === "local") return undefined;
  const apiBase = q.get("api") ?? resolveApiBase();
  if (!apiBase) return undefined;
  try {
    const api = apiBase.replace(/\/$/, "");
    const res = await fetch(`${api}/v1/world-config?project=${encodeURIComponent(projectId)}`);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { manifestRef?: string | null };
    if (!body.manifestRef) return undefined;
    const r2Base = q.get("r2");
    if (/^https?:\/\//i.test(body.manifestRef)) return body.manifestRef;
    const base = r2Base ? r2Base.replace(/\/$/, "") : `${api}/v1/assets`;
    return `${base}/${body.manifestRef}`;
  } catch {
    return undefined;
  }
}

async function bootstrapBindings(): Promise<{ projectId: string; bindings: typeof DEMO_NPC_BINDINGS } | null> {
  if (typeof window === "undefined") return null;
  const token = guestTokenFromPath();
  if (!token) return null;
  try {
    const api = resolveApiBase();
    const res = await fetch(`${api}/v1/guest/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      project?: { id?: string };
      guest?: { projectId?: string };
      publication?: { snapshot?: unknown } | null;
    };
    const projectId = String(body.project?.id ?? body.guest?.projectId ?? resolveWeddingId());
    const snapshot = body.publication?.snapshot as { npcBindings?: unknown } | undefined;
    if (Array.isArray(snapshot?.npcBindings) && snapshot.npcBindings.length > 0) {
      return { projectId, bindings: snapshot.npcBindings as typeof DEMO_NPC_BINDINGS };
    }
    const pubRes = await fetch(
      `${api}/v1/publication?project=${encodeURIComponent(projectId)}&publication=${encodeURIComponent(projectId)}`
    );
    if (pubRes.ok) {
      const pubBody = (await pubRes.json()) as { snapshot?: unknown };
      const checked = validatePublication(pubBody.snapshot);
      if (checked.ok && checked.publication) {
        const extra = pubBody.snapshot as { npcBindings?: unknown };
        if (Array.isArray(extra.npcBindings) && extra.npcBindings.length > 0) {
          return { projectId, bindings: extra.npcBindings as typeof DEMO_NPC_BINDINGS };
        }
      }
    }
    return { projectId, bindings: DEMO_NPC_BINDINGS };
  } catch {
    return null;
  }
}

function ensureAutoNet(): void {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  if (q.get("net") || q.get("rt") === "0") return;
  const token = guestTokenFromPath();
  if (!token) return;
  const api = resolveApiBase();
  fetch(`${api}/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      const session = body?.session as string | undefined;
      const projectId = body?.guest?.projectId as string | undefined;
      if (!session || !projectId) return;
      const next = new URLSearchParams(window.location.search);
      next.set("session", session);
      const rtHost = process.env.NEXT_PUBLIC_REALTIME_BASE ?? "wss://wedding-rpg-realtime.moxsenna.workers.dev";
      next.set("net", `${rtHost.replace(/\/$/, "")}/room?room=${encodeURIComponent(projectId)}`);
      window.history.replaceState(null, "", `${window.location.pathname}?${next.toString()}`);
      window.dispatchEvent(new CustomEvent("netReady"));
    })
    .catch(() => undefined);
}

const StartGame = async (parent: string) => {
  const direct = manifestFromQuery();
  const boot = await bootstrapBindings();
  const projectId = boot?.projectId ?? resolveWeddingId();
  const manifestUrl = direct ?? (await pinnedManifestUrl(projectId)) ?? DEFAULT_MANIFEST_URL;
  ensureAutoNet();
  return createWeddingGame(parent, {
    manifestUrl,
    npcBindings: boot?.bindings ?? DEMO_NPC_BINDINGS,
    playerAvatarId: resolvePlayerAvatarId(),
  });
};

export default StartGame;
