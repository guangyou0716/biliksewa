import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type DB } from './db/client';
import { charge, user } from './db/schema';
import {
	addBed,
	addProperty,
	addRoom,
	dashboard,
	generateRent,
	listTenancies,
	moveIn,
	moveOut,
	previewUtilitySplit,
	propertyBoard,
	recordPayment,
	RentalError,
	splitUtilityBill,
	tenancyLedger
} from './rentals';
import { seedDemo } from './seed';

let db: DB;
let owner: number;
let other: number;

function landlord(email: string) {
	return db.insert(user).values({ email, name: email, passwordHash: 'x' }).returning().get().id;
}

function house(ownerId = owner) {
	const p = addProperty(db, ownerId, { name: 'Rumah Ujian', area: 'Simpang Ampat' });
	const r = addRoom(db, ownerId, p.id, 'Room 1');
	const a = addBed(db, ownerId, r.id, { label: 'A', defaultRentSen: 40000 });
	const b = addBed(db, ownerId, r.id, { label: 'B', defaultRentSen: 40000 });
	return { p, r, a, b };
}

function tenantOn(bedId: number, startDate: string, rent = 40000, name = 'Test Tenant') {
	return moveIn(db, owner, {
		bedId,
		tenantName: name,
		startDate,
		monthlyRentSen: rent,
		depositSen: rent
	});
}

beforeEach(() => {
	db = createDb(':memory:');
	owner = landlord('owner@example.test');
	other = landlord('other@example.test');
});

describe('properties, rooms and beds', () => {
	it('builds a board with occupancy for today', () => {
		const { p, a } = house();
		tenantOn(a.id, '2026-10-01');
		const board = propertyBoard(db, owner, p.id, '2026-11-25');
		expect(board.rooms).toHaveLength(1);
		expect(board.rooms[0].beds.map((b) => [b.label, b.occupant?.tenantName ?? null])).toEqual([
			['A', 'Test Tenant'],
			['B', null]
		]);
	});

	it('rejects duplicate rooms and beds', () => {
		const { p, r } = house();
		expect(() => addRoom(db, owner, p.id, ' Room 1 ')).toThrow(/already exists/);
		expect(() => addBed(db, owner, r.id, { label: 'A', defaultRentSen: 1 })).toThrow(
			/already exists/
		);
		expect(() => addBed(db, owner, r.id, { label: 'C', defaultRentSen: 0 })).toThrow(RentalError);
	});

	it("never lets one landlord read or change another landlord's data", () => {
		const { p, r, a } = house();
		const t = tenantOn(a.id, '2026-10-01');
		expect(() => propertyBoard(db, other, p.id, '2026-11-25')).toThrow(/not found/);
		expect(() => addRoom(db, other, p.id, 'Sneaky')).toThrow(/not found/);
		expect(() => addBed(db, other, r.id, { label: 'Z', defaultRentSen: 100 })).toThrow(/not found/);
		expect(() =>
			moveIn(db, other, {
				bedId: a.id,
				tenantName: 'X',
				startDate: '2027-01-01',
				monthlyRentSen: 1,
				depositSen: 0
			})
		).toThrow(/not found/);
		expect(() => tenancyLedger(db, other, t.id, '2026-11-25')).toThrow(/not found/);
		expect(() =>
			recordPayment(db, other, t.id, { amountSen: 100, paidOn: '2026-11-01', method: 'cash' })
		).toThrow(/not found/);
		expect(() => moveOut(db, other, t.id, '2026-12-01')).toThrow(/not found/);
		expect(generateRent(db, other, '2026-11')).toEqual({ created: 0, skipped: 0, totalSen: 0 });
		expect(listTenancies(db, other, '2026-11-25')).toEqual([]);
	});
});

describe('move in / move out', () => {
	it('refuses a second tenant on an occupied bed', () => {
		const { a } = house();
		tenantOn(a.id, '2026-10-01');
		expect(() => tenantOn(a.id, '2026-12-01')).toThrow(/already taken/);
	});

	it('allows the next tenant from the move-out day', () => {
		const { a } = house();
		const first = tenantOn(a.id, '2026-01-01');
		moveOut(db, owner, first.id, '2026-10-10');
		expect(() => tenantOn(a.id, '2026-10-09')).toThrow(/already taken/);
		expect(tenantOn(a.id, '2026-10-10').bedId).toBe(a.id);
	});

	it('validates move-out', () => {
		const { a } = house();
		const t = tenantOn(a.id, '2026-10-01');
		expect(() => moveOut(db, owner, t.id, '2026-10-01')).toThrow(/after the move-in/);
		moveOut(db, owner, t.id, '2026-11-01');
		expect(() => moveOut(db, owner, t.id, '2026-12-01')).toThrow(/already moved out/);
	});
});

