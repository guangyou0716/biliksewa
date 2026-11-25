import { and, asc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { allocatePayments } from '../billing';
import { toCsv, senToDecimal } from '../csv';
import { monthRange } from '../dates';
import { daysOverdue, reminderMessage } from '../reminder';
import { DEFAULT_LOCALE, translate, type Locale } from '../i18n';
import type { DB } from './db/client';
import { bed, charge, payment, property, room, tenancy, tenant, user } from './db/schema';
import { receiptNumber } from './portal';
import { ledgerEntries, RentalError } from './rentals';

// Receipts, monthly statements, CSV exports and overdue reminders. Every function is scoped either to a
// landlord (`ownerId` owns the property) or to a tenant account (`userId` is linked to the tenant), and
// answers "not found" the same way for rows that do not exist and rows that belong to someone else.

const METHOD_LABEL: Record<string, string> = {
	cash: 'Cash',
	bank_transfer: 'Bank transfer',
	other: 'Other',
	deposit: 'From deposit'
};
export const methodLabel = (method: string) => METHOD_LABEL[method] ?? method;

const placeColumns = {
	tenantName: tenant.name,
	bedLabel: bed.label,
	roomName: room.name,
	propertyName: property.name,
	propertyArea: property.area,
	landlordName: user.name
};

// ---------- receipts ----------

function receiptWhere(db: DB, where: SQL) {
	const row = db
		.select({ payment, ...placeColumns })
		.from(payment)
		.innerJoin(tenancy, eq(payment.tenancyId, tenancy.id))
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.innerJoin(user, eq(property.ownerId, user.id))
		.where(where)
		.get();
	if (!row) throw new RentalError('err.receiptNotFound');
	return { ...row, number: receiptNumber(row.payment.id) };
}

/** A payment receipt, only if the payment is for one of the landlord's properties. */
export function landlordReceipt(db: DB, ownerId: number, paymentId: number) {
	return receiptWhere(db, and(eq(payment.id, paymentId), eq(property.ownerId, ownerId))!);
}

// ---------- monthly statements ----------

export interface StatementLine {
	date: string;
	kind: 'charge' | 'payment';
	description: string;
	chargeSen: number;
	paymentSen: number;
	/** Running balance after this line (negative = in credit). */
	balanceSen: number;
	/** Payment lines link to their receipt. */
	paymentId?: number;
}

function stayWhere(db: DB, where: SQL) {
	const row = db
		.select({ tenancy, ...placeColumns })
		.from(tenancy)
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.innerJoin(user, eq(property.ownerId, user.id))
		.where(where)
		.get();
	if (!row) throw new RentalError('err.tenancyNotFound');
	return row;
}

/**
 * The statement of one tenancy for billing month `period` (`YYYY-MM`): the balance brought forward
 * (charges of earlier months minus payments before the 1st), the month's charges (by billing month)
 * and payments (by date paid), a running balance and the balance carried forward.
 * Does no access check: use landlordStatement / tenantStatement.
 */
export function monthlyStatement(db: DB, tenancyId: number, period: string) {
	const { start, endExclusive } = monthRange(period);
	const charges = db
		.select()
		.from(charge)
		.where(eq(charge.tenancyId, tenancyId))
		.orderBy(asc(charge.dueDate), asc(charge.id))
		.all();
	const payments = db
		.select()
		.from(payment)
		.where(eq(payment.tenancyId, tenancyId))
		.orderBy(asc(payment.paidOn), asc(payment.id))
		.all();
	const openingSen =
		charges.filter((c) => c.period < period).reduce((s, c) => s + c.amountSen, 0) -
		payments.filter((p) => p.paidOn < start).reduce((s, p) => s + p.amountSen, 0);

	const entries = [
		...charges
			.filter((c) => c.period === period)
			.map((c) => ({
				date: c.dueDate,
				order: 0,
				id: c.id,
				kind: 'charge' as const,
				description: c.description,
				chargeSen: c.amountSen,
				paymentSen: 0
			})),
		...payments
			.filter((p) => p.paidOn >= start && p.paidOn < endExclusive)
			.map((p) => ({
				date: p.paidOn,
				order: 1,
				id: p.id,
				kind: 'payment' as const,
				description:
					`Payment, ${methodLabel(p.method).toLowerCase()}` +
					(p.reference ? ` (${p.reference})` : ''),
				chargeSen: 0,
				paymentSen: p.amountSen
			}))
	].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.id - b.id);

	let balance = openingSen;
	const lines: StatementLine[] = entries.map((e) => {
		balance += e.chargeSen - e.paymentSen;
		return {
			date: e.date,
			kind: e.kind,
			description: e.description,
			chargeSen: e.chargeSen,
			paymentSen: e.paymentSen,
			balanceSen: balance,
			...(e.kind === 'payment' ? { paymentId: e.id } : {})
		};
	});
	return {
		period,
		openingSen,
		chargesSen: entries.reduce((s, e) => s + e.chargeSen, 0),
		paymentsSen: entries.reduce((s, e) => s + e.paymentSen, 0),
		closingSen: balance,
		lines
	};
}

