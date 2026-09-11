// Explicit dev-only memory adapter (M12.6): wraps the pure in-memory
// domain modules behind the WeddingStore interface. The API worker only
// constructs this when DEV_MEMORY_STORE=1; DATABASE_URL always wins.
// Tests and local probes may use it; production never sees it.
import { addGuestbookEntry, createGuestbookStore, type GuestbookStore } from "./guestbook";
import { createGuestStore, findGuestByToken, listGuests, type GuestStore } from "./guests";
import { createRsvpStore, type RsvpStore } from "./rsvp";
import { createVersionStore, type VersionStore } from "./publishing";
import type {
  AnalyticsRow,
  Guest,
  GuestbookEntry,
  PublicationVersion,
  RsvpRecord,
  TemplateVersionRow,
  WeddingProjectRow,
  WeddingStore,
  WeddingWorldConfigRow,
} from "./store";
import type { BillingOrderRow, OwnerClaimRow, OwnerSessionRow } from "./billing";

export class MemoryStore implements WeddingStore {
  private projects: WeddingProjectRow[] = [];
  private analytics: AnalyticsRow[] = [];
  private previews: { token: string; projectId: string; versionId: string; exp: number }[] = [];
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

  async listProjects(): Promise<WeddingProjectRow[]> {
    return [...this.projects].sort((a, b) => a.createdAt - b.createdAt);
  }

  async getProject(id: string): Promise<WeddingProjectRow | null> {
    return this.projects.find((p) => p.id === id) ?? null;
  }

  async createProject(row: WeddingProjectRow): Promise<void> {
    if (this.projects.some((p) => p.id === row.id || p.slug === row.slug)) {
      throw new Error("project exists");
    }
    this.projects.push({ ...row });
  }