describe('rent billing', () => {
	it('re-pro-rates rent already billed when the tenant moves out', () => {
		const { a } = house();
		const t = tenantOn(a.id, '2026-09-01', 31000);
		generateRent(db, owner, '2026-10');
		generateRent(db, owner, '2026-11');
		moveOut(db, owner, t.id, '2026-10-11');
		const rents = db.select().from(charge).where(eq(charge.tenancyId, t.id)).all();
		// 10 of 31 nights in October; nothing in November.
		expect(rents.map((c) => [c.period, c.amountSen])).toEqual([['2026-10', 10000]]);
	});

	it('pro-rates and is idempotent per month', () => {
		const { a, b } = house();
		tenantOn(a.id, '2026-09-01', 40000);
		tenantOn(b.id, '2026-10-16', 38000);
		expect(generateRent(db, owner, '2026-10')).toEqual({
			created: 2,
			skipped: 0,
			totalSen: 40000 + 19613
		});
		expect(generateRent(db, owner, '2026-10')).toEqual({ created: 0, skipped: 2, totalSen: 0 });
		expect(db.select().from(charge).where(eq(charge.kind, 'rent')).all()).toHaveLength(2);
	});

	it('the database itself refuses a duplicate rent charge', () => {
		const { a } = house();
		const t = tenantOn(a.id, '2026-09-01');
		generateRent(db, owner, '2026-10');
		expect(() =>
			db
				.insert(charge)
				.values({
					tenancyId: t.id,
					kind: 'rent',
					period: '2026-10',
					description: 'dup',
					amountSen: 1,
					dueDate: '2026-10-07'
				})
				.run()
		).toThrow(/UNIQUE/);
	});

	it('skips tenants who were not there that month', () => {
		const { a } = house();
		const t = tenantOn(a.id, '2026-09-01');
		moveOut(db, owner, t.id, '2026-10-01');
		expect(generateRent(db, owner, '2026-10').created).toBe(0);
	});
});

describe('utility bill split', () => {
	it('splits by nights and the saved shares sum to the bill', () => {
		const { p, a, b } = house();
		const t1 = tenantOn(a.id, '2026-09-01', 40000, 'Full Month');
		const t2 = tenantOn(b.id, '2026-10-16', 40000, 'Half Month');
		const input = {
			propertyId: p.id,
			amountSen: 28745,
			fromDate: '2026-10-01',
			toDate: '2026-10-31'
		};
		const preview = previewUtilitySplit(db, owner, input);
		expect(preview.map((s) => [s.tenantName, s.nights])).toEqual([
			['Full Month', 31],
			['Half Month', 16]
		]);
		const { shares } = splitUtilityBill(db, owner, {
			...input,
			label: 'TNB',
			dueDate: '2026-11-07'
		});
		const saved = db.select().from(charge).where(eq(charge.kind, 'utility')).all();
		expect(saved.reduce((s, c) => s + c.amountSen, 0)).toBe(28745);
		expect(saved.map((c) => c.tenancyId).sort()).toEqual([t1.id, t2.id].sort());
		expect(shares).toEqual(preview);
		expect(saved[0].period).toBe('2026-10');
		expect(() =>
			splitUtilityBill(db, owner, { ...input, label: ' TNB ', dueDate: '2026-11-07' })
		).toThrow(/already split/);
	});

	it('rejects empty houses and bad periods', () => {
		const { p } = house();
		const base = {
			propertyId: p.id,
			amountSen: 1000,
			fromDate: '2026-10-01',
			toDate: '2026-10-31'
		};
		expect(() => previewUtilitySplit(db, owner, base)).toThrow(/Nobody stayed/);
		expect(() => previewUtilitySplit(db, owner, { ...base, toDate: '2026-09-30' })).toThrow(
			/ends before/
		);
		expect(() => previewUtilitySplit(db, owner, { ...base, amountSen: 0 })).toThrow(/more than/);
	});
});

describe('ledger and dashboard', () => {
	it('tracks balance and overdue from payments applied oldest first', () => {
		const { a } = house();
		const t = tenantOn(a.id, '2026-09-01', 40000);
		generateRent(db, owner, '2026-09');
		generateRent(db, owner, '2026-10');
		recordPayment(db, owner, t.id, {
			amountSen: 50000,
			paidOn: '2026-09-05',
			method: 'bank_transfer',
			reference: ' TRF1 '
		});
		const ledger = tenancyLedger(db, owner, t.id, '2026-11-25');
		expect(ledger.chargedSen).toBe(80000);
		expect(ledger.paidSen).toBe(50000);
		expect(ledger.balanceSen).toBe(30000);
		expect(ledger.overdueSen).toBe(30000);
		expect(ledger.charges.map((c) => c.unpaidSen)).toEqual([0, 30000]);
		expect(ledger.payments[0].reference).toBe('TRF1');
		expect(() =>
			recordPayment(db, owner, t.id, { amountSen: 0, paidOn: '2026-09-05', method: 'cash' })
		).toThrow();
	});

	it('summarises the synthetic demo data consistently', async () => {
		db = createDb(':memory:');
		const { ownerId } = await seedDemo(db, '2026-11-25');
		const d = dashboard(db, ownerId, '2026-11-25');
		expect(d.period).toBe('2026-11');
		expect(d.beds).toBe(10);
		expect(d.occupied).toBe(6);
		expect(d.vacant).toBe(4);
		expect(d.billedSen).toBeGreaterThan(0);
		expect(d.collectedSen).toBe(76424 + 43951);
		const tenancies = listTenancies(db, ownerId, '2026-11-25');
		expect(d.outstandingSen).toBe(tenancies.reduce((s, t) => s + Math.max(0, t.balanceSen), 0));
		expect(d.overdue.length).toBeGreaterThan(0);
		for (const t of d.overdue) expect(t.overdueSen).toBeLessThanOrEqual(t.balanceSen);

		expect(generateRent(db, ownerId, '2026-11')).toEqual({ created: 0, skipped: 6, totalSen: 0 });
		const rentSen = db
			.select()
			.from(charge)
			.where(eq(charge.period, '2026-11'))
			.all()
			.reduce((s, c) => s + c.amountSen, 0);
		expect(d.billedSen).toBe(rentSen);
	});
});
