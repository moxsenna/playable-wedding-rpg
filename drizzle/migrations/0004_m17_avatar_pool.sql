CREATE TABLE "project_avatar_pool" (
	"project_id" text NOT NULL,
	"avatar_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_avatar_pool" ADD CONSTRAINT "project_avatar_pool_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avatar_pool_project_idx" ON "project_avatar_pool" USING btree ("project_id");