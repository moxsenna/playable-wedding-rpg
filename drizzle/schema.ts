// Neon Postgres schema (M12.5): multi-tenant durable wedding records.
// Every tenant-scoped row carries project_id FK → wedding_projects.id.
// World templates stay global (shared art); wedding_world_configs pins one
// immutable template version per project. Applied with drizzle-kit (offline
// generation here; live migrate needs DATABASE_URL).
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const versionStatus = pgEnum("version_status", ["draft", "published", "active", "archived"]);
export const rsvpChoice = pgEnum("rsvp_choice", ["hadir", "tidak"]);
export const projectStatus = pgEnum("project_status", ["draft", "live", "archived"]);

export const weddingProjects = pgTable("wedding_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: projectStatus("status").notNull(),
});

export const guests = pgTable(
  "guests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    name: text("name").notNull(),
    token: text("token").notNull().unique(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("guests_project_idx").on(t.projectId)]
);

export const rsvps = pgTable(
  "rsvps",
  {
    token: text("token").primaryKey().references(() => guests.token),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    name: text("name").notNull(),
    attending: rsvpChoice("attending").notNull(),
    partySize: integer("party_size").notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("rsvps_project_idx").on(t.projectId)]
);

export const guestbook = pgTable(
  "guestbook",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    name: text("name").notNull(),
    message: text("message").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("guestbook_project_idx").on(t.projectId)]
);

export const publicationVersions = pgTable(
  "publication_versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    publicationId: text("publication_id").notNull(),
    version: integer("version").notNull(),
    status: versionStatus("status").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("pubver_project_idx").on(t.projectId, t.publicationId)]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => weddingProjects.id),
    at: bigint("at", { mode: "number" }).notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    detail: text("detail"),
  },
  (t) => [index("audit_project_idx").on(t.projectId)]
);

export const worldTemplates = pgTable("world_templates", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull(),
});

export const worldTemplateVersions = pgTable("world_template_versions", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => worldTemplates.id),
  version: integer("version").notNull(),
  manifestRef: text("manifest_ref").notNull(),
  contentHash: text("content_hash").notNull(),
  compatibilityVersion: integer("compatibility_version").notNull(),
  publishedAt: timestamp("published_at").notNull(),
});

export const weddingWorldConfigs = pgTable(
  "wedding_world_configs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    templateVersionId: text("template_version_id")
      .notNull()
      .references(() => worldTemplateVersions.id),
    ambientPreset: text("ambient_preset"),
    musicRef: text("music_ref"),
    finaleConfig: jsonb("finale_config"),
    realtimeConfig: jsonb("realtime_config"),
  },
  (t) => [index("worldconfig_project_idx").on(t.projectId)]
);
