CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"guest_id" text,
	"type" text NOT NULL,
	"at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preview_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"version_id" text NOT NULL,
	"exp" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "wedding_projects" ADD COLUMN "slug" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_projects" ADD COLUMN "created_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_projects" ADD COLUMN "updated_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_tokens" ADD CONSTRAINT "preview_tokens_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_project_idx" ON "analytics_events" USING btree ("project_id","at");--> statement-breakpoint
CREATE INDEX "preview_project_idx" ON "preview_tokens" USING btree ("project_id");