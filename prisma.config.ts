import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Load .env / .env.local for the Prisma CLI (Next.js loads them itself for the app).
// Nothing here is required: `prisma generate` works without DATABASE_URL.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
