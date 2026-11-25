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
import { translator, type Translator } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	meters: landlordMeters(db, locals.user!.id)
});

function kwh(data: FormData): number {
	const tenths = parseKwh(text(data, 'reading'));
	if (tenths === null) throw new FormError('err.kwhInput');
	return tenths;
}

function billed(
	t: Translator,
	r: { amountSen: number; usedTenths: number | null; shares: unknown[] }
) {
	if (r.usedTenths === null) return t('ok.billedOpening');
	const kwh = formatKwh(r.usedTenths);
	if (!r.shares.length) return t('ok.billedNobody', { kwh });
	const amount = formatRM(r.amountSen);
	return r.shares.length > 1
		? t('ok.billedShared', { kwh, amount, n: r.shares.length })
		: t('ok.billedOne', { kwh, amount });
}

export const actions: Actions = {
	rate: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const raw = text(data, 'rate').trim();
			const rate = raw ? parseRate(raw) : null;
			if (raw && rate === null) throw new FormError('err.rateInput');
			setMeterRate(db, locals.user!.id, id(text(data, 'propertyId')), rate);
			const t = translator(locals.locale);
			return {
				success: rate === null ? t('ok.metersOff') : t('ok.rateSet', { rate: formatRate(rate) })
			};
		});
	},
	confirm: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const r = confirmReading(db, locals.user!.id, id(text(data, 'readingId')), locals.today);
			const t = translator(locals.locale);
			return { success: t('ok.readingConfirmed', { billed: billed(t, r) }) };
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
			return { success: translator(locals.locale)('ok.readingRejected') };
		});
	},
	record: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const r = recordReading(
				db,
				locals.user!.id,
				id(text(data, 'roomId')),
				{ readOn: date(data, 'readOn', 'field.readOn'), readingTenths: kwh(data) },
				locals.today
			);
			const t = translator(locals.locale);
			return { success: t('ok.readingSaved', { billed: billed(t, r) }) };
		});
	}
};
