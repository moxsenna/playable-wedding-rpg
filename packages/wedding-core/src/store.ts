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

export interface WeddingProjectRow {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "live" | "archived";
  createdAt: number;
  updatedAt: number;
}

export interface AnalyticsRow {
  projectId: string;
  guestId: string | null;
  type: string;
  at: number;
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown };
  if (err?.code === "23505") return true;
  const msg = typeof err?.message === "string" ? err.message : "";
  return /duplicate key|unique constraint|UNIQUE constraint failed/i.test(msg);
}

function isUndefinedColumn(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown };
  if (err?.code === "42703") return true;
  const msg = typeof err?.message === "string" ? err.message : "";
  return /column .* does not exist|no such column|undefined column/i.test(msg);
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
  findWorldManifestRef(projectId: string): Promise<string | null>;
  recordAudit(projectId: string | null, actor: string, action: string, detail: string | null, now: number): Promise<void>;
  listProjects(): Promise<WeddingProjectRow[]>;
  getProject(id: string): Promise<WeddingProjectRow | null>;
  createProject(row: WeddingProjectRow): Promise<void>;
  updateProject(id: string, patch: { name?: string; status?: "draft" | "live" | "archived" }, now: number): Promise<WeddingProjectRow | null>;
  insertGuest(row: Guest & { phone?: string; email?: string; group?: string; notes?: string }): Promise<void>;
  updateGuest(projectId: string, id: string, patch: { name?: string }, now?: number): Promise<Guest | null>;
  deleteGuest(projectId: string, id: string): Promise<boolean>;
  recordAnalyticsEvent(row: AnalyticsRow): Promise<void>;
  listAnalyticsEvents(projectId: string): Promise<AnalyticsRow[]>;
  createPreviewToken(token: string, projectId: string, versionId: string, exp: number): Promise<void>;
  resolvePreviewToken(token: string, now: number): Promise<{ projectId: string; versionId: string } | null>;
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
   * Pinned world manifest for a project: world config → template version →
   * manifest ref. Null when the project has no world config (caller falls
   * back to the local dev manifest).
   */
  async findWorldManifestRef(projectId: string): Promise<string | null> {
    const r = await this.db.query(
      `SELECT v.manifest_ref AS ref FROM wedding_world_configs c
       JOIN world_template_versions v ON v.id = c.template_version_id
       WHERE c.project_id = $1 LIMIT 1`,
      [projectId]
    );
    const ref = r.rows[0]?.ref;
    return typeof ref === "string" && ref.length > 0 ? ref : null;
  }

  /**
   * Exclusive activation as ONE statement: the target flips to active and
   * every other active sibling archives in the same write. If the target is
   * not published (or missing), zero rows match and NOTHING changes — the
   * old active is never left archived with no successor. The
   * pubver_single_active partial unique index stays as the concurrent-race
   * guard; callers surface a no-row result as a failed activation (409).
   */
  async activateExclusive(projectId: string, publicationId: string, versionId: string): Promise<PublicationVersion> {
    const r = await this.db.query(
      `WITH target AS (
         SELECT id FROM publication_versions
         WHERE id = $1 AND project_id = $2 AND publication_id = $3 AND status = 'published'
       )
       UPDATE publication_versions v SET status = CASE WHEN v.id = $1 THEN 'active' ELSE 'archived' END
       FROM target
       WHERE v.project_id = $2 AND v.publication_id = $3 AND v.status IN ('active', 'published')
       RETURNING v.id, v.project_id, v.publication_id, v.version, v.status, v.snapshot, v.created_at`,
      [versionId, projectId, publicationId]
    );
    const active = r.rows.find((row) => String(row.id) === versionId && row.status === "active");
    if (!active) {
      throw new Error("activate-exclusive-no-row");
    }
    return rowVersion(active);
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

  private rowProject(r: QueryRow): WeddingProjectRow {
    return {
      id: String(r.id),
      name: String(r.name),
      slug: typeof r.slug === "string" && r.slug.length > 0 ? r.slug : String(r.id),
      status: (r.status as WeddingProjectRow["status"]) ?? "draft",
      createdAt: Number(r.created_at ?? r.createdAt ?? Date.now()),
      updatedAt: Number(r.updated_at ?? r.updatedAt ?? Date.now()),
    };
  }

  async listProjects(): Promise<WeddingProjectRow[]> {
    try {
      const r = await this.db.query(
        `SELECT id, name, slug, status, created_at, updated_at FROM wedding_projects ORDER BY created_at`
      );
      return r.rows.map((row) => this.rowProject(row));
    } catch {
      const r = await this.db.query(`SELECT id, name, status FROM wedding_projects ORDER BY id`);
      return r.rows.map((row) => this.rowProject(row));
    }
  }

  async getProject(id: string): Promise<WeddingProjectRow | null> {
    try {
      const r = await this.db.query(
        `SELECT id, name, slug, status, created_at, updated_at FROM wedding_projects WHERE id = $1`,
        [id]
      );
      return r.rows.length > 0 ? this.rowProject(r.rows[0]) : null;
    } catch {
      const r = await this.db.query(`SELECT id, name, status FROM wedding_projects WHERE id = $1`, [id]);
      return r.rows.length > 0 ? this.rowProject(r.rows[0]) : null;
    }
  }

  async createProject(row: WeddingProjectRow): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO wedding_projects (id, name, slug, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, row.name, row.slug, row.status, row.createdAt, row.updatedAt]
      );
    } catch (e) {
      if (isUniqueViolation(e)) throw new Error("slug-taken");
      if (!isUndefinedColumn(e)) throw e;
      await this.db.query(`INSERT INTO wedding_projects (id, name, status) VALUES ($1, $2, $3)`, [
        row.id,
        row.name,
        row.status,
      ]);
    }
  }

  async updateProject(
    id: string,
    patch: { name?: string; status?: "draft" | "live" | "archived" },
    now: number
  ): Promise<WeddingProjectRow | null> {
    const cur = await this.getProject(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: now };
    try {
      await this.db.query(
        `UPDATE wedding_projects SET name = $2, status = $3, updated_at = $4 WHERE id = $1`,
        [id, next.name, next.status, next.updatedAt]
      );
    } catch {
      await this.db.query(`UPDATE wedding_projects SET name = $2, status = $3 WHERE id = $1`, [
        id,
        next.name,
        next.status,
      ]);
    }
    return next;
  }

  async insertGuest(row: Guest & { phone?: string; email?: string; group?: string; notes?: string }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO guests (id, project_id, name, token, created_at, phone, email, group_name, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.id, row.projectId, row.name, row.token, row.createdAt, row.phone ?? null, row.email ?? null, row.group ?? null, row.notes ?? null]
      );
    } catch (e) {
      if (isUniqueViolation(e)) throw new Error("token-taken");
      if (!isUndefinedColumn(e)) throw e;
      await this.db.query(
        `INSERT INTO guests (id, project_id, name, token, created_at) VALUES ($1, $2, $3, $4, $5)`,
        [row.id, row.projectId, row.name, row.token, row.createdAt]
      );
    }
  }

  async updateGuest(projectId: string, id: string, patch: { name?: string }): Promise<Guest | null> {
    const list = await this.listGuests(projectId);
    const g = list.find((x) => x.id === id) ?? null;
    if (!g) return null;
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name || name.length > 80) throw new Error("bad guest name");
      await this.db.query(`UPDATE guests SET name = $3 WHERE id = $1 AND project_id = $2`, [id, projectId, name]);
      g.name = name;
    }
    return g;
  }

  async deleteGuest(projectId: string, id: string): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM guests WHERE id = $1 AND project_id = $2`, [id, projectId]);
    return r.rowCount > 0;
  }

  async recordAnalyticsEvent(row: AnalyticsRow): Promise<void> {
    const id = `an-${row.at}-${Math.abs(
      [...(row.projectId + row.type + (row.guestId ?? "")).slice(0, 32)].reduce((a, c) => a + c.charCodeAt(0), 0)
    )}-${Math.floor(Math.random() * 1e6)}`;
    await this.db.query(
      `INSERT INTO analytics_events (id, project_id, guest_id, type, at) VALUES ($1, $2, $3, $4, $5)`,
      [id, row.projectId, row.guestId, row.type, row.at]
    );
  }

  async listAnalyticsEvents(projectId: string): Promise<AnalyticsRow[]> {
    const r = await this.db.query(
      `SELECT project_id, guest_id, type, at FROM analytics_events WHERE project_id = $1 ORDER BY at`,
      [projectId]
    );
    return r.rows.map((row) => ({
      projectId: String(row.project_id),
      guestId: row.guest_id == null ? null : String(row.guest_id),
      type: String(row.type),
      at: Number(row.at),
    }));
  }

  async createPreviewToken(token: string, projectId: string, versionId: string, exp: number): Promise<void> {
    await this.db.query(
      `INSERT INTO preview_tokens (token, project_id, version_id, exp) VALUES ($1, $2, $3, $4)`,
      [token, projectId, versionId, exp]
    );
  }

  async resolvePreviewToken(token: string, now: number): Promise<{ projectId: string; versionId: string } | null> {
    const r = await this.db.query(`SELECT project_id, version_id, exp FROM preview_tokens WHERE token = $1`, [token]);
    if (r.rows.length === 0) return null;
    const row = r.rows[0];
    if (Number(row.exp) <= now) return null;
    return { projectId: String(row.project_id), versionId: String(row.version_id) };
  }
}

export type { Guest, GuestbookEntry, Publication, PublicationVersion, RsvpRecord };