  async updateProject(
    id: string,
    patch: { name?: string; status?: "draft" | "live" | "archived" },
    now: number
  ): Promise<WeddingProjectRow | null> {
    const p = this.projects.find((x) => x.id === id);
    if (!p) return null;
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.status !== undefined) p.status = patch.status;
    p.updatedAt = now;
    return { ...p };
  }

  async insertGuest(row: Guest): Promise<void> {
    if (this.guests.guests.some((g) => g.token === row.token)) throw new Error("duplicate token");
    this.guests.guests.push({ ...row });
  }

  async updateGuest(projectId: string, id: string, patch: { name?: string }): Promise<Guest | null> {
    const g = this.guests.guests.find((x) => x.id === id && x.projectId === projectId) ?? null;
    if (!g) return null;
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name || name.length > 80) throw new Error("bad guest name");
      g.name = name;
    }
    return { ...g };
  }

  async deleteGuest(projectId: string, id: string): Promise<boolean> {
    const i = this.guests.guests.findIndex((x) => x.id === id && x.projectId === projectId);
    if (i < 0) return false;
    this.guests.guests.splice(i, 1);
    return true;
  }

  async recordAnalyticsEvent(row: AnalyticsRow): Promise<void> {
    this.analytics.push({ ...row });
  }

  async listAnalyticsEvents(projectId: string): Promise<AnalyticsRow[]> {
    return this.analytics.filter((r) => r.projectId === projectId);
  }

  async createPreviewToken(token: string, projectId: string, versionId: string, exp: number): Promise<void> {
    this.previews.push({ token, projectId, versionId, exp });
  }

  async resolvePreviewToken(
    token: string,
    now: number
  ): Promise<{ projectId: string; versionId: string } | null> {
    const p = this.previews.find((x) => x.token === token) ?? null;
    if (!p || p.exp <= now) return null;
    return { projectId: p.projectId, versionId: p.versionId };
  }

  private pools: { projectId: string; avatarId: string }[] = [];
  private worldConfigs: WeddingWorldConfigRow[] = [];

  async getAvatarPool(projectId: string): Promise<string[]> {
    return this.pools.filter((p) => p.projectId === projectId).map((p) => p.avatarId).sort();
  }

  async setAvatarPool(projectId: string, avatarIds: string[]): Promise<void> {
    this.pools = this.pools.filter((p) => p.projectId !== projectId);
    for (const avatarId of avatarIds) this.pools.push({ projectId, avatarId });
  }

  async getWorldConfig(projectId: string): Promise<WeddingWorldConfigRow | null> {
    return this.worldConfigs.find((c) => c.projectId === projectId) ?? null;
  }

  async upsertWorldConfig(row: WeddingWorldConfigRow): Promise<void> {
    const i = this.worldConfigs.findIndex((c) => c.id === row.id);
    if (i < 0) this.worldConfigs.push({ ...row });
    else this.worldConfigs[i] = { ...row };
  }

  async listTemplateVersions(): Promise<TemplateVersionRow[]> {
    return [{ id: "garden-village-v1", templateKey: "garden-village-v1", templateName: "Garden Village", version: 1, manifestRef: "" }];
  }

  private billingOrders: BillingOrderRow[] = [];
  private paymentEvents: { eventId: string; orderId: string; receivedAt: number }[] = [];
  private ownerClaims: OwnerClaimRow[] = [];
  private ownerSessions: OwnerSessionRow[] = [];

  async createBillingOrder(row: BillingOrderRow): Promise<void> {
    this.billingOrders.push({ ...row });
  }

  async getBillingOrder(externalOrderId: string): Promise<BillingOrderRow | null> {
    return this.billingOrders.find((o) => o.externalOrderId === externalOrderId) ?? null;
  }

  async getBillingOrderByPaycoreId(paycoreOrderId: string): Promise<BillingOrderRow | null> {
    return this.billingOrders.find((o) => o.paycoreOrderId === paycoreOrderId) ?? null;
  }

  async setBillingPaycoreId(externalOrderId: string, paycoreOrderId: string): Promise<void> {
    const o = this.billingOrders.find((x) => x.externalOrderId === externalOrderId);
    if (o) o.paycoreOrderId = paycoreOrderId;
  }

  async markOrderPaid(
    externalOrderId: string,
    projectId: string,
    paidAt: number
  ): Promise<BillingOrderRow | null> {
    const o = this.billingOrders.find((x) => x.externalOrderId === externalOrderId) ?? null;
    if (!o || o.status === "paid") return o;
    o.status = "paid";
    o.projectId = projectId;
    o.paidAt = paidAt;
    return { ...o };
  }

  async recordPaymentEvent(eventId: string, orderId: string, receivedAt: number): Promise<boolean> {
    if (this.paymentEvents.some((e) => e.eventId === eventId)) return false;
    this.paymentEvents.push({ eventId, orderId, receivedAt });
    return true;
  }

  async createOwnerClaim(row: OwnerClaimRow): Promise<void> {
    this.ownerClaims.push({ ...row });
  }

  async getOwnerClaim(token: string): Promise<OwnerClaimRow | null> {
    return this.ownerClaims.find((c) => c.token === token) ?? null;
  }

  async findLiveClaimByProject(projectId: string, now: number): Promise<OwnerClaimRow | null> {
    const live = this.ownerClaims
      .filter((c) => c.projectId === projectId && c.revokedAt === null && c.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);
    return live[0] ?? null;
  }

  async consumeOwnerClaim(token: string, now: number): Promise<OwnerClaimRow | null> {
    const c = this.ownerClaims.find((x) => x.token === token) ?? null;
    if (!c || c.revokedAt !== null || c.expiresAt <= now) return null;
    c.usedAt = now;
    return { ...c };
  }

  async revokeOwnerClaim(token: string, now: number): Promise<boolean> {
    const c = this.ownerClaims.find((x) => x.token === token) ?? null;
    if (!c || c.revokedAt !== null) return false;
    c.revokedAt = now;
    return true;
  }

  async createOwnerSession(row: OwnerSessionRow): Promise<void> {
    this.ownerSessions.push({ ...row });
  }

  async resolveOwnerSession(token: string, now: number): Promise<OwnerSessionRow | null> {
    const s = this.ownerSessions.find((x) => x.token === token) ?? null;
    if (!s || s.revokedAt !== null || s.expiresAt <= now) return null;
    return { ...s };
  }

  async revokeOwnerSessions(projectId: string, now: number): Promise<void> {
    for (const s of this.ownerSessions) {
      if (s.projectId === projectId && s.revokedAt === null) s.revokedAt = now;
    }
  }
}
