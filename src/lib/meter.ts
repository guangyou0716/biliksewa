/**
 * Room sub-meter maths. Readings are kept as integer tenths of a kWh and the electricity rate as
 * sen per kWh x 100 (RM 0.55/kWh = 5500), so a charge is computed exactly in integers.
 */

/** A room meter rarely uses more than this per day (an air-conditioner running all day is ~20 kWh). */
export const MAX_KWH_PER_DAY = 60;
/** Highest rate accepted, RM 5.0000 per kWh (TNB domestic tariffs are well under RM 1). */
export const MAX_RATE = 50_000;

/** Parses a meter reading such as "1234" or "1234.5" (kWh) into tenths. Returns null when invalid. */
export function parseKwh(input: string): number | null {
	const cleaned = input.trim().replace(/,/g, '');
	if (!/^\d{1,7}(\.\d)?$/.test(cleaned)) return null;
	const [whole, frac = '0'] = cleaned.split('.');
	return Number(whole) * 10 + Number(frac);
}

export function formatKwh(tenths: number): string {
	return `${(tenths / 10).toFixed(1)} kWh`;
}

/** Parses a rate in RM per kWh such as "0.55" or "RM 0.2180" into sen x 100. Null when invalid or 0. */
export function parseRate(input: string): number | null {
	const cleaned = input
		.trim()
		.replace(/^RM\s*/i, '')
		.replace(/\s*\/\s*kWh$/i, '');
	if (!/^\d{1,2}(\.\d{1,4})?$/.test(cleaned)) return null;
	const [whole, frac = ''] = cleaned.split('.');
	const rate = Number(whole) * 10_000 + Number(frac.padEnd(4, '0'));
	return rate > 0 && rate <= MAX_RATE ? rate : null;
}

/** "RM 0.55/kWh" (shows 2 to 4 decimals). */
export function formatRate(rate: number): string {
	return `RM ${rateInput(rate)}/kWh`;
}

/** The rate as typed in a form ("0.55", "0.218"), with 2 to 4 decimals. */
export function rateInput(rate: number): string {
	return (rate / 10_000).toFixed(4).replace(/0{1,2}$/, '');
}

/**
 * Charge in sen for `usedTenths` (tenths of a kWh) at `rate` (sen per kWh x 100), rounded half up
 * to the nearest sen. amount = used/10 kWh x rate/100 sen = used x rate / 1000 sen.
 */
export function meterChargeSen(usedTenths: number, rate: number): number {
	if (!Number.isSafeInteger(usedTenths) || usedTenths < 0) throw new Error('Usage must be whole');
	if (!Number.isSafeInteger(rate) || rate < 0) throw new Error('Rate must be whole');
	const milliSen = usedTenths * rate;
	if (!Number.isSafeInteger(milliSen)) throw new Error('Usage is too large');
	return Math.floor((milliSen * 2 + 1000) / 2000);
}
