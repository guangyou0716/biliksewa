/**
 * Tenant portal: landlords invite a tenant with a one-time link; the tenant's account can only
 * read that tenant's own tenancies, ledger and receipts.
 */
import { randomBytes } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { hashPassword, hashToken, MIN_PASSWORD_LENGTH, type SessionUser } from './auth';
import type { DB } from './db/client';
import { bed, payment, property, room, tenancy, tenant, tenantInvite, user } from './db/schema';
import { depositSettlementOf } from './deposit';
import { ledgerEntries, ownedTenancy, RentalError } from './rentals';
import { todayInMalaysia } from './today';

export const INVITE_DAYS = 7;
const DAY_MS = 86_400_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- landlord side ----------

/** What the landlord sees about a tenant's portal access on the tenancy page. */
export function portalAccess(db: DB, ownerId: number, tenancyId: number, now = Date.now()) {
	const { tenant: t } = ownedTenancy(db, ownerId, tenancyId);
	const account = t.userId
		? (db.select({ email: user.email }).from(user).where(eq(user.id, t.userId)).get() ?? null)
		: null;
	const invite = db.select().from(tenantInvite).where(eq(tenantInvite.tenantId, t.id)).get();
	return {
		account,
		/** Malaysian date the open invite expires, or null. */
		inviteExpiresOn:
			invite && invite.expiresAt.getTime() > now ? todayInMalaysia(invite.expiresAt) : null
	};
}

/**
 * Creates a fresh invite link token for the tenant of `tenancyId`, replacing any earlier one.
 * The raw token is returned once and never stored.
 */
export function createInvite(db: DB, ownerId: number, tenancyId: number, now = Date.now()) {
	const { tenant: t } = ownedTenancy(db, ownerId, tenancyId);
	if (t.userId) throw new RentalError('This tenant already has a portal account');
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now + INVITE_DAYS * DAY_MS);
	db.transaction((tx) => {
		tx.delete(tenantInvite).where(eq(tenantInvite.tenantId, t.id)).run();
		tx.insert(tenantInvite)
			.values({ id: hashToken(token), tenantId: t.id, expiresAt })
			.run();
	});
	return { token, expiresAt };
}

/** Cancels an open invite and deletes the tenant's portal account (which signs them out). */
export function revokeAccess(db: DB, ownerId: number, tenancyId: number) {
	const { tenant: t } = ownedTenancy(db, ownerId, tenancyId);
	db.transaction((tx) => {
		tx.delete(tenantInvite).where(eq(tenantInvite.tenantId, t.id)).run();
		if (t.userId) {
			tx.update(tenant).set({ userId: null }).where(eq(tenant.id, t.id)).run();
			tx.delete(user)
				.where(and(eq(user.id, t.userId), eq(user.role, 'tenant')))
				.run();
		}
	});
}

// ---------- invite link (public) ----------

function openInvite(db: DB, token: string, now: number) {
	const row = db
		.select({ invite: tenantInvite, tenant, ownerName: user.name })
		.from(tenantInvite)
		.innerJoin(tenant, eq(tenantInvite.tenantId, tenant.id))
		.innerJoin(user, eq(tenant.ownerId, user.id))
		.where(eq(tenantInvite.id, hashToken(token)))
		.get();
	if (!row || row.tenant.userId) return null;
	if (row.invite.expiresAt.getTime() <= now) {
		db.delete(tenantInvite).where(eq(tenantInvite.id, row.invite.id)).run();
		return null;
	}
	return row;
}

/** Details shown on the invite page, or null if the link is unknown, used or expired. */
export function inviteDetails(db: DB, token: string, now = Date.now()) {
	const row = openInvite(db, token, now);
	if (!row) return null;
	return {
		tenantName: row.tenant.name,
		landlordName: row.ownerName,
		email: row.tenant.email ?? '',
		expiresOn: todayInMalaysia(row.invite.expiresAt)
	};
}

/** Creates the tenant's account from an invite. The link stops working once used. */
export async function acceptInvite(
	db: DB,
	token: string,
	input: { email: string; password: string },
	now = Date.now()
): Promise<SessionUser> {
	const email = input.email.trim().toLowerCase();
	if (!EMAIL.test(email)) throw new RentalError('Enter a valid email address');
	if (input.password.length < MIN_PASSWORD_LENGTH)
		throw new RentalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
	if (!openInvite(db, token, now)) throw new RentalError('This invite link is no longer valid');
	const passwordHash = await hashPassword(input.password);

	// Checked again inside one synchronous transaction, so a link cannot be used twice.
	return db.transaction((tx) => {
		const row = openInvite(tx, token, now);
		if (!row) throw new RentalError('This invite link is no longer valid');
		if (tx.select({ id: user.id }).from(user).where(eq(user.email, email)).get())
			throw new RentalError('That email already has an account. Use another email.');
		const account = tx
			.insert(user)
			.values({ email, name: row.tenant.name, passwordHash, role: 'tenant' })
			.returning()
			.get();
		tx.update(tenant).set({ userId: account.id }).where(eq(tenant.id, row.tenant.id)).run();
		tx.delete(tenantInvite).where(eq(tenantInvite.id, row.invite.id)).run();
		return { id: account.id, name: account.name, email: account.email, role: 'tenant' as const };
	});
}

// ---------- tenant side (scoped to the signed-in tenant account) ----------

function tenantTenancies(db: DB, userId: number) {
	return db
		.select({
			tenancy,
			bedLabel: bed.label,
			roomName: room.name,
			propertyName: property.name,
			propertyArea: property.area,
			landlordName: user.name
		})
		.from(tenancy)
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.innerJoin(user, eq(property.ownerId, user.id))
		.where(eq(tenant.userId, userId))
		.orderBy(asc(tenancy.startDate), asc(tenancy.id))
		.all();
}

/** The signed-in tenant's tenancies with their full ledgers, newest stay first. */
export function tenantHome(db: DB, userId: number, today: string) {
	return tenantTenancies(db, userId)
		.reverse()
		.map((r) => ({
			...r,
			active: r.tenancy.endDate === null || r.tenancy.endDate > today,
			deposit: depositSettlementOf(db, r.tenancy.id),
			...ledgerEntries(db, r.tenancy.id, today)
		}));
}

/** A payment receipt, only if the payment belongs to the signed-in tenant. */
export function tenantReceipt(db: DB, userId: number, paymentId: number) {
	const row = db
		.select({
			payment,
			tenantName: tenant.name,
			bedLabel: bed.label,
			roomName: room.name,
			propertyName: property.name,
			propertyArea: property.area,
			landlordName: user.name
		})
		.from(payment)
		.innerJoin(tenancy, eq(payment.tenancyId, tenancy.id))
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.innerJoin(user, eq(property.ownerId, user.id))
		.where(and(eq(payment.id, paymentId), eq(tenant.userId, userId)))
		.get();
	if (!row) throw new RentalError('Receipt not found');
	return { ...row, number: receiptNumber(row.payment.id) };
}

export function receiptNumber(paymentId: number): string {
	return `R-${String(paymentId).padStart(6, '0')}`;
}
