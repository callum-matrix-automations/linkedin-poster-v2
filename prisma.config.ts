import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js keeps secrets in .env.local; load it for local Prisma CLI commands.
// In production (Railway) env vars come from the platform, not this file.
loadEnv({ path: ".env.local" });

// Use process.env directly rather than prisma's env() helper: env() THROWS when
// the var is absent, which breaks `prisma generate` at build time on Railway
// (env vars aren't injected during the build step). `generate` doesn't need a
// real URL — only `migrate deploy` does, and that runs at startup with the env
// present. The placeholder is a valid-shaped URL so config parsing succeeds.
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
