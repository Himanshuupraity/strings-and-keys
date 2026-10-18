import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Optional remote database. Nothing here runs (or even loads the Prisma client) unless
 * DATABASE_URL is set — local-first mode needs no database at all.
 */
export function isRemoteEnabled(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

export function isGoogleEnabled(): boolean {
  return isRemoteEnabled() && !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

const globalForDb = globalThis as unknown as { __mmPrisma?: Promise<PrismaClient> };

/** Lazily creates one Prisma client per server process (survives dev hot reloads). */
export function getDb(): Promise<PrismaClient> {
  if (!isRemoteEnabled()) throw new Error("Remote database is not configured (DATABASE_URL is empty).");
  if (!globalForDb.__mmPrisma) {
    globalForDb.__mmPrisma = (async () => {
      const [{ PrismaClient }, { PrismaPg }] = await Promise.all([import("@/generated/prisma/client"), import("@prisma/adapter-pg")]);
      return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
    })();
    globalForDb.__mmPrisma.catch(() => (globalForDb.__mmPrisma = undefined));
  }
  return globalForDb.__mmPrisma;
}
