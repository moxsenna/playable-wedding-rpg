ALTER TABLE "wedding_projects" ADD COLUMN "tier" text;--> statement-breakpoint
CREATE TYPE "public"."billing_order_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TABLE "billing_orders" (
	"external_order_id" text PRIMARY KEY NOT NULL,
	"paycore_order_id" text,
	"tier" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_whatsapp" text NOT NULL,
	"customer_email" text NOT NULL,
	"status" "billing_order_status" NOT NULL,
	"project_id" text,
	"created_at" bigint NOT NULL,
	"paid_at" bigint
);--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_paycore_idx" ON "billing_orders" USING btree ("paycore_order_id");--> statement-breakpoint
CREATE TABLE "payment_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"received_at" bigint NOT NULL
);--> statement-breakpoint
CREATE TABLE "owner_claims" (
	"token" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"tier" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"used_at" bigint,
	"revoked_at" bigint
);--> statement-breakpoint
ALTER TABLE "owner_claims" ADD CONSTRAINT "owner_claims_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "owner_claims_project_idx" ON "owner_claims" USING btree ("project_id");--> statement-breakpoint
CREATE TABLE "owner_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"revoked_at" bigint
);--> statement-breakpoint
ALTER TABLE "owner_sessions" ADD CONSTRAINT "owner_sessions_project_id_wedding_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wedding_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "owner_sessions_project_idx" ON "owner_sessions" USING btree ("project_id");
