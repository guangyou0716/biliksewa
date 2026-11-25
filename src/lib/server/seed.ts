import { addDays, monthOf, monthRange } from '../dates';
import { hashPassword } from './auth';
import type { DB } from './db/client';
import { eq } from 'drizzle-orm';
import { settleDeposit } from './deposit';
import { tenancy, tenant, user } from './db/schema';
import {
	addBed,
	addProperty,
	addRoom,
	generateRent,
	moveIn,
	moveOut,
	recordPayment,
	splitUtilityBill,
	tenancyLedger
} from './rentals';

export const DEMO_EMAIL = 'demo@biliksewa.test';
export const DEMO_PASSWORD = 'demo-landlord';
export const DEMO_TENANT_EMAIL = 'tenant@biliksewa.test';
export const DEMO_TENANT_PASSWORD = 'demo-tenant';
/** The demo tenant account belongs to this (synthetic) tenant. */
export const DEMO_TENANT_NAME = 'Priya Devi';

function previousMonth(period: string, n = 1): string {
	let [y, m] = period.split('-').map(Number);
	m -= n;
	while (m < 1) {
		m += 12;
		y -= 1;
	}
	return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Fills an empty database with synthetic demo data relative to `today`.
 * Every person, email and house here is made up.
 */
export async function seedDemo(db: DB, today: string) {
	const owner = db
		.insert(user)
		.values({
			email: DEMO_EMAIL,
			name: 'Demo Landlord',
			passwordHash: await hashPassword(DEMO_PASSWORD)
		})
		.returning()
		.get();
	const o = owner.id;

	const thisMonth = monthOf(today);
	const lastMonth = previousMonth(thisMonth);
	const twoAgo = previousMonth(thisMonth, 2);

	const mawar = addProperty(db, o, { name: 'Rumah Mawar (demo)', area: 'Bukit Mertajam' });
	const cempaka = addProperty(db, o, { name: 'Teres Cempaka (demo)', area: 'Bayan Lepas' });

	const beds: Record<string, number> = {};
	const layout: [number, string, [string, number][]][] = [
		[mawar.id, 'Master room', [['A', 65000]]],
		[
			mawar.id,
			'Middle room',
			[
				['A', 38000],
				['B', 38000]
			]
		],
		[mawar.id, 'Small room', [['A', 35000]]],
		[
			cempaka.id,
			'Room 1',
			[
				['A', 42000],
				['B', 42000]
			]
		],
		[cempaka.id, 'Room 2', [['A', 55000]]],
		[
			cempaka.id,
			'Room 3',
			[
				['A', 30000],
				['B', 30000],
				['C', 30000]
			]
		]
	];
	for (const [pid, roomName, bedList] of layout) {
		const r = addRoom(db, o, pid, roomName);
		for (const [label, rent] of bedList) {
			beds[`${pid}:${roomName}:${label}`] = addBed(db, o, r.id, { label, defaultRentSen: rent }).id;
		}
	}

	const start2 = monthRange(twoAgo).start;
	const midLast = `${lastMonth}-16`;
	const people: [string, string, string, number][] = [
		[`${mawar.id}:Master room:A`, 'Aina Sofea', start2, 65000],
		[`${mawar.id}:Middle room:A`, 'Tan Wei Jie', start2, 38000],
		[`${mawar.id}:Middle room:B`, 'Priya Devi', midLast, 38000],
		[`${cempaka.id}:Room 1:A`, 'Hafiz Danial', start2, 42000],
		[`${cempaka.id}:Room 1:B`, 'Ooi Mei Xin', start2, 42000],
		[`${cempaka.id}:Room 2:A`, 'Arun Raj', start2, 55000],
		[`${cempaka.id}:Room 3:A`, 'Farah Hani', start2, 30000]
	];
	const t: Record<string, number> = {};
	for (const [key, name, startDate, rent] of people) {
		t[name] = moveIn(db, o, {
			bedId: beds[key],
			tenantName: name,
			tenantEmail: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
			startDate,
			monthlyRentSen: rent,
			depositSen: rent * 2
		}).id;
	}
	// Farah moved out on the 10th of last month, so her last rent and bill share are pro-rated.
	moveOut(db, o, t['Farah Hani'], `${lastMonth}-10`);

	for (const period of [twoAgo, lastMonth, thisMonth]) generateRent(db, o, period);

	const lastRange = monthRange(lastMonth);
	splitUtilityBill(db, o, {
		propertyId: mawar.id,
		label: 'TNB electricity',
		amountSen: 28745,
		fromDate: lastRange.start,
		toDate: addDays(lastRange.endExclusive, -1),
		dueDate: `${thisMonth}-07`
	});
	splitUtilityBill(db, o, {
		propertyId: cempaka.id,
		label: 'PBAPP water',
		amountSen: 6420,
		fromDate: lastRange.start,
		toDate: addDays(lastRange.endExclusive, -1),
		dueDate: `${thisMonth}-07`
	});

	// Everyone paid the month before last; last month a few are behind.
	const pay = (
		name: string,
		sen: number,
		paidOn: string,
		method: 'cash' | 'bank_transfer',
		ref?: string
	) => recordPayment(db, o, t[name], { amountSen: sen, paidOn, method, reference: ref });
	pay('Aina Sofea', 65000, `${twoAgo}-05`, 'bank_transfer', 'DEMO-TRF-1001');
	pay('Tan Wei Jie', 38000, `${twoAgo}-06`, 'cash');
	pay('Hafiz Danial', 42000, `${twoAgo}-03`, 'bank_transfer', 'DEMO-TRF-1002');
	pay('Ooi Mei Xin', 42000, `${twoAgo}-07`, 'bank_transfer', 'DEMO-TRF-1003');
	pay('Arun Raj', 55000, `${twoAgo}-04`, 'cash');
	pay('Farah Hani', 30000, `${twoAgo}-02`, 'cash');
	pay('Aina Sofea', 65000, `${lastMonth}-05`, 'bank_transfer', 'DEMO-TRF-1004');
	pay('Hafiz Danial', 42000, `${lastMonth}-07`, 'bank_transfer', 'DEMO-TRF-1005');
	pay('Arun Raj', 30000, `${lastMonth}-09`, 'cash');
	pay('Priya Devi', 20000, `${lastMonth}-16`, 'bank_transfer', 'DEMO-TRF-1006');
	// This month so far (the 1st is always on or before "today").
	const settle = (name: string) => tenancyLedger(db, o, t[name], today).balanceSen;
	pay('Aina Sofea', settle('Aina Sofea'), `${thisMonth}-01`, 'bank_transfer', 'DEMO-TRF-1007');
	pay('Hafiz Danial', settle('Hafiz Danial'), `${thisMonth}-01`, 'cash');

	// Farah's deposit was settled two days after she left: cleaning deducted, the rest refunded.
	settleDeposit(
		db,
		o,
		t['Farah Hani'],
		{
			settledOn: `${lastMonth}-12`,
			deductions: [{ label: 'Room cleaning', amountSen: 5000 }],
			refundMethod: 'bank_transfer',
			refundReference: 'DEMO-REFUND-2001'
		},
		today
	);

	// Priya already accepted her invite, so visitors can sign in to the tenant portal.
	const priya = db
		.select({ tenantId: tenancy.tenantId })
		.from(tenancy)
		.where(eq(tenancy.id, t[DEMO_TENANT_NAME]))
		.get()!;
	const tenantUser = db
		.insert(user)
		.values({
			email: DEMO_TENANT_EMAIL,
			name: DEMO_TENANT_NAME,
			passwordHash: await hashPassword(DEMO_TENANT_PASSWORD),
			role: 'tenant'
		})
		.returning()
		.get();
	db.update(tenant).set({ userId: tenantUser.id }).where(eq(tenant.id, priya.tenantId)).run();

	return { ownerId: o, tenantUserId: tenantUser.id, tenancies: t };
}
