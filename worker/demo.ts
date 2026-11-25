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
import init from '../drizzle/0000_init.sql';
import tenantPortal from '../drizzle/0001_tenant_portal.sql';
import depositSettlement from '../drizzle/0002_deposit_settlement.sql';
import roomMeterReadings from '../drizzle/0003_room_meter_readings.sql';
import * as schema from '../src/lib/server/db/schema';
import { demoNeedsReset, installDemo } from '../src/lib/server/demo';
import { todayInMalaysia } from '../src/lib/server/today';

interface Env {
	DEMO: DurableObjectNamespace<DemoApp>;
	ASSETS: Fetcher;
}

const SEEDED_AT = 'seededAt';
const MIGRATION_COUNT = 'migrationCount';
/** Every file in drizzle/, in journal order (demo.spec.ts checks the list against the journal). */
const MIGRATIONS = [init, tenantPortal, depositSettlement, roomMeterReadings];

export class DemoApp extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		globalThis.__biliksewaDb = drizzle(ctx.storage, { schema });
		void ctx.blockConcurrencyWhile(() => this.resetIfStale());
	}

	/** Stale data, or data seeded by an older deploy with fewer migrations. */
	private async stale() {
		const [seededAt, migrations] = await Promise.all([
			this.ctx.storage.get<number>(SEEDED_AT),
			this.ctx.storage.get<number>(MIGRATION_COUNT)
		]);
		return demoNeedsReset(seededAt, Date.now()) || migrations !== MIGRATIONS.length;
	}

	private async resetIfStale() {
		if (!(await this.stale())) return;
		await this.ctx.storage.deleteAll();
		const db = drizzle(this.ctx.storage, { schema });
		globalThis.__biliksewaDb = db;
		await installDemo(db, MIGRATIONS, todayInMalaysia());
		await this.ctx.storage.put({ [SEEDED_AT]: Date.now(), [MIGRATION_COUNT]: MIGRATIONS.length });
	}

	async fetch(request: Request): Promise<Response> {
		if (await this.stale()) {
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
