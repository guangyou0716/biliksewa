import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type DB } from './db/client';
import { charge, depositSettlement, payment, tenancy, tenant, user } from './db/schema';
import { depositSettlementOf, settleDeposit } from './deposit';
import { tenantHome } from './portal';
import {
	addBed,
	addProperty,
	addRoom,
	dashboard,
	generateRent,
	moveIn,
	moveOut,
	recordPayment,
	tenancyLedger
} from './rentals';
import { seedDemo } from './seed';

let db: DB;
let owner: number;
let other: number;

function landlord(email: string) {
	return db.insert(user).values({ email, name: email, passwordHash: 'x' }).returning().get().id;
}

/** A tenancy from 1 Sep 2026 at RM 300/month with a RM 600 deposit, moved out on 1 Nov 2026. */
function movedOut(depositSen = 60000) {
	const p = addProperty(db, owner, { name: 'Rumah Ujian', area: 'Simpang Ampat' });
	const r = addRoom(db, owner, p.id, 'Room 1');
	const b = addBed(db, owner, r.id, { label: 'A', defaultRentSen: 30000 });
	const t = moveIn(db, owner, {
		bedId: b.id,
		tenantName: 'Test Tenant',
		startDate: '2026-09-01',
		monthlyRentSen: 30000,
		depositSen
	});
	generateRent(db, owner, '2026-09');
	generateRent(db, owner, '2026-10');
	recordPayment(db, owner, t.id, { amountSen: 30000, paidOn: '2026-09-05', method: 'cash' });
	moveOut(db, owner, t.id, '2026-11-01');
	return t;
}

const settle = (
	tenancyId: number,
	over: Partial<Parameters<typeof settleDeposit>[3]> = {},
	ownerId = owner
) =>
	settleDeposit(
		db,
		ownerId,
		tenancyId,
		{
			settledOn: '2026-11-03',
			deductions: [],
			refundMethod: 'bank_transfer',
			...over
		},
		'2026-11-25'
	);

beforeEach(() => {
	db = createDb(':memory:');
	owner = landlord('owner@example.test');
	other = landlord('other@example.test');
});

