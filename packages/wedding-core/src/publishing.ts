import {
  publicationVersionSchema,
  validatePublication,
  type Publication,
  type PublicationVersion,
} from "@wedding-rpg/contracts";

export interface VersionStore {
  versions: PublicationVersion[];
  seq: number;
}

export function createVersionStore(): VersionStore {
  return { versions: [], seq: 0 };
}

export type LifecycleResult =
  | { ok: true; version: PublicationVersion }
  | { ok: false; errors: string[] };

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
}

function next(store: VersionStore, publicationId: string, status: PublicationVersion["status"], snapshot: Publication, now: number): PublicationVersion {
  store.seq += 1;
  const versionNumbers = store.versions
    .filter((v) => v.publicationId === publicationId)
    .map((v) => v.version);
  const candidate = {
    id: `pv-${store.seq}`,
    publicationId,
    version: (versionNumbers.length > 0 ? Math.max(...versionNumbers) : 0) + 1,
    status,
    snapshot: JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>,
    createdAt: now,
  };
  const parsed = publicationVersionSchema.safeParse(candidate);
  if (!parsed.success) throw new Error(`internal version invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  deepFreeze(parsed.data.snapshot);
  store.versions.push(parsed.data);
  return parsed.data;
}

export function createDraft(
  store: VersionStore,
  publicationId: string,
  snapshot: Publication,
  now: number
): LifecycleResult {
  const checked = validatePublication(snapshot);
  if (!checked.ok || !checked.publication) return { ok: false, errors: checked.errors };
  return { ok: true, version: next(store, publicationId, "draft", checked.publication, now) };
}

export function publishDraft(store: VersionStore, versionId: string): LifecycleResult {
  const draft = store.versions.find((v) => v.id === versionId);
  if (!draft) return { ok: false, errors: [`unknown version: ${versionId}`] };
  if (draft.status !== "draft") return { ok: false, errors: ["only drafts publish"] };
  const checked = validatePublication(draft.snapshot);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  draft.status = "published";
  return { ok: true, version: draft };
}

export function activateVersion(store: VersionStore, versionId: string): LifecycleResult {
  const target = store.versions.find((v) => v.id === versionId);
  if (!target) return { ok: false, errors: [`unknown version: ${versionId}`] };
  if (target.status !== "published") return { ok: false, errors: ["only published versions activate"] };
  for (const v of store.versions) {
    if (v.publicationId === target.publicationId && v.status === "active") v.status = "archived";
  }
  target.status = "active";
  return { ok: true, version: target };
}

export function activeVersion(store: VersionStore, publicationId: string): PublicationVersion | null {
  return (
    store.versions.find((v) => v.publicationId === publicationId && v.status === "active") ?? null
  );
}
