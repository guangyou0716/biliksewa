/** ISO calendar dates (`YYYY-MM-DD`) handled as UTC days so time zones never shift a day. */

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isIsoDate(value: string): boolean {
	if (!ISO_DATE.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isIsoMonth(value: string): boolean {
	return ISO_MONTH.test(value);
}

export function toDayNumber(date: string): number {
	return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

export function fromDayNumber(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
	return fromDayNumber(toDayNumber(date) + days);
}

/** First day of the month and first day of the next month (exclusive end). */
export function monthRange(period: string): { start: string; endExclusive: string } {
	const [y, m] = period.split('-').map(Number);
	const start = `${period}-01`;
	const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
	return { start, endExclusive: `${next}-01` };
}

export function daysInMonth(period: string): number {
	const { start, endExclusive } = monthRange(period);
	return toDayNumber(endExclusive) - toDayNumber(start);
}

/**
 * Number of nights a stay `[stayStart, stayEnd)` overlaps the window `[from, toExclusive)`.
 * `stayEnd` null means the tenant has not moved out.
 */
export function overlapNights(
	stayStart: string,
	stayEnd: string | null,
	from: string,
	toExclusive: string
): number {
	const start = Math.max(toDayNumber(stayStart), toDayNumber(from));
	const end = Math.min(
		stayEnd === null ? Number.POSITIVE_INFINITY : toDayNumber(stayEnd),
		toDayNumber(toExclusive)
	);
	return Math.max(0, end - start);
}

/** Two half-open stays overlap if each starts before the other ends. */
export function staysOverlap(
	aStart: string,
	aEnd: string | null,
	bStart: string,
	bEnd: string | null
): boolean {
	const aE = aEnd === null ? Number.POSITIVE_INFINITY : toDayNumber(aEnd);
	const bE = bEnd === null ? Number.POSITIVE_INFINITY : toDayNumber(bEnd);
	return toDayNumber(aStart) < bE && toDayNumber(bStart) < aE;
}

export function monthOf(date: string): string {
	return date.slice(0, 7);
}
