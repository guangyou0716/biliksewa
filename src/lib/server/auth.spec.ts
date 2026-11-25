import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type DB } from './db/client';
import { session, user } from './db/schema';
import {
	authenticate,
	createSession,
	deleteSession,
	hashPassword,
	validateSession,
	verifyPassword
} from './auth';

let db: DB;

beforeEach(async () => {
	db = createDb(':memory:');
	db.insert(user)
		.values({
			email: 'demo@example.test',
			name: 'Demo',
			passwordHash: await hashPassword('correct horse')
		})
		.run();
});

describe('passwords', () => {
	it('hashes with a random salt and verifies', async () => {
		const a = await hashPassword('pw');
		const b = await hashPassword('pw');
		expect(a).not.toBe(b);
		expect(await verifyPassword('pw', a)).toBe(true);
		expect(await verifyPassword('PW', a)).toBe(false);
		expect(await verifyPassword('pw', 'plain')).toBe(false);
	});

	it('authenticates case-insensitively by email', async () => {
		expect((await authenticate(db, ' Demo@Example.test ', 'correct horse'))?.name).toBe('Demo');
		expect(await authenticate(db, 'demo@example.test', 'wrong')).toBeNull();
		expect(await authenticate(db, 'nobody@example.test', 'correct horse')).toBeNull();
	});
});

describe('sessions', () => {
	it('stores only a hash of the token', () => {
		const { token } = createSession(db, 1);
		const rows = db.select().from(session).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].id).not.toContain(token);
		expect(validateSession(db, token)?.email).toBe('demo@example.test');
		expect(validateSession(db, token + 'x')).toBeNull();
	});

	it('expires after 14 days and cleans up', () => {
		const now = Date.parse('2026-11-25T00:00:00Z');
		const { token } = createSession(db, 1, now);
		expect(validateSession(db, token, now + 13 * 86_400_000)).not.toBeNull();
		expect(validateSession(db, token, now + 14 * 86_400_000)).toBeNull();
		expect(db.select().from(session).all()).toHaveLength(0);
	});

	it('logout deletes the session', () => {
		const { token } = createSession(db, 1);
		deleteSession(db, token);
		expect(validateSession(db, token)).toBeNull();
	});
});
