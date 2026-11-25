import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type DB } from './db/client';
import { tenancy, tenant, user } from './db/schema';
import {
	addBed,
	addProperty,
	addRoom,
	generateRent,
	moveIn,
	moveOut,
	recordPayment,
	RentalError
} from './rentals';
import {
	chargesCsv,
	CHARGES_CSV_HEADER,
	landlordReceipt,
	landlordStatement,
	monthlyStatement,
	overdueReminders,
	paymentsCsv,
	tenantStatement
} from './reports';
import { escapeHtml, statementFileName, statementHtml } from './statement-html';

let db: DB;
let owner: number;
let other: number;

function account(email: string, role: 'landlord' | 'tenant' = 'landlord') {
	return db
		.insert(user)
		.values({ email, name: `User ${email}`, passwordHash: 'x', role })
		.returning()
		.get().id;
}

/** One property with one bed per tenant, all moving in on 2026-09-01 (rent due on the 7th). */
function house(ownerId: number, name: string, tenants: string[], rentSen = 40000) {
	const p = addProperty(db, ownerId, { name, area: 'Simpang Ampat' });
	const r = addRoom(db, ownerId, p.id, 'Room 1');
	return tenants.map((t, i) => {
		const b = addBed(db, ownerId, r.id, {
			label: String.fromCharCode(65 + i),
			defaultRentSen: rentSen
		});
		return moveIn(db, ownerId, {
			bedId: b.id,
			tenantName: t,
			startDate: '2026-09-01',
			monthlyRentSen: rentSen,
			depositSen: rentSen * 2
		}).id;
	});
}

function linkAccount(tenancyId: number, email: string) {
	const userId = account(email, 'tenant');
	const { tenantId } = db
		.select({ tenantId: tenancy.tenantId })
		.from(tenancy)
		.where(eq(tenancy.id, tenancyId))
		.get()!;
	db.update(tenant).set({ userId }).where(eq(tenant.id, tenantId)).run();
	return userId;
}

beforeEach(() => {
	db = createDb(':memory:');
	owner = account('owner@example.test');
	other = account('other@example.test');
});

