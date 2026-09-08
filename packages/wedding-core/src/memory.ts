// Explicit dev-only memory adapter (M12.6): wraps the pure in-memory
// domain modules behind the WeddingStore interface. The API worker only
// constructs this when DEV_MEMORY_STORE=1; DATABASE_URL always wins.
// Tests and local probes may use it; production never sees it.
import { addGuestbookEntry, createGuestbookStore, type GuestbookStore } from "./guestbook";
import { createGuestStore, findGuestByToken, listGuests, type GuestStore } from "./guests";
import { createRsvpStore, type RsvpStore } from "./rsvp";
import { createVersionStore, type VersionStore } from "./publishing";
import type {
  Guest,
  GuestbookEntry,
  PublicationVersion,
  RsvpRecord,
  WeddingStore,
} from "./store";

export class MemoryStore implements WeddingStore {
  constructor(
    private readonly guests: GuestStore = createGuestStore(),
    private readonly rsvps: RsvpStore = createRsvpStore(),
    private readonly guestbook: GuestbookStore = createGuestbookStore(),
    private readonly versions: VersionStore = createVersionStore()
  ) {}

  async findGuestByToken(token: string): Promise<Guest | null> {
    return findGuestByToken(this.guests, token);
  }

  async listGuests(projectId: string): Promise<Guest[]> {
    return listGuests(this.guests, projectId);
  }

  async upsertRsvp(record: RsvpRecord): Promise<{ record: RsvpRecord; created: boolean }> {
    const existing = this.rsvps.records.find((r) => r.token === record.token);
    if (existing) {
      Object.assign(existing, record);
      return { record: existing, created: false };
    }
    this.rsvps.records.push(record);
    return { record, created: true };
  }

  async listRsvps(projectId: string): Promise<RsvpRecord[]> {
    return this.rsvps.records.filter((r) => r.projectId === projectId);
  }

  async insertGuestbook(entry: GuestbookEntry): Promise<GuestbookEntry> {
    const r = addGuestbookEntry(
      this.guestbook,
      entry.projectId,
      { name: entry.name, message: entry.message },
      entry.createdAt
    );
    if (!r.ok) throw new Error(r.errors[0] ?? "bad guestbook entry");
    return r.entry;
  }

  async listGuestbook(projectId: string): Promise<GuestbookEntry[]> {
    return this.guestbook.entries.filter((e) => e.projectId === projectId);
  }

  async insertVersion(version: PublicationVersion): Promise<void> {
    this.versions.versions.push(version);
  }

  async updateVersionStatus(id: string, status: PublicationVersion["status"]): Promise<void> {
    const v = this.versions.versions.find((x) => x.id === id);
    if (v) v.status = status;
  }

  async findVersion(id: string): Promise<PublicationVersion | null> {
    return this.versions.versions.find((v) => v.id === id) ?? null;
  }

  async maxVersionNumber(projectId: string, publicationId: string): Promise<number> {
    const nums = this.versions.versions
      .filter((v) => v.projectId === projectId && v.publicationId === publicationId)
      .map((v) => v.version);
    return nums.length > 0 ? Math.max(...nums) : 0;
  }

  async findActive(projectId: string, publicationId: string): Promise<PublicationVersion | null> {
    return (
      this.versions.versions.find(
        (v) => v.projectId === projectId && v.publicationId === publicationId && v.status === "active"
      ) ?? null
    );
  }

  async listVersions(projectId: string): Promise<PublicationVersion[]> {
    return this.versions.versions.filter((v) => v.projectId === projectId);
  }

  async findWorldManifestRef(): Promise<string | null> {
    return null;
  }

  async activateExclusive(projectId: string, publicationId: string, versionId: string): Promise<PublicationVersion> {
    const target = this.versions.versions.find(
      (v) => v.id === versionId && v.projectId === projectId && v.publicationId === publicationId
    );
    if (!target || target.status !== "published") throw new Error("activate-exclusive-no-row");
    for (const v of this.versions.versions) {
      if (v.projectId === projectId && v.publicationId === publicationId && v.status === "active") {
        v.status = "archived";
      }
    }
    target.status = "active";
    return target;
  }

  async recordAudit(): Promise<void> {
    return undefined;
  }
}
