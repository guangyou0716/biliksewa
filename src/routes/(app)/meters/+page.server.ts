import { db } from '#lib/server/db/index.ts';
import { FormError, date, guard, id, text } from '#lib/server/forms.ts';
import { formatKwh, formatRate, parseKwh, parseRate } from '#lib/meter.ts';
import { formatRM } from '#lib/money.ts';
import {
	confirmReading,
	landlordMeters,
	recordReading,
	rejectReading,
	setMeterRate
} from '#lib/server/meter.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	meters: landlordMeters(db, locals.user!.id)
});

function kwh(data: FormData): number {
	const tenths = parseKwh(text(data, 'reading'));
	if (tenths === null) throw new FormError('Reading: enter the kWh on the meter, like 1234.5');
	return tenths;
}

function billed(r: { amountSen: number; usedTenths: number | null; shares: unknown[] }) {
	if (r.usedTenths === null) return 'Opening reading saved; billing starts from the next reading.';
	if (!r.shares.length)
		return `${formatKwh(r.usedTenths)} used; nobody stayed in the room, so nothing was billed.`;
	return `${formatKwh(r.usedTenths)} used: ${formatRM(r.amountSen)} billed${r.shares.length > 1 ? ` across ${r.shares.length} tenants by nights stayed` : ''}.`;
}

export const actions: Actions = {
	rate: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const raw = text(data, 'rate').trim();
			const rate = raw ? parseRate(raw) : null;
			if (raw && rate === null) throw new FormError('Rate: enter RM per kWh, like 0.55');
			setMeterRate(db, locals.user!.id, id(text(data, 'propertyId')), rate);
			return {
				success: rate === null ? 'Meter readings turned off' : `Rate set to ${formatRate(rate)}`
			};
		});
	},
	confirm: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const r = confirmReading(db, locals.user!.id, id(text(data, 'readingId')), locals.today);
			return { success: `Reading confirmed. ${billed(r)}` };
		});
	},
	reject: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			rejectReading(
				db,
				locals.user!.id,
				id(text(data, 'readingId')),
				text(data, 'reason'),
				locals.today
			);
			return { success: 'Reading rejected. The tenant sees your reason and can send it again.' };
		});
	},
	record: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const r = recordReading(
				db,
				locals.user!.id,
				id(text(data, 'roomId')),
				{ readOn: date(data, 'readOn', 'Read on'), readingTenths: kwh(data) },
				locals.today
			);
			return { success: `Reading saved. ${billed(r)}` };
		});
	}
};
