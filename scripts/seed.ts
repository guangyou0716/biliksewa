/** Resets the local SQLite database and fills it with synthetic demo data. */
import { rmSync } from 'node:fs';
import { createDb } from '../src/lib/server/db/client';
import {
	seedDemo,
	DEMO_EMAIL,
	DEMO_PASSWORD,
	DEMO_TENANT_EMAIL,
	DEMO_TENANT_PASSWORD
} from '../src/lib/server/seed';
import { todayInMalaysia } from '../src/lib/server/today';

const path = process.env.DATABASE_URL;
if (!path) throw new Error('DATABASE_URL is not set');
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
const db = createDb(path);
await seedDemo(db, todayInMalaysia());
console.log(
	`Seeded ${path}. Landlord: ${DEMO_EMAIL} / ${DEMO_PASSWORD}. Tenant: ${DEMO_TENANT_EMAIL} / ${DEMO_TENANT_PASSWORD}`
);
