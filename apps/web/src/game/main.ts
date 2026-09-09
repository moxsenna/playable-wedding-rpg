import { createWeddingGame } from "@wedding-rpg/game";
import { DEMO_NPC_BINDINGS } from "../weddings/demo-bindings";
import { resolveWeddingId } from "../weddings/select";
import { loadProfile } from "../weddings/profile";

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

async function pinnedManifestUrl(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const q = new URLSearchParams(window.location.search);
  if (q.get("manifest") === "local") return undefined;
  const apiBase = q.get("api");
  if (!apiBase) return undefined;
  try {
    const api = apiBase.replace(/\/$/, "");
    const res = await fetch(
      `${api}/v1/world-config?project=${encodeURIComponent(resolveWeddingId())}`
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { manifestRef?: string | null };
    if (!body.manifestRef) return undefined;
    const r2Base = q.get("r2");
    if (/^https?:\/\//i.test(body.manifestRef)) return body.manifestRef;
    // No r2 override: serve the pinned files through the API origin itself
    // (same CORS policy, no extra public bucket URL needed).
    const base = r2Base ? r2Base.replace(/\/$/, "") : `${api}/v1/assets`;
    return `${base}/${body.manifestRef}`;
  } catch {
    return undefined;
  }
}

// Thin web entry: the single Phaser.Game instance is constructed inside
// @wedding-rpg/game (createWeddingGame). React mounts once via PhaserGame
// and destroys on unmount; it never touches scenes or world internals.
const StartGame = async (parent: string) => {
  const direct = manifestFromQuery();
  const manifestUrl = direct ?? (await pinnedManifestUrl()) ?? DEFAULT_MANIFEST_URL;
  return createWeddingGame(parent, {
    manifestUrl,
    npcBindings: DEMO_NPC_BINDINGS,
    playerAvatarId: resolvePlayerAvatarId(),
  });
};

export default StartGame;
