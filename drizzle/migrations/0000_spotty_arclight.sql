CREATE TYPE "public"."project_status" AS ENUM('draft', 'live', 'archived');--> statement-breakpoint
CREATE TYPE "public"."rsvp_choice" AS ENUM('hadir', 'tidak');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('draft', 'published', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"at" bigint NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "guestbook" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "guests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "publication_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"publication_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" "version_status" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"token" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"attending" "rsvp_choice" NOT NULL,
	"party_size" integer NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "project_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_world_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"template_version_id" text NOT NULL,
	"ambient_preset" text,
	"music_ref" text,
	"finale_config" jsonb,
	"realtime_config" jsonb
);
--> statement-breakpoint
CREATE TABLE "world_template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"manifest_ref" text NOT NULL,
	"content_hash" text NOT NULL,
	"compatibility_version" integer NOT NULL,
	"published_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "world_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guestbook" ADD CONSTRAINT "guestbook_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_versions" ADD CONSTRAINT "publication_versions_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_token_guests_token_fk" FOREIGN KEY ("token") REFERENCES "public"."guests"("token") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_world_configs" ADD CONSTRAINT "wedding_world_configs_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_world_configs" ADD CONSTRAINT "wedding_world_configs_template_version_id_world_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."world_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_template_versions" ADD CONSTRAINT "world_template_versions_template_id_world_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."world_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_project_idx" ON "audit_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "guestbook_project_idx" ON "guestbook" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "guests_project_idx" ON "guests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pubver_project_idx" ON "publication_versions" USING btree ("project_id","publication_id");--> statement-breakpoint
CREATE INDEX "rsvps_project_idx" ON "rsvps" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "worldconfig_project_idx" ON "wedding_world_configs" USING btree ("project_id");