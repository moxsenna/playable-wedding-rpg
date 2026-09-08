CREATE TYPE "public"."rsvp_choice" AS ENUM('hadir', 'tidak');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('draft', 'published', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"at" bigint NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "guestbook" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "guests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "publication_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"publication_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" "version_status" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"token" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"attending" "rsvp_choice" NOT NULL,
	"party_size" integer NOT NULL,
	"updated_at" bigint NOT NULL
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
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_token_guests_token_fk" FOREIGN KEY ("token") REFERENCES "public"."guests"("token") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_template_versions" ADD CONSTRAINT "world_template_versions_template_id_world_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."world_templates"("id") ON DELETE no action ON UPDATE no action;