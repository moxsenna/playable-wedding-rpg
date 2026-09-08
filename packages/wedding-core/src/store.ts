// Persistence boundary (M12.6): the API worker talks to this interface,
// never to in-memory stores in production. NeonStore issues parameterized
// SQL against the drizzle schema; MemoryStores stay behind an explicit dev
// flag. Domain validation stays in wedding-core modules; this file only
// moves validated rows.
import type {
  Guest,
  GuestbookEntry,
  Publication,
  PublicationVersion,
  RsvpRecord,
} from "@wedding-rpg/contracts";

export type QueryRow = Record<string, unknown>;

export interface DbPool {
  query(text: string, params?: unknown[]): Promise<{ rows: QueryRow[]; rowCount: number }>;
}

/** Minimal Neon HTTP query function (sql.query(text, params)); full type lives in apps/api. */
export interface NeonQueryFn {
  query(text: string, params?: unknown[]): Promise<QueryRow[]>;
}

/** DbPool over Neon HTTP. No TCP, no node-postgres — works in workerd. */
export function neonHttpPool(sql: NeonQueryFn): DbPool {
  return {
    async query(text: string, params: unknown[] = []) {
      const rows = await sql.query(text, params);
      return { rows, rowCount: rows.length };
    },
  };
}

function rowGuest(r: QueryRow): Guest {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    name: String(r.name),
    token: String(r.token),
    createdAt: Number(r.created_at),
  };
}

function rowRsvp(r: QueryRow): RsvpRecord {
  return {
    token: String(r.token),
    projectId: String(r.project_id),
    name: String(r.name),
    attending: r.attending === "tidak" ? "tidak" : "hadir",
    partySize: Number(r.party_size),
    updatedAt: Number(r.updated_at),
  };
}

function rowGuestbook(r: QueryRow): GuestbookEntry {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    name: String(r.name),
    message: String(r.message),
    createdAt: Number(r.created_at),
  };
}

function rowVersion(r: QueryRow): PublicationVersion {
  const snapshot =
    typeof r.snapshot === "string"
      ? (JSON.parse(r.snapshot) as Record<string, unknown>)
      : (r.snapshot as Record<string, unknown>);
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    publicationId: String(r.publication_id),
    version: Number(r.version),
    status: r.status as PublicationVersion["status"],
    snapshot,
    createdAt: Number(r.created_at),
  };
}

export interface WeddingStore {
  findGuestByToken(token: string): Promise<Guest | null>;
  listGuests(projectId: string): Promise<Guest[]>;
  upsertRsvp(record: RsvpRecord): Promise<{ record: RsvpRecord; created: boolean }>;
  listRsvps(projectId: string): Promise<RsvpRecord[]>;
  insertGuestbook(entry: GuestbookEntry): Promise<GuestbookEntry>;
  listGuestbook(projectId: string): Promise<GuestbookEntry[]>;
  insertVersion(version: PublicationVersion): Promise<void>;
  updateVersionStatus(id: string, status: PublicationVersion["status"]): Promise<void>;
  findVersion(id: string): Promise<PublicationVersion | null>;
  maxVersionNumber(projectId: string, publicationId: string): Promise<number>;
  findActive(projectId: string, publicationId: string): Promise<PublicationVersion | null>;
  listVersions(projectId: string): Promise<PublicationVersion[]>;
  activateExclusive(projectId: string, publicationId: string, versionId: string): Promise<PublicationVersion>;
  recordAudit(projectId: string | null, actor: string, action: string, detail: string | null, now: number): Promise<void>;
}

export class NeonStore implements WeddingStore {
  constructor(private readonly db: DbPool) {}

  /** Raw pool access for dev-only probe helpers (never used in prod routes). */
  rawPool(): DbPool {
    return this.db;
  }

  async findGuestByToken(token: string): Promise<Guest | null> {
    const r = await this.db.query(`SELECT id, project_id, name, token, created_at FROM guests WHERE token = $1`, [token]);
    return r.rows.length > 0 ? rowGuest(r.rows[0]) : null;
  }

  async listGuests(projectId: string): Promise<Guest[]> {
    const r = await this.db.query(`SELECT id, project_id, name, token, created_at FROM guests WHERE project_id = $1 ORDER BY created_at`, [projectId]);
    return r.rows.map(rowGuest);
  }

  async upsertRsvp(record: RsvpRecord): Promise<{ record: RsvpRecord; created: boolean }> {
    const r = await this.db.query(
      `INSERT INTO rsvps (token, project_id, name, attending, party_size, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (token) DO UPDATE SET project_id = EXCLUDED.project_id, name = EXCLUDED.name,
         attending = EXCLUDED.attending, party_size = EXCLUDED.party_size, updated_at = EXCLUDED.updated_at
       RETURNING (xmax = 0) AS created`,
      [record.token, record.projectId, record.name, record.attending, record.partySize, record.updatedAt]
    );
    return { record, created: r.rows[0]?.created === true };
  }

