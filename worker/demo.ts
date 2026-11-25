/**
 * Entry point of the public Cloudflare demo (`npm run demo:deploy`).
 *
 * Every request goes to one Durable Object. It owns a SQLite database (Durable Object storage),
 * which, like better-sqlite3, runs queries synchronously, so the app code is unchanged. The
 * object seeds synthetic data on first use and throws visitors' changes away every hour.
 */
import { DurableObject } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/durable-sqlite';
import sveltekit from 'sveltekit-worker';
import migrationSql from '../drizzle/0000_init.sql';
import * as schema from '../src/lib/server/db/schema';
import { demoNeedsReset, installDemo } from '../src/lib/server/demo';
import { todayInMalaysia } from '../src/lib/server/today';

interface Env {
	DEMO: DurableObjectNamespace<DemoApp>;
	ASSETS: Fetcher;
}

const SEEDED_AT = 'seededAt';

export class DemoApp extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		globalThis.__biliksewaDb = drizzle(ctx.storage, { schema });
		void ctx.blockConcurrencyWhile(() => this.resetIfStale());
	}

	private async resetIfStale() {
		const seededAt = await this.ctx.storage.get<number>(SEEDED_AT);
		if (!demoNeedsReset(seededAt, Date.now())) return;
		await this.ctx.storage.deleteAll();
		const db = drizzle(this.ctx.storage, { schema });
		globalThis.__biliksewaDb = db;
		await installDemo(db, migrationSql, todayInMalaysia());
		await this.ctx.storage.put(SEEDED_AT, Date.now());
	}

	async fetch(request: Request): Promise<Response> {
		const seededAt = await this.ctx.storage.get<number>(SEEDED_AT);
		if (demoNeedsReset(seededAt, Date.now())) {
			await this.ctx.blockConcurrencyWhile(() => this.resetIfStale());
		}
		return sveltekit.fetch(request, this.env);
	}
}

export default {
	fetch(request, env) {
		return env.DEMO.getByName('demo').fetch(request);
	}
} satisfies ExportedHandler<Env>;
