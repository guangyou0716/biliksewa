import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

/**
 * Any synchronous SQLite Drizzle database with our schema: better-sqlite3 locally and in tests,
 * Durable Object SQLite storage in the Cloudflare demo. Both run queries synchronously, so the
 * read-then-write checks in rentals.ts stay race-free on either.
 */
export type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
