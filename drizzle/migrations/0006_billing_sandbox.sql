ALTER TABLE "billing_orders" ADD COLUMN "sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "billing_orders" SET "sandbox" = false WHERE "sandbox" IS NULL;
