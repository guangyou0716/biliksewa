import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import type { DB } from './db/client';
import { session, user } from './db/schema';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'biliksewa_session';
const SESSION_DAYS = 14;
const DAY_MS = 86_400_000;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptAsync(password, salt, 64);
	return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [scheme, saltB64, keyB64] = stored.split('$');
	if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
	const expected = Buffer.from(keyB64, 'base64');
	const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
	return timingSafeEqual(actual, expected);
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
	id: number;
	name: string;
	email: string;
	role: 'landlord' | 'tenant';
}

function sessionUser(row: typeof user.$inferSelect): SessionUser {
	return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export const MIN_PASSWORD_LENGTH = 8;

/** Checks credentials. Always runs scrypt so response time does not reveal whether the email exists. */
export async function authenticate(
	db: DB,
	email: string,
	password: string
): Promise<SessionUser | null> {
	const row = db.select().from(user).where(eq(user.email, email.trim().toLowerCase())).get();
	const ok = await verifyPassword(
		password,
		row?.passwordHash ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '=='
	);
	return row && ok ? sessionUser(row) : null;
}

export function createSession(db: DB, userId: number, now = Date.now()) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now + SESSION_DAYS * DAY_MS);
	db.insert(session)
		.values({ id: hashToken(token), userId, expiresAt })
		.run();
	return { token, expiresAt };
}

/** Returns the user for a valid token, deleting the session if it has expired. */
export function validateSession(db: DB, token: string, now = Date.now()): SessionUser | null {
	const id = hashToken(token);
	const row = db
		.select({ s: session, u: user })
		.from(session)
		.innerJoin(user, eq(session.userId, user.id))
		.where(eq(session.id, id))
		.get();
	if (!row) return null;
	if (row.s.expiresAt.getTime() <= now) {
		db.delete(session).where(eq(session.id, id)).run();
		return null;
	}
	return sessionUser(row.u);
}

export function deleteSession(db: DB, token: string) {
	db.delete(session)
		.where(eq(session.id, hashToken(token)))
		.run();
}
