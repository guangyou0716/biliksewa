import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

/** Opens (or creates) a SQLite database and applies the committed migrations in ./drizzle. */
export function createDb(path: string): DB {
	const client = new Database(path);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	const db = drizzle(client, { schema });
	migrate(db, { migrationsFolder: 'drizzle' });
	return db;
}
