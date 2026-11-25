import { sql } from 'drizzle-orm';
import type { DB } from './db/types';
import { seedDemo } from './seed';

/** How long visitors' changes live before the public demo goes back to the seed data. */
export const DEMO_RESET_MS = 60 * 60 * 1000;

/** Splits a drizzle-kit migration file into single statements. */
export function migrationStatements(migrationSql: string): string[] {
	return migrationSql
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Creates the schema in an empty database and fills it with the synthetic demo data. */
export async function installDemo(db: DB, migrationSql: string, today: string) {
	for (const statement of migrationStatements(migrationSql)) db.run(sql.raw(statement));
	return seedDemo(db, today);
}

/** True when the demo was never seeded or its data is older than `DEMO_RESET_MS`. */
export function demoNeedsReset(seededAt: number | undefined, now: number): boolean {
	return seededAt === undefined || now - seededAt >= DEMO_RESET_MS || now < seededAt;
}