describe('monthly statements', () => {
	it('brings the balance forward, lists the month and carries the balance forward', () => {
		const [aina] = house(owner, 'Rumah Uji', ['Aina']);
		for (const m of ['2026-09', '2026-10', '2026-11']) generateRent(db, owner, m);
		recordPayment(db, owner, aina, { amountSen: 40000, paidOn: '2026-09-05', method: 'cash' });
		recordPayment(db, owner, aina, {
			amountSen: 25000,
			paidOn: '2026-10-09',
			method: 'bank_transfer',
			reference: 'TRF-1'
		});
		recordPayment(db, owner, aina, { amountSen: 10000, paidOn: '2026-10-30', method: 'cash' });

		const s = monthlyStatement(db, aina, '2026-10');
		expect(s.openingSen).toBe(0);
		expect(s.chargesSen).toBe(40000);
		expect(s.paymentsSen).toBe(35000);
		expect(s.closingSen).toBe(5000);
		expect(s.lines.map((l) => [l.date, l.kind, l.description, l.balanceSen])).toEqual([
			['2026-10-07', 'charge', 'Rent 2026-10', 40000],
			['2026-10-09', 'payment', 'Payment, bank transfer (TRF-1)', 15000],
			['2026-10-30', 'payment', 'Payment, cash', 5000]
		]);
		expect(s.lines[1].paymentId).toBeTypeOf('number');
		expect(s.lines[0].paymentId).toBeUndefined();

		// November opens with October's closing balance.
		const nov = monthlyStatement(db, aina, '2026-11');
		expect(nov.openingSen).toBe(5000);
		expect(nov.closingSen).toBe(45000);
	});

	it('shows credit as a negative balance and handles a month with nothing in it', () => {
		const [t] = house(owner, 'Rumah Uji', ['Ben']);
		generateRent(db, owner, '2026-09');
		recordPayment(db, owner, t, { amountSen: 50000, paidOn: '2026-09-01', method: 'cash' });
		const s = monthlyStatement(db, t, '2026-12');
		expect(s).toMatchObject({
			openingSen: -10000,
			chargesSen: 0,
			paymentsSen: 0,
			closingSen: -10000
		});
		expect(s.lines).toEqual([]);
	});

	it('is scoped to the landlord who owns the property', () => {
		const [mine] = house(owner, 'Mine', ['Aina']);
		const [theirs] = house(other, 'Theirs', ['Chong']);
		expect(landlordStatement(db, owner, mine, '2026-09').stay.tenantName).toBe('Aina');
		expect(() => landlordStatement(db, owner, theirs, '2026-09')).toThrow(RentalError);
		expect(() => landlordStatement(db, other, mine, '2026-09')).toThrow(RentalError);
		expect(() => landlordStatement(db, owner, 999, '2026-09')).toThrow(RentalError);
	});

	it('lets a tenant account open only its own statements', () => {
		const [aina, ben] = house(owner, 'Rumah Uji', ['Aina', 'Ben']);
		const ainaUser = linkAccount(aina, 'aina@example.test');
		const benUser = linkAccount(ben, 'ben@example.test');
		expect(tenantStatement(db, ainaUser, aina, '2026-09').stay.tenantName).toBe('Aina');
		expect(() => tenantStatement(db, ainaUser, ben, '2026-09')).toThrow(RentalError);
		expect(() => tenantStatement(db, benUser, aina, '2026-09')).toThrow(RentalError);
		// The landlord's own account is not a tenant of anything.
		expect(() => tenantStatement(db, owner, aina, '2026-09')).toThrow(RentalError);
	});

	it('downloads as a self-contained, escaped HTML file', () => {
		const [t] = house(owner, 'Rumah <b>Uji</b>', ['<script>alert(1)</script>']);
		generateRent(db, owner, '2026-09');
		const s = landlordStatement(db, owner, t, '2026-09');
		const html = statementHtml(s, '2026-11-26');
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(html).toContain('Rumah &lt;b&gt;Uji&lt;/b&gt;');
		expect(html).not.toContain('<script');
		expect(html).not.toMatch(/https?:\/\//);
		expect(html).toContain('RM 400.00');
		expect(statementFileName(s)).toBe(`biliksewa-statement-${t}-2026-09.html`);
		expect(escapeHtml(`a&b"'`)).toBe('a&amp;b&quot;&#39;');
	});

	it('labels the downloaded file in the viewer’s language, keeping stored text as entered', () => {
		const [t] = house(owner, 'Rumah Uji', ['<i>Aina</i>']);
		generateRent(db, owner, '2026-09');
		const s = landlordStatement(db, owner, t, '2026-09');
		const ms = statementHtml(s, '2026-11-26', 'ms');
		expect(ms).toContain('<html lang="ms">');
		expect(ms).toContain('Penyata bulanan 2026-09');
		expect(ms).toContain('Baki dibawa ke hadapan');
		expect(ms).toContain('Rent 2026-09');
		expect(ms).toContain('&lt;i&gt;Aina&lt;/i&gt;');
		const zh = statementHtml(s, '2026-11-26', 'zh');
		expect(zh).toContain('<html lang="zh-Hans">');
		expect(zh).toContain('2026-09 月结单');
		expect(zh).not.toContain('<i>');
		expect(statementHtml(s, '2026-11-26')).toContain('<html lang="en">');
	});
});

describe('landlord receipts', () => {
	it('opens receipts only for payments on the landlord’s own properties', () => {
		const [mine] = house(owner, 'Mine', ['Aina']);
		const [theirs] = house(other, 'Theirs', ['Chong']);
		const p1 = recordPayment(db, owner, mine, {
			amountSen: 100,
			paidOn: '2026-09-02',
			method: 'cash'
		});
		const p2 = recordPayment(db, other, theirs, {
			amountSen: 100,
			paidOn: '2026-09-02',
			method: 'cash'
		});
		expect(landlordReceipt(db, owner, p1.id)).toMatchObject({
			tenantName: 'Aina',
			number: `R-${String(p1.id).padStart(6, '0')}`
		});
		expect(() => landlordReceipt(db, owner, p2.id)).toThrow(RentalError);
		expect(() => landlordReceipt(db, other, p1.id)).toThrow(RentalError);
		expect(() => landlordReceipt(db, owner, 999)).toThrow(RentalError);
	});
});

describe('CSV exports', () => {
	it('exports only the landlord’s charges, with unpaid amounts and an optional month', () => {
		const [aina] = house(owner, 'Rumah Uji', ['Aina', 'Ben']);
		house(other, 'Theirs', ['Chong']);
		generateRent(db, owner, '2026-09');
		generateRent(db, owner, '2026-10');
		generateRent(db, other, '2026-09');
		recordPayment(db, owner, aina, { amountSen: 50000, paidOn: '2026-09-05', method: 'cash' });

		const csv = chargesCsv(db, owner);
		const lines = csv
			.replace(/^\uFEFF/, '')
			.trimEnd()
			.split('\r\n');
		expect(lines[0]).toBe(CHARGES_CSV_HEADER.join(','));
		expect(lines).toHaveLength(5);
		expect(csv).not.toContain('Chong');
		expect(lines).toContain(
			`${lines[1].split(',')[0]},2026-09,2026-09-07,Aina,Rumah Uji,Room 1,A,rent,Rent 2026-09,400.00,0.00`
		);
		// Aina paid RM 500: September is paid, RM 100 went to October.
		expect(lines.find((l) => l.includes(',Aina,') && l.includes('2026-10'))).toMatch(
			/,400\.00,300\.00$/
		);

		const sept = chargesCsv(db, owner, '2026-09').trimEnd().split('\r\n');
		expect(sept).toHaveLength(3);
		expect(chargesCsv(db, other)).not.toContain('Aina');
	});

	it('works out unpaid amounts per tenancy with a fixed number of queries', () => {
		const [aina, ben] = house(owner, 'Rumah Uji', ['Aina', 'Ben', 'Chen']);
		const [dina] = house(owner, 'Rumah Dua', ['Dina']);
		house(other, 'Theirs', ['Chong']);
		generateRent(db, owner, '2026-09');
		generateRent(db, owner, '2026-10');
		generateRent(db, other, '2026-09');
		// Payments on one tenancy never reduce what another owes.
		recordPayment(db, owner, aina, { amountSen: 50000, paidOn: '2026-09-05', method: 'cash' });
		recordPayment(db, owner, ben, { amountSen: 10000, paidOn: '2026-09-05', method: 'cash' });
		recordPayment(db, owner, ben, { amountSen: 30000, paidOn: '2026-09-20', method: 'cash' });
		recordPayment(db, owner, dina, { amountSen: 90000, paidOn: '2026-09-05', method: 'cash' });

		const client = (db as unknown as { $client: { prepare: (sql: string) => unknown } }).$client;
		const prepare = vi.spyOn(client, 'prepare');
		const csv = chargesCsv(db, owner);
		const queries = prepare.mock.calls.length;
		prepare.mockRestore();
		// Stays, charges, payments: not two more per tenancy.
		expect(queries).toBe(3);

		const unpaid = (name: string, month: string) =>
			csv
				.split('\r\n')
				.find((l) => l.includes(`,${name},`) && l.includes(`,${month},`))
				?.split(',')
				.at(-1);
		expect(unpaid('Aina', '2026-09')).toBe('0.00');
		expect(unpaid('Aina', '2026-10')).toBe('300.00');
		expect(unpaid('Ben', '2026-09')).toBe('0.00');
		expect(unpaid('Ben', '2026-10')).toBe('400.00');
		expect(unpaid('Chen', '2026-09')).toBe('400.00');
		expect(unpaid('Dina', '2026-10')).toBe('0.00');
		expect(csv).not.toContain('Chong');
		// A month filter shows the same unpaid amounts.
		expect(chargesCsv(db, owner, '2026-10')).toContain(
			',Aina,Rumah Uji,Room 1,A,rent,Rent 2026-10,400.00,300.00'
		);
	});

	it('exports only the landlord’s payments, optionally for the month paid', () => {
		const [aina] = house(owner, 'Rumah Uji', ['Aina']);
		const [chong] = house(other, 'Theirs', ['Chong']);
		recordPayment(db, owner, aina, {
			amountSen: 12345,
			paidOn: '2026-09-30',
			method: 'bank_transfer',
			reference: 'TRF-9'
		});
		recordPayment(db, owner, aina, { amountSen: 500, paidOn: '2026-10-01', method: 'cash' });
		recordPayment(db, other, chong, { amountSen: 999, paidOn: '2026-09-15', method: 'cash' });
		const all = paymentsCsv(db, owner).trimEnd().split('\r\n');
		expect(all).toHaveLength(3);
		expect(all[1]).toMatch(
			/^R-\d{6},2026-09-30,Aina,Rumah Uji,Room 1,A,Bank transfer,TRF-9,123\.45$/
		);
		const sept = paymentsCsv(db, owner, '2026-09').trimEnd().split('\r\n');
		expect(sept).toHaveLength(2);
		expect(paymentsCsv(db, owner)).not.toContain('Chong');
	});

	it('neutralises spreadsheet formulas typed into names, descriptions and references', () => {
		const [t] = house(owner, '=cmd|"/c calc"!A1', ['+Evil']);
		generateRent(db, owner, '2026-09');
		recordPayment(db, owner, t, {
			amountSen: 100,
			paidOn: '2026-09-02',
			method: 'other',
			reference: '-2+3'
		});
		const charges = chargesCsv(db, owner);
		expect(charges).toContain(`,'+Evil,"'=cmd|""/c calc""!A1",`);
		const payments = paymentsCsv(db, owner);
		expect(payments).toContain(",'-2+3,1.00");
		expect(payments).toContain(",'+Evil,");
	});
});

describe('overdue reminders', () => {
	it('lists who owes what, days overdue and a copyable message, most overdue first', () => {
		const [aina, ben, cara] = house(owner, 'Rumah Uji', ['Aina', 'Ben', 'Cara']);
		house(other, 'Theirs', ['Chong']);
		generateRent(db, owner, '2026-10');
		generateRent(db, owner, '2026-11');
		generateRent(db, other, '2026-10');
		// Aina owes October and November, Ben only November, Cara is fully paid.
		recordPayment(db, owner, ben, { amountSen: 40000, paidOn: '2026-10-05', method: 'cash' });
		recordPayment(db, owner, cara, { amountSen: 80000, paidOn: '2026-10-05', method: 'cash' });

		const list = overdueReminders(db, owner, '2026-11-26');
		expect(list.map((r) => [r.tenantName, r.overdueSen, r.daysOverdue, r.oldestDueDate])).toEqual([
			['Aina', 80000, 50, '2026-10-07'],
			['Ben', 40000, 19, '2026-11-07']
		]);
		expect(list[0].items.map((i) => [i.description, i.unpaidSen, i.daysOverdue])).toEqual([
			['Rent 2026-10', 40000, 50],
			['Rent 2026-11', 40000, 19]
		]);
		expect(list[0].message).toContain(
			'Hi Aina, this is a friendly reminder from User owner@example.test'
		);
		expect(list[0].message).toContain('RM 800.00 is overdue');
		expect(list[0].tenancyId).toBe(aina);
		expect(list.some((r) => r.tenantName === 'Chong')).toBe(false);
		expect(overdueReminders(db, other, '2026-11-26').map((r) => r.tenantName)).toEqual(['Chong']);
	});

	it('ignores charges not yet due and partly paid amounts already covered', () => {
		const [t] = house(owner, 'Rumah Uji', ['Aina']);
		generateRent(db, owner, '2026-11');
		// Due on the 7th: not overdue on the 7th itself.
		expect(overdueReminders(db, owner, '2026-11-07')).toEqual([]);
		recordPayment(db, owner, t, { amountSen: 15050, paidOn: '2026-11-06', method: 'cash' });
		const [r] = overdueReminders(db, owner, '2026-11-08');
		expect(r).toMatchObject({ overdueSen: 24950, daysOverdue: 1 });
		expect(r.message).toContain('RM 249.50, 1 day overdue');
	});

	it('keeps tenants who moved out and still owe money, marked as moved out', () => {
		const [t] = house(owner, 'Rumah Uji', ['Aina']);
		generateRent(db, owner, '2026-09');
		moveOut(db, owner, t, '2026-09-20');
		const [r] = overdueReminders(db, owner, '2026-11-26');
		expect(r).toMatchObject({ active: false, endDate: '2026-09-20', daysOverdue: 80 });
	});

	it('writes the messages in the chosen language', () => {
		house(owner, 'Rumah Uji', ['Aina']);
		generateRent(db, owner, '2026-10');
		const [ms] = overdueReminders(db, owner, '2026-11-26', 'ms');
		expect(ms.message).toMatch(/^Hai Aina, ini peringatan mesra/);
		expect(ms.message).toContain('Katil ');
		expect(ms.message).toContain('tertunggak 50 hari');
		const [zh] = overdueReminders(db, owner, '2026-11-26', 'zh');
		expect(zh.message).toContain('已逾期 50 天');
		expect(zh.where).toContain('床位 ');
	});
});