  async listRsvps(projectId: string): Promise<RsvpRecord[]> {
    const r = await this.db.query(`SELECT token, project_id, name, attending, party_size, updated_at FROM rsvps WHERE project_id = $1 ORDER BY updated_at`, [projectId]);
    return r.rows.map(rowRsvp);
  }

  async insertGuestbook(entry: GuestbookEntry): Promise<GuestbookEntry> {
    await this.db.query(
      `INSERT INTO guestbook (id, project_id, name, message, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [entry.id, entry.projectId, entry.name, entry.message, entry.createdAt]
    );
    return entry;
  }

  async listGuestbook(projectId: string): Promise<GuestbookEntry[]> {
    const r = await this.db.query(`SELECT id, project_id, name, message, created_at FROM guestbook WHERE project_id = $1 ORDER BY created_at`, [projectId]);
    return r.rows.map(rowGuestbook);
  }

  async insertVersion(version: PublicationVersion): Promise<void> {
    await this.db.query(
      `INSERT INTO publication_versions (id, project_id, publication_id, version, status, snapshot, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [version.id, version.projectId, version.publicationId, version.version, version.status, JSON.stringify(version.snapshot), version.createdAt]
    );
  }

  async updateVersionStatus(id: string, status: PublicationVersion["status"]): Promise<void> {
    await this.db.query(`UPDATE publication_versions SET status = $2 WHERE id = $1`, [id, status]);
  }

  async findVersion(id: string): Promise<PublicationVersion | null> {
    const r = await this.db.query(`SELECT id, project_id, publication_id, version, status, snapshot, created_at FROM publication_versions WHERE id = $1`, [id]);
    return r.rows.length > 0 ? rowVersion(r.rows[0]) : null;
  }

  async maxVersionNumber(projectId: string, publicationId: string): Promise<number> {
    const r = await this.db.query(
      `SELECT COALESCE(MAX(version), 0) AS m FROM publication_versions WHERE project_id = $1 AND publication_id = $2`,
      [projectId, publicationId]
    );
    return Number(r.rows[0]?.m ?? 0);
  }

  async findActive(projectId: string, publicationId: string): Promise<PublicationVersion | null> {
    const r = await this.db.query(
      `SELECT id, project_id, publication_id, version, status, snapshot, created_at
       FROM publication_versions WHERE project_id = $1 AND publication_id = $2 AND status = 'active' LIMIT 1`,
      [projectId, publicationId]
    );
    return r.rows.length > 0 ? rowVersion(r.rows[0]) : null;
  }

  async listVersions(projectId: string): Promise<PublicationVersion[]> {
    const r = await this.db.query(
      `SELECT id, project_id, publication_id, version, status, snapshot, created_at
       FROM publication_versions WHERE project_id = $1 ORDER BY version`,
      [projectId]
    );
    return r.rows.map(rowVersion);
  }

  /**
   * Exclusive activation: archive siblings, then activate the target. The
   * pubver_single_active partial unique index is the race guard — a
   * concurrent activation throws a 23505 unique violation, which callers
   * must surface as a failed activation, never as two active versions.
   */
  async activateExclusive(projectId: string, publicationId: string, versionId: string): Promise<PublicationVersion> {
    await this.db.query(
      `UPDATE publication_versions SET status = 'archived'
       WHERE project_id = $1 AND publication_id = $2 AND status = 'active' AND id <> $3`,
      [projectId, publicationId, versionId]
    );
    const r = await this.db.query(
      `UPDATE publication_versions SET status = 'active'
       WHERE id = $1 AND project_id = $2 AND publication_id = $3 AND status = 'published'
       RETURNING id, project_id, publication_id, version, status, snapshot, created_at`,
      [versionId, projectId, publicationId]
    );
    if (r.rows.length === 0) {
      throw new Error("activate-exclusive-no-row");
    }
    return rowVersion(r.rows[0]);
  }

  async recordAudit(projectId: string | null, actor: string, action: string, detail: string | null, now: number): Promise<void> {
    const existing = await this.db.query(`SELECT COUNT(*) AS c FROM audit_events`, []);
    const id = `ae-${now}-${Number(existing.rows[0]?.c ?? 0) + 1}`;
    await this.db.query(`INSERT INTO audit_events (id, project_id, at, actor, action, detail) VALUES ($1, $2, $3, $4, $5, $6)`, [
      id,
      projectId,
      now,
      actor,
      action,
      detail,
    ]);
  }
}

export type { Guest, GuestbookEntry, Publication, PublicationVersion, RsvpRecord };