describe('settleDeposit', () => {
	it('takes deductions and unpaid rent from the deposit and refunds the rest', () => {
		const t = movedOut();
		// October rent (RM 300) is unpaid; cleaning RM 50 and a broken lock RM 35.50.
		const s = settle(t.id, {
			deductions: [
				{ label: ' Cleaning ', amountSen: 5000 },
				{ label: 'Broken lock', amountSen: 3550 }
			],
			refundReference: ' TRF-9 '
		});
		expect(s).toMatchObject({
			depositSen: 60000,
			deductionsSen: 8550,
			appliedSen: 38550,
			refundSen: 21450,
			refundMethod: 'bank_transfer',
			refundReference: 'TRF-9',
			balanceAfterSen: 0
		});
		expect(s.appliedSen + s.refundSen).toBe(s.depositSen);

		const ledger = tenancyLedger(db, owner, t.id, '2026-11-25');
		expect(ledger.balanceSen).toBe(0);
		expect(ledger.overdueSen).toBe(0);
		expect(ledger.payments.at(-1)).toMatchObject({
			method: 'deposit',
			amountSen: 38550,
			paidOn: '2026-11-03'
		});
		expect(
			ledger.charges.filter((c) => c.kind === 'other').map((c) => [c.description, c.period])
		).toEqual([
			['Deposit deduction: Cleaning', '2026-11'],
			['Deposit deduction: Broken lock', '2026-11']
		]);
		expect(depositSettlementOf(db, t.id)?.deductions.map((d) => [d.label, d.amountSen])).toEqual([
			['Cleaning', 5000],
			['Broken lock', 3550]
		]);
	});

	it('refunds everything when nothing is owed, without a deposit payment', () => {
		const t = movedOut();
		recordPayment(db, owner, t.id, { amountSen: 30000, paidOn: '2026-10-05', method: 'cash' });
		const s = settle(t.id);
		expect(s).toMatchObject({ appliedSen: 0, refundSen: 60000, paymentId: null });
		expect(db.select().from(payment).where(eq(payment.method, 'deposit')).all()).toHaveLength(0);
	});

	it('uses the whole deposit when the tenant owes more, and keeps the rest owing', () => {
		const t = movedOut(20000);
		const s = settle(t.id, { deductions: [{ label: 'Repaint', amountSen: 15000 }] });
		expect(s).toMatchObject({ appliedSen: 20000, refundSen: 0, balanceAfterSen: 25000 });
		// Nothing to refund, so the refund details are not kept.
		expect(s.refundMethod).toBeNull();
		expect(tenancyLedger(db, owner, t.id, '2026-11-25').balanceSen).toBe(25000);
	});

	it('does not need a refund method when nothing is refunded', () => {
		const t = movedOut(30000);
		expect(settle(t.id, { refundMethod: null })).toMatchObject({ refundSen: 0 });
	});

	it('validates the settlement', () => {
		const t = movedOut();
		expect(() => settle(t.id, { settledOn: '2026-10-31' })).toThrow(/before the move-out/);
		expect(() => settle(t.id, { settledOn: '2026-11-26' })).toThrow(/in the future/);
		expect(() => settle(t.id, { deductions: [{ label: 'x'.repeat(81), amountSen: 100 }] })).toThrow(
			/under 80/
		);
		expect(() => settle(t.id, { deductions: [{ label: '', amountSen: 100 }] })).toThrow(
			/description/
		);
		expect(() => settle(t.id, { deductions: [{ label: 'X', amountSen: 0 }] })).toThrow(
			/more than RM 0/
		);
		expect(() => settle(t.id, { deductions: [{ label: 'X', amountSen: 60001 }] })).toThrow(
			/more than the deposit/
		);
		expect(() =>
			settle(t.id, {
				deductions: Array.from({ length: 6 }, () => ({ label: 'X', amountSen: 1 }))
			})
		).toThrow(/At most 5/);
		expect(() => settle(t.id, { refundMethod: null })).toThrow(/how the refund is paid/);
		// A failed attempt writes nothing.
		expect(db.select().from(depositSettlement).all()).toHaveLength(0);
		expect(db.select().from(charge).where(eq(charge.kind, 'other')).all()).toHaveLength(0);
	});

	it('settles once, only after move-out, and only with a deposit', () => {
		const t = movedOut();
		settle(t.id);
		expect(() => settle(t.id)).toThrow(/already settled/);

		const p = addProperty(db, owner, { name: 'Rumah Dua', area: 'Jawi' });
		const r = addRoom(db, owner, p.id, 'Room 1');
		const b = addBed(db, owner, r.id, { label: 'A', defaultRentSen: 30000 });
		const staying = moveIn(db, owner, {
			bedId: b.id,
			tenantName: 'Still Here',
			startDate: '2026-09-01',
			monthlyRentSen: 30000,
			depositSen: 30000
		});
		expect(() => settle(staying.id)).toThrow(/Record the move-out/);
		const b2 = addBed(db, owner, r.id, { label: 'B', defaultRentSen: 30000 });
		const noDeposit = moveIn(db, owner, {
			bedId: b2.id,
			tenantName: 'No Deposit',
			startDate: '2026-09-01',
			monthlyRentSen: 30000,
			depositSen: 0
		});
		moveOut(db, owner, noDeposit.id, '2026-10-01');
		expect(() => settle(noDeposit.id)).toThrow(/No deposit/);
	});

	it("never settles another landlord's tenancy", () => {
		const t = movedOut();
		expect(() => settle(t.id, {}, other)).toThrow(/not found/);
		expect(db.select().from(depositSettlement).all()).toHaveLength(0);
	});

	it('is not counted as cash collected on the dashboard', () => {
		const t = movedOut();
		settleDeposit(
			db,
			owner,
			t.id,
			{ settledOn: '2026-11-03', deductions: [], refundMethod: 'cash' },
			'2026-11-25'
		);
		expect(dashboard(db, owner, '2026-11-25').collectedSen).toBe(0);
	});
});

describe('demo data', () => {
	it('has a settled deposit that the tenant could see in the portal', async () => {
		const { ownerId, tenancies } = await seedDemo(db, '2026-11-25');
		const s = depositSettlementOf(db, tenancies['Farah Hani'])!;
		expect(s.deductions).toEqual([expect.objectContaining({ label: 'Room cleaning' })]);
		expect(s.appliedSen + s.refundSen).toBe(s.depositSen);
		expect(tenancyLedger(db, ownerId, tenancies['Farah Hani'], '2026-11-25').balanceSen).toBe(0);
		// The demo tenant (Priya) has no settlement; tenantHome exposes it per stay.
		const priyaUser = db.select().from(user).where(eq(user.role, 'tenant')).get()!;
		expect(tenantHome(db, priyaUser.id, '2026-11-25').map((h) => h.deposit)).toEqual([null]);

		// Once Farah has a portal account she sees her own settlement.
		const farahTenant = db
			.select({ tenantId: tenancy.tenantId })
			.from(tenancy)
			.where(eq(tenancy.id, tenancies['Farah Hani']))
			.get()!.tenantId;
		const farahUser = db
			.insert(user)
			.values({ email: 'farah@example.test', name: 'Farah', passwordHash: 'x', role: 'tenant' })
			.returning()
			.get();
		db.update(tenant).set({ userId: farahUser.id }).where(eq(tenant.id, farahTenant)).run();
		const home = tenantHome(db, farahUser.id, '2026-11-25');
		expect(home).toHaveLength(1);
		expect(home[0].deposit?.refundSen).toBe(s.refundSen);
	});
});
