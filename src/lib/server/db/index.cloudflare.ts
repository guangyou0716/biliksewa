import type { DB } from './types';

/**
 * Cloudflare demo build only (vite.config.ts aliases `#lib/server/db/index.ts` here).
 * The demo Durable Object (worker/demo.ts) owns the SQLite storage and installs its Drizzle
 * database on `globalThis` before it hands any request to SvelteKit.
 */
declare global {
	var __biliksewaDb: DB | undefined;
}

function current(): DB {
	const db = globalThis.__biliksewaDb;
	if (!db) throw new Error('The demo database is not installed yet');
	return db;
}

export const db: DB = new Proxy({} as DB, {
	get(_target, prop) {
		const target = current();
		const value: unknown = Reflect.get(target, prop, target);
		return typeof value === 'function'
			? (value as (...a: unknown[]) => unknown).bind(target)
			: value;
	}
});
