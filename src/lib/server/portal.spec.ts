import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authenticate, createSession, validateSession } from './auth';
import { createDb, type DB } from './db/client';
import { tenant, tenantInvite, user } from './db/schema';
import {
	acceptInvite,
	createInvite,
	INVITE_DAYS,
	inviteDetails,
	portalAccess,
	receiptNumber,
	revokeAccess,
	tenantHome,
	tenantReceipt
} from './portal';
import {
	addBed,
	addProperty,
	addRoom,
	moveIn,
	recordPayment,
	RentalError,
	generateRent
} from './rentals';
import { DEMO_TENANT_NAME, seedDemo } from './seed';

let db: DB;
let owner: number;
let other: number;
const now = Date.UTC(2026, 10, 25, 4);
const DAY = 86_400_000;

function landlord(email: string) {
	return db
		.insert(user)
		.values({ email, name: `Landlord ${email}`, passwordHash: 'x' })
		.returning()
		.get().id;
}

function stay(ownerId: number, name: string) {
	const p = addProperty(db, ownerId, { name: `House of ${name}`, area: 'Simpang Ampat' });
	const r = addRoom(db, ownerId, p.id, 'Room 1');
	const b = addBed(db, ownerId, r.id, { label: 'A', defaultRentSen: 40000 });
	return moveIn(db, ownerId, {
		bedId: b.id,
		tenantName: name,
		tenantEmail: `${name.toLowerCase()}@example.test`,
		startDate: '2026-10-01',
		monthlyRentSen: 40000,
		depositSen: 80000
	});
}

async function signUp(tenancyId: number, email: string, ownerId = owner) {
	const { token } = createInvite(db, ownerId, tenancyId, now);
	return acceptInvite(db, token, { email, password: 'tenant-pass-1' }, now);
}

beforeEach(() => {
	db = createDb(':memory:');
	owner = landlord('owner@example.test');
	other = landlord('other@example.test');
});

describe('invites', () => {
	it('stores only a hash, shows details, and works exactly once', async () => {
		const t = stay(owner, 'Aisyah');
		const { token, expiresAt } = createInvite(db, owner, t.id, now);
		expect(expiresAt.getTime()).toBe(now + INVITE_DAYS * DAY);
		const stored = db.select().from(tenantInvite).all();
		expect(stored).toHaveLength(1);
		expect(stored[0].id).not.toContain(token);

		expect(inviteDetails(db, token, now)).toMatchObject({
			tenantName: 'Aisyah',
			landlordName: 'Landlord owner@example.test',
			email: 'aisyah@example.test',
			expiresOn: '2026-12-02'
		});
		const account = await acceptInvite(
			db,
			token,
			{ email: ' Aisyah@Example.test ', password: 'tenant-pass-1' },
			now
		);
		expect(account).toMatchObject({ role: 'tenant', name: 'Aisyah', email: 'aisyah@example.test' });
		expect(db.select().from(tenant).where(eq(tenant.id, t.tenantId)).get()?.userId).toBe(
			account.id
		);
		expect(db.select().from(tenantInvite).all()).toHaveLength(0);
		expect(inviteDetails(db, token, now)).toBeNull();
		await expect(
			acceptInvite(db, token, { email: 'again@example.test', password: 'tenant-pass-1' }, now)
		).rejects.toThrow('no longer valid');
		expect((await authenticate(db, 'aisyah@example.test', 'tenant-pass-1'))?.role).toBe('tenant');
	});

	it('expires after 7 days and is cleaned up', () => {
		const t = stay(owner, 'Ben');
		const { token } = createInvite(db, owner, t.id, now);
		expect(inviteDetails(db, token, now + INVITE_DAYS * DAY - 1)).not.toBeNull();
		expect(inviteDetails(db, token, now + INVITE_DAYS * DAY)).toBeNull();
		expect(db.select().from(tenantInvite).all()).toHaveLength(0);
	});

	it('a new link replaces the old one', () => {
		const t = stay(owner, 'Chen');
		const first = createInvite(db, owner, t.id, now);
		const second = createInvite(db, owner, t.id, now);
		expect(inviteDetails(db, first.token, now)).toBeNull();
		expect(inviteDetails(db, second.token, now)).not.toBeNull();
		expect(portalAccess(db, owner, t.id, now)).toEqual({
			account: null,
			inviteExpiresOn: '2026-12-02'
		});
	});

	it('validates input and refuses an email that already has an account', async () => {
		const t = stay(owner, 'Dina');
		const { token } = createInvite(db, owner, t.id, now);
		const tryWith = (email: string, password: string) =>
			acceptInvite(db, token, { email, password }, now);
		await expect(tryWith('not-an-email', 'tenant-pass-1')).rejects.toThrow('valid email');
		await expect(tryWith('dina@example.test', 'short')).rejects.toThrow('at least 8');
		await expect(tryWith('OWNER@example.test', 'tenant-pass-1')).rejects.toThrow(
			'already has an account'
		);
		expect(inviteDetails(db, token, now)).not.toBeNull();
	});

	it('cannot invite a tenant who already has an account, or another landlord’s tenant', async () => {
		const t = stay(owner, 'Eng');
		await signUp(t.id, 'eng@example.test');
		expect(() => createInvite(db, owner, t.id, now)).toThrow('already has a portal account');
		expect(() => createInvite(db, other, t.id, now)).toThrow(RentalError);
		expect(() => portalAccess(db, other, t.id, now)).toThrow(RentalError);
		expect(() => revokeAccess(db, other, t.id)).toThrow(RentalError);
	});

	it('revoking deletes the account and signs the tenant out, but keeps the ledger', async () => {
		const t = stay(owner, 'Faiz');
		const account = await signUp(t.id, 'faiz@example.test');
		const { token } = createSession(db, account.id);
		expect(portalAccess(db, owner, t.id, now).account).toEqual({ email: 'faiz@example.test' });
		revokeAccess(db, owner, t.id);
		expect(validateSession(db, token)).toBeNull();
		expect(db.select().from(user).where(eq(user.id, account.id)).get()).toBeUndefined();
		expect(db.select().from(tenant).where(eq(tenant.id, t.tenantId)).get()).toMatchObject({
			name: 'Faiz',
			userId: null
		});
		// They can be invited again.
		expect(createInvite(db, owner, t.id, now).token).toBeTruthy();
	});
});