export type MonthlyStatement = ReturnType<typeof monthlyStatement> & {
	stay: ReturnType<typeof stayWhere>;
};

export function landlordStatement(
	db: DB,
	ownerId: number,
	tenancyId: number,
	period: string
): MonthlyStatement {
	const stay = stayWhere(db, and(eq(tenancy.id, tenancyId), eq(property.ownerId, ownerId))!);
	return { stay, ...monthlyStatement(db, tenancyId, period) };
}

export function tenantStatement(
	db: DB,
	userId: number,
	tenancyId: number,
	period: string
): MonthlyStatement {
	const stay = stayWhere(db, and(eq(tenancy.id, tenancyId), eq(tenant.userId, userId))!);
	return { stay, ...monthlyStatement(db, tenancyId, period) };
}

// ---------- CSV exports for the landlord ----------

function ownerStays(db: DB, ownerId: number) {
	return db
		.select({ tenancy, ...placeColumns })
		.from(tenancy)
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.innerJoin(user, eq(property.ownerId, user.id))
		.where(eq(property.ownerId, ownerId))
		.orderBy(asc(property.name), asc(room.name), asc(bed.label), asc(tenancy.startDate))
		.all();
}

export const CHARGES_CSV_HEADER = [
	'charge_id',
	'billing_month',
	'due_date',
	'tenant',
	'property',
	'room',
	'bed',
	'kind',
	'description',
	'amount_rm',
	'unpaid_rm'
];

/** Rows joined up to the property, kept only for one landlord. */
const ownerScope = (ownerId: number) => eq(property.ownerId, ownerId);

/**
 * Every charge on the landlord's properties (optionally one billing month), with what is still unpaid.
 * Three queries in total (stays, charges, payments), however many tenancies there are. Unpaid amounts
 * are always worked out from the tenancy's whole history, so a month filter never changes them.
 */
