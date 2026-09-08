// Neon Postgres schema (M12): durable wedding records + immutable world
// template publishing. Mirrors @wedding-rpg/contracts durable shapes and
// MIGRATION_PLAN.md §5 entities. Applied with drizzle-kit (offline
// generation here; live migrate needs DATABASE_URL).
import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const versionStatus = pgEnum("version_status", ["draft", "published", "active", "archived"]);
export const rsvpChoice = pgEnum("rsvp_choice", ["hadir", "tidak"]);

export const guests = pgTable("guests", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const rsvps = pgTable("rsvps", {
  token: text("token").primaryKey().references(() => guests.token),
  name: text("name").notNull(),
  attending: rsvpChoice("attending").notNull(),
  partySize: integer("party_size").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const guestbook = pgTable("guestbook", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const publicationVersions = pgTable("publication_versions", {
  id: text("id").primaryKey(),
  publicationId: text("publication_id").notNull(),
  version: integer("version").notNull(),
  status: versionStatus("status").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  at: bigint("at", { mode: "number" }).notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
});

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
