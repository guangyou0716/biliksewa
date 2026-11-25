import { daysInMonth, monthRange, overlapNights } from './dates';

/**
 * Rent for one month, pro-rated by nights stayed in that month.
 * A full month always bills exactly `monthlySen`; partial months round half up to the sen.
 */
export function proratedRent(
	monthlySen: number,
	period: string,
	stayStart: string,
	stayEnd: string | null
): number {
	const { start, endExclusive } = monthRange(period);
	const nights = overlapNights(stayStart, stayEnd, start, endExclusive);
	const days = daysInMonth(period);
	if (nights >= days) return monthlySen;
	return Math.floor((monthlySen * nights * 2 + days) / (2 * days));
}

export interface Stay {
	id: number;
	nights: number;
}

export interface Share {
	id: number;
	nights: number;
	amountSen: number;
}

/**
 * Splits `totalSen` across stays in proportion to nights, using the largest remainder method so the
 * shares always add up to exactly `totalSen`. Ties on the remainder go to more nights, then lower id,
 * so the result is deterministic. Stays with zero nights get nothing and are omitted.
 */
export function splitByNights(totalSen: number, stays: Stay[]): Share[] {
	if (!Number.isInteger(totalSen) || totalSen < 0) throw new Error('Amount must be whole sen');
	const present = stays.filter((s) => s.nights > 0);
	const totalNights = present.reduce((sum, s) => sum + s.nights, 0);
	if (totalNights === 0) throw new Error('Nobody stayed during this period');

	const rows = present.map((s) => {
		const exact = totalSen * s.nights;
		return {
			id: s.id,
			nights: s.nights,
			amountSen: Math.floor(exact / totalNights),
			remainder: exact % totalNights
		};
	});
	let left = totalSen - rows.reduce((sum, r) => sum + r.amountSen, 0);
	const order = [...rows].sort(
		(a, b) => b.remainder - a.remainder || b.nights - a.nights || a.id - b.id
	);
	for (const row of order) {
		if (left === 0) break;
		row.amountSen += 1;
		left -= 1;
	}
	return rows.map(({ id, nights, amountSen }) => ({ id, nights, amountSen }));
}

export interface LedgerCharge {
	id: number;
	amountSen: number;
	dueDate: string;
}

/**
 * Applies payments to charges oldest-due first and returns what is still unpaid per charge.
 * Used to decide which tenancies are overdue and by how much.
 */
export function allocatePayments(
	charges: LedgerCharge[],
	paidSen: number
): { id: number; unpaidSen: number; dueDate: string }[] {
	let pool = paidSen;
	return [...charges]
		.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id)
		.map((c) => {
			const applied = Math.min(Math.max(pool, 0), c.amountSen);
			pool -= applied;
			return { id: c.id, unpaidSen: c.amountSen - applied, dueDate: c.dueDate };
		});
}

/** Sum of unpaid amounts whose due date is before `today`. */
export function overdueSen(charges: LedgerCharge[], paidSen: number, today: string): number {
	return allocatePayments(charges, paidSen)
		.filter((c) => c.dueDate < today)
		.reduce((sum, c) => sum + c.unpaidSen, 0);
}

/**
 * The arithmetic of a settlement, shared by the server and the live preview on the page.
 * `balanceSen` is what the tenant owes before the deductions (negative = in credit).
 */
export function settlementAmounts(depositSen: number, deductionsSen: number, balanceSen: number) {
	const owedSen = Math.max(0, balanceSen + deductionsSen);
	const appliedSen = Math.min(depositSen, owedSen);
	return {
		appliedSen,
		refundSen: depositSen - appliedSen,
		/** Still owed after the whole deposit was used (positive), or credit left over (negative). */
		balanceAfterSen: balanceSen + deductionsSen - appliedSen
	};
}
