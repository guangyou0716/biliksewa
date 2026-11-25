import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { authenticate } from './auth';
import * as schema from './db/schema';
import { DEMO_RESET_MS, demoNeedsReset, installDemo, migrationStatements } from './demo';
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_TENANT_EMAIL, DEMO_TENANT_PASSWORD } from './seed';

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
	entries: { tag: string }[];
};
const migrations = journal.entries.map((e) => readFileSync(`drizzle/${e.tag}.sql`, 'utf8'));

describe('migrationStatements', () => {
	it('splits on drizzle-kit breakpoints and drops blanks', () => {
		expect(
			migrationStatements(
				'CREATE TABLE a (x);\n--> statement-breakpoint\n\nCREATE INDEX i ON a (x);--> statement-breakpoint\n'
			)
		).toEqual(['CREATE TABLE a (x);', 'CREATE INDEX i ON a (x);']);
	});
});

describe('installDemo', () => {
	it('builds the schema in an empty database and seeds a working demo login', async () => {
		const client = new Database(':memory:');
		client.pragma('foreign_keys = ON');
		const db = drizzle(client, { schema });
		await installDemo(db, migrations, '2026-11-25');
		expect(db.select({ n: count() }).from(schema.user).get()?.n).toBe(2);
		expect(db.select({ n: count() }).from(schema.property).get()?.n).toBe(2);
		expect((await authenticate(db, DEMO_EMAIL, DEMO_PASSWORD))?.role).toBe('landlord');
		expect((await authenticate(db, DEMO_TENANT_EMAIL, DEMO_TENANT_PASSWORD))?.role).toBe('tenant');
	});

	it('the Worker imports every migration in the journal, in order', () => {
		const worker = readFileSync('worker/demo.ts', 'utf8');
		const imported = [...worker.matchAll(/from '\.\.\/drizzle\/([\w-]+)\.sql'/g)].map((m) => m[1]);
		expect(imported).toEqual(journal.entries.map((e) => e.tag));
	});
});

describe('demoNeedsReset', () => {
	const now = Date.UTC(2026, 10, 25, 10);
	it('resets a demo that was never seeded', () => {
		expect(demoNeedsReset(undefined, now)).toBe(true);
	});
	it('keeps visitors’ changes for up to an hour', () => {
		expect(demoNeedsReset(now - DEMO_RESET_MS + 1, now)).toBe(false);
		expect(demoNeedsReset(now - DEMO_RESET_MS, now)).toBe(true);
	});
	it('resets if the stored time is in the future', () => {
		expect(demoNeedsReset(now + 1000, now)).toBe(true);
	});
});
