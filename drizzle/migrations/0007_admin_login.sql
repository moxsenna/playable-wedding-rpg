CREATE TABLE "admin_users" (
	"email" text PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" bigint NOT NULL
);--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"revoked_at" bigint
);--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_email_admin_users_email_fk" FOREIGN KEY ("email") REFERENCES "public"."admin_users"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_sessions_email_idx" ON "admin_sessions" USING btree ("email");