describe('tenant views', () => {
	it('a tenant sees only their own tenancy, ledger and receipts', async () => {
		const mine = stay(owner, 'Gita');
		const neighbour = stay(owner, 'Hadi');
		const elsewhere = stay(other, 'Ivan');
		generateRent(db, owner, '2026-11');
		generateRent(db, other, '2026-11');
		const myPay = recordPayment(db, owner, mine.id, {
			amountSen: 15000,
			paidOn: '2026-11-03',
			method: 'bank_transfer',
			reference: 'DEMO-1'
		});
		const theirPay = recordPayment(db, owner, neighbour.id, {
			amountSen: 40000,
			paidOn: '2026-11-03',
			method: 'cash'
		});
		const foreignPay = recordPayment(db, other, elsewhere.id, {
			amountSen: 40000,
			paidOn: '2026-11-03',
			method: 'cash'
		});
		const gita = await signUp(mine.id, 'gita@example.test');
		await signUp(neighbour.id, 'hadi@example.test');

		const home = tenantHome(db, gita.id, '2026-11-25');
		expect(home).toHaveLength(1);
		expect(home[0].tenancy.id).toBe(mine.id);
		expect(home[0]).toMatchObject({
			propertyName: 'House of Gita',
			landlordName: 'Landlord owner@example.test',
			chargedSen: 40000,
			paidSen: 15000,
			balanceSen: 25000,
			active: true
		});
		expect(home[0].payments.map((p) => p.id)).toEqual([myPay.id]);
		expect(home[0].charges.every((c) => c.tenancyId === mine.id)).toBe(true);

		expect(tenantReceipt(db, gita.id, myPay.id)).toMatchObject({
			number: receiptNumber(myPay.id),
			tenantName: 'Gita',
			payment: { amountSen: 15000, reference: 'DEMO-1' }
		});
		expect(() => tenantReceipt(db, gita.id, theirPay.id)).toThrow('Receipt not found');
		expect(() => tenantReceipt(db, gita.id, foreignPay.id)).toThrow('Receipt not found');
		expect(() => tenantReceipt(db, gita.id, 999_999)).toThrow('Receipt not found');
	});

	it('a landlord account sees nothing in the portal', () => {
		stay(owner, 'Jun');
		expect(tenantHome(db, owner, '2026-11-25')).toEqual([]);
	});

	it('the demo seed links the demo tenant account to one tenancy', async () => {
		const { tenantUserId, tenancies } = await seedDemo(db, '2026-11-25');
		const home = tenantHome(db, tenantUserId, '2026-11-25');
		expect(home.map((h) => h.tenancy.id)).toEqual([tenancies[DEMO_TENANT_NAME]]);
		expect(home[0].balanceSen).toBeGreaterThan(0);
	});
});

describe('receiptNumber', () => {
	it('pads the payment id', () => {
		expect(receiptNumber(42)).toBe('R-000042');
	});
});