export function chargesCsv(db: DB, ownerId: number, period?: string): string {
	const charges = new Map<number, (typeof charge.$inferSelect)[]>();
	const chargeRows = db
		.select({ charge })
		.from(charge)
		.innerJoin(tenancy, eq(charge.tenancyId, tenancy.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(ownerScope(ownerId))
		.all();
	for (const { charge: c } of chargeRows) {
		const list = charges.get(c.tenancyId);
		if (list) list.push(c);
		else charges.set(c.tenancyId, [c]);
	}
	const paid = new Map<number, number>();
	const paymentRows = db
		.select({ tenancyId: payment.tenancyId, amountSen: payment.amountSen })
		.from(payment)
		.innerJoin(tenancy, eq(payment.tenancyId, tenancy.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(ownerScope(ownerId))
		.all();
	for (const p of paymentRows) paid.set(p.tenancyId, (paid.get(p.tenancyId) ?? 0) + p.amountSen);

	const rows = [];
	for (const s of ownerStays(db, ownerId)) {
		const own = charges.get(s.tenancy.id) ?? [];
		const unpaid = new Map(
			allocatePayments(own, paid.get(s.tenancy.id) ?? 0).map((c) => [c.id, c.unpaidSen])
		);
		for (const c of own) {
			if (period && c.period !== period) continue;
			rows.push({ c, s, unpaidSen: unpaid.get(c.id) ?? 0 });
		}
	}
	rows.sort(
		(a, b) =>
			a.c.dueDate.localeCompare(b.c.dueDate) ||
			a.s.propertyName.localeCompare(b.s.propertyName) ||
			a.c.id - b.c.id
	);
	return toCsv(
		CHARGES_CSV_HEADER,
		rows.map(({ c, s, unpaidSen }) => [
			c.id,
			c.period,
			c.dueDate,
			s.tenantName,
			s.propertyName,
			s.roomName,
			s.bedLabel,
			c.kind,
			c.description,
			senToDecimal(c.amountSen),
			senToDecimal(unpaidSen)
		])
	);
}

export const PAYMENTS_CSV_HEADER = [
	'receipt_no',
	'paid_on',
	'tenant',
	'property',
	'room',
	'bed',
	'method',
	'reference',
	'amount_rm'
];

/** Every payment on the landlord's properties (optionally paid in one month). */
export function paymentsCsv(db: DB, ownerId: number, period?: string): string {
	const conditions: SQL[] = [eq(property.ownerId, ownerId)];
	if (period) {
		const { start, endExclusive } = monthRange(period);
		conditions.push(gte(payment.paidOn, start), lt(payment.paidOn, endExclusive));
	}
	const rows = db
		.select({ payment, ...placeColumns })
		.from(payment)
		.innerJoin(tenancy, eq(payment.tenancyId, tenancy.id))
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.innerJoin(user, eq(property.ownerId, user.id))
		.where(and(...conditions))
		.orderBy(asc(payment.paidOn), asc(payment.id))
		.all();
	return toCsv(
		PAYMENTS_CSV_HEADER,
		rows.map((r) => [
			receiptNumber(r.payment.id),
			r.payment.paidOn,
			r.tenantName,
			r.propertyName,
			r.roomName,
			r.bedLabel,
			methodLabel(r.payment.method),
			r.payment.reference,
			senToDecimal(r.payment.amountSen)
		])
	);
}

// ---------- overdue reminders ----------

/**
 * Who owes what on the landlord's properties: every tenancy with charges past their due date that
 * payments (applied oldest first) have not covered, most days overdue first, each with a ready-to-copy
 * reminder message in `locale`. Nothing is ever sent from here.
 */
export function overdueReminders(
	db: DB,
	ownerId: number,
	today: string,
	locale: Locale = DEFAULT_LOCALE
) {
	return ownerStays(db, ownerId)
		.map((s) => {
			const ledger = ledgerEntries(db, s.tenancy.id, today);
			const items = ledger.charges
				.filter((c) => c.dueDate < today && c.unpaidSen > 0)
				.map((c) => ({
					chargeId: c.id,
					description: c.description,
					dueDate: c.dueDate,
					unpaidSen: c.unpaidSen,
					daysOverdue: daysOverdue(c.dueDate, today)
				}));
			const bed = translate(locale, 'common.bed', { label: s.bedLabel });
			const where = `${s.propertyName}, ${s.roomName}, ${bed}`;
			return {
				tenancyId: s.tenancy.id,
				tenantName: s.tenantName,
				where,
				active: s.tenancy.endDate === null || s.tenancy.endDate > today,
				endDate: s.tenancy.endDate,
				overdueSen: ledger.overdueSen,
				balanceSen: ledger.balanceSen,
				oldestDueDate: items[0]?.dueDate ?? null,
				daysOverdue: items[0]?.daysOverdue ?? 0,
				items,
				message: reminderMessage({
					tenantName: s.tenantName,
					landlordName: s.landlordName,
					where,
					today,
					items,
					locale
				})
			};
		})
		.filter((r) => r.overdueSen > 0)
		.sort(
			(a, b) =>
				b.daysOverdue - a.daysOverdue || b.overdueSen - a.overdueSen || a.tenancyId - b.tenancyId
		);
}
