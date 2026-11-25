import { db } from '#lib/server/db/index.ts';
import { date, guard, id, money, month, text, values } from '#lib/server/forms.ts';
import {
	generateRent,
	listProperties,
	previewUtilitySplit,
	splitUtilityBill
} from '#lib/server/rentals.ts';
import { translator, type Translator } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	properties: listProperties(db, locals.user!.id, locals.today).map((p) => ({
		id: p.id,
		name: p.name
	}))
});

const tenancies = (t: Translator, n: number) =>
	t(n === 1 ? 'count.tenancy' : 'count.tenancies', { n });

function billInput(data: FormData) {
	return {
		propertyId: id(text(data, 'propertyId')),
		label: text(data, 'label'),
		amountSen: money(data, 'amount', 'field.billAmount'),
		fromDate: date(data, 'fromDate', 'field.from'),
		toDate: date(data, 'toDate', 'field.to'),
		dueDate: date(data, 'dueDate', 'field.dueDate')
	};
}

export const actions: Actions = {
	rent: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const period = month(data, 'period');
			const r = generateRent(db, locals.user!.id, period);
			const t = translator(locals.locale);
			return {
				rent: {
					period,
					...r,
					message:
						r.created === 0
							? t('ok.rentAlready', { period, count: tenancies(t, r.skipped) })
							: t('ok.rentBilled', { period, count: tenancies(t, r.created) })
				}
			};
		});
	},
	preview: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const input = billInput(data);
			return {
				preview: { input, shares: previewUtilitySplit(db, locals.user!.id, input) },
				values: values(data)
			};
		});
	},
	split: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const { bill, shares } = splitUtilityBill(db, locals.user!.id, billInput(data));
			return { split: { label: bill.label, count: shares.length, amountSen: bill.amountSen } };
		});
	}
};
