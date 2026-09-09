import { createWeddingGame } from "@wedding-rpg/game";
import { validatePublication } from "@wedding-rpg/contracts";
import { DEMO_NPC_BINDINGS } from "../weddings/demo-bindings";
import { resolveWeddingId } from "../weddings/select";
import { loadProfile } from "../weddings/profile";
import { fetchBootstrap, guestTokenFromPath, isGuestPath, resolveApiBase } from "../weddings/runtime";

const DEFAULT_MANIFEST_URL = "assets/worlds/garden-village-v1/manifest.json";
const DEFAULT_AVATAR_ID = "guest_male_batik_burgundy_01";

declare global {
  interface Window {
    __weddingSession?: string;
    __weddingNetUrl?: string;
  }
}

function resolvePlayerAvatarId(fallback?: string): string {
  const stored = loadProfile()?.avatarId;
  if (stored && /^[a-z0-9_]+$/i.test(stored)) return stored;
  if (fallback && /^[a-z0-9_]+$/i.test(fallback)) return fallback;
  return DEFAULT_AVATAR_ID;
}

function manifestFromQuery(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const direct = new URLSearchParams(window.location.search).get("manifest");
  if (direct && /^(https?:\/\/|\/|assets\/)/i.test(direct)) return direct;
  return undefined;
}

function realtimeBase(): string {
  const envBase = process.env.NEXT_PUBLIC_REALTIME_BASE ?? "";
  if (envBase && /^wss?:\/\//i.test(envBase)) return envBase.replace(/\/$/, "");
  return "wss://wedding-rpg-realtime.moxsenna.workers.dev";
}

async function pinnedManifestUrl(projectId: string, manifestRef: string | null): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  if (manifestRef && /^https?:\/\//i.test(manifestRef)) return manifestRef;
  const q = new URLSearchParams(window.location.search);
  if (q.get("manifest") === "local") return undefined;
  if (manifestRef) {
    const r2Base = q.get("r2");
    const apiBase = q.get("api") ?? resolveApiBase();
    const base = r2Base ? r2Base.replace(/\/$/, "") : `${apiBase.replace(/\/$/, "")}/v1/assets`;
    return `${base}/${manifestRef}`;
  }
  const apiBase = q.get("api") ?? resolveApiBase();
  if (!apiBase) return undefined;
  try {
    const api = apiBase.replace(/\/$/, "");
    const res = await fetch(`${api}/v1/world-config?project=${encodeURIComponent(projectId)}`);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { manifestRef?: string | null };
    if (!body.manifestRef) return undefined;
    if (/^https?:\/\//i.test(body.manifestRef)) return body.manifestRef;
    const r2Base = q.get("r2");
    const base = r2Base ? r2Base.replace(/\/$/, "") : `${api}/v1/assets`;
    return `${base}/${body.manifestRef}`;
  } catch {
    return undefined;
  }
}

async function bootFromGuest(token: string): Promise<{ manifestUrl: string; bindings: typeof DEMO_NPC_BINDINGS; avatarId: string }> {
  const body = await fetchBootstrap(token);
  if (body.status === 404) throw new Error("guest-not-found");
  if (body.status === 410) throw new Error("wedding-archived");
  if (body.status === 403) throw new Error("wedding-not-live");
  if (body.status !== 200 || !body.publication) throw new Error("publication-unavailable");
  const checked = validatePublication(body.publication.snapshot);
  if (!checked.ok || !checked.publication) throw new Error("publication-invalid");
  const raw = body.publication.snapshot as { npcBindings?: unknown };
  if (!Array.isArray(raw.npcBindings) || raw.npcBindings.length === 0) throw new Error("content-missing");
  const projectId = String(body.project?.id ?? body.guest?.projectId ?? "");
  if (!projectId) throw new Error("project-missing");
  const manifestUrl = (await pinnedManifestUrl(projectId, body.world?.manifestRef ?? null)) ?? DEFAULT_MANIFEST_URL;
  if (typeof window !== "undefined") {
    if (body.session) window.__weddingSession = body.session;
    const q = new URLSearchParams(window.location.search);
    if (body.realtime?.enabled && q.get("rt") !== "0" && !q.get("net")) {
      window.__weddingNetUrl = `${realtimeBase()}/room?room=${encodeURIComponent(body.realtime.room ?? projectId)}`;
    }
  }
  return {
    manifestUrl,
    bindings: raw.npcBindings as typeof DEMO_NPC_BINDINGS,
    avatarId: resolvePlayerAvatarId(body.sessionGuest?.avatarId),
  };
}

const StartGame = async (parent: string) => {
  const direct = manifestFromQuery();
  const token = guestTokenFromPath();
  if (token || isGuestPath()) {
    if (!token) throw new Error("guest-not-found");
    const boot = await bootFromGuest(token);
    return createWeddingGame(parent, {
      manifestUrl: direct ?? boot.manifestUrl,
      npcBindings: boot.bindings,
      playerAvatarId: boot.avatarId,
    });
  }
  const projectId = resolveWeddingId();
  const manifestUrl = direct ?? (await pinnedManifestUrl(projectId, null)) ?? DEFAULT_MANIFEST_URL;
  return createWeddingGame(parent, {
    manifestUrl,
    npcBindings: DEMO_NPC_BINDINGS,
    playerAvatarId: resolvePlayerAvatarId(),
  });
};

export default StartGame;
