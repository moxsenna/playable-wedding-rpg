import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  strict: true,
  verbose: false,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
