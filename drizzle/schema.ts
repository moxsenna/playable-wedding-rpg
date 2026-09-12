// Neon Postgres schema (M12.5): multi-tenant durable wedding records.
// Every tenant-scoped row carries project_id FK → wedding_projects.id.
// World templates stay global (shared art); wedding_world_configs pins one
// immutable template version per project. Applied with drizzle-kit (offline
// generation here; live migrate needs DATABASE_URL).
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const versionStatus = pgEnum("version_status", ["draft", "published", "active", "archived"]);
export const rsvpChoice = pgEnum("rsvp_choice", ["hadir", "tidak"]);
export const projectStatus = pgEnum("project_status", ["draft", "live", "archived"]);

export const weddingProjects = pgTable("wedding_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().default(""),
  status: projectStatus("status").notNull(),
  tier: text("tier"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(0),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(0),
}, (t) => [uniqueIndex("projects_slug_unique").on(t.slug)]);

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
    phone: text("phone"),
    email: text("email"),
    groupName: text("group_name"),
    notes: text("notes"),
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
  (t) => [
    index("pubver_project_idx").on(t.projectId, t.publicationId),
    uniqueIndex("pubver_single_active").on(t.projectId, t.publicationId).where(sql`${t.status} = 'active'`),
  ]
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

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    guestId: text("guest_id"),
    type: text("type").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
  },
  (t) => [index("analytics_project_idx").on(t.projectId, t.at)]
);

export const previewTokens = pgTable(
  "preview_tokens",
  {
    token: text("token").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    versionId: text("version_id").notNull(),
    exp: bigint("exp", { mode: "number" }).notNull(),
  },
  (t) => [index("preview_project_idx").on(t.projectId)]
);

export const projectAvatarPool = pgTable(
  "project_avatar_pool",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    avatarId: text("avatar_id").notNull(),
  },
  (t) => [index("avatar_pool_project_idx").on(t.projectId)]
);

export const billingOrderStatus = pgEnum("billing_order_status", ["pending", "paid", "failed"]);

export const billingOrders = pgTable(
  "billing_orders",
  {
    externalOrderId: text("external_order_id").primaryKey(),
    paycoreOrderId: text("paycore_order_id"),
    tier: text("tier").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    customerName: text("customer_name").notNull(),
    customerWhatsapp: text("customer_whatsapp").notNull(),
    customerEmail: text("customer_email").notNull(),
    status: billingOrderStatus("status").notNull(),
    sandbox: boolean("sandbox").notNull().default(false),
    projectId: text("project_id").references(() => weddingProjects.id),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    paidAt: bigint("paid_at", { mode: "number" }),
  },
  (t) => [index("billing_paycore_idx").on(t.paycoreOrderId)]
);

export const paymentEvents = pgTable("payment_events", {
  eventId: text("event_id").primaryKey(),
  orderId: text("order_id").notNull(),
  receivedAt: bigint("received_at", { mode: "number" }).notNull(),
});

export const ownerClaims = pgTable(
  "owner_claims",
  {
    token: text("token").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    tier: text("tier").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    usedAt: bigint("used_at", { mode: "number" }),
    revokedAt: bigint("revoked_at", { mode: "number" }),
  },
  (t) => [index("owner_claims_project_idx").on(t.projectId)]
);

export const ownerSessions = pgTable(
  "owner_sessions",
  {
    token: text("token").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => weddingProjects.id),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    revokedAt: bigint("revoked_at", { mode: "number" }),
  },
  (t) => [index("owner_sessions_project_idx").on(t.projectId)]
);

export const adminUsers = pgTable("admin_users", {
  email: text("email").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    token: text("token").primaryKey(),
    email: text("email")
      .notNull()
      .references(() => adminUsers.email),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    revokedAt: bigint("revoked_at", { mode: "number" }),
  },
  (t) => [index("admin_sessions_email_idx").on(t.email)]
);
