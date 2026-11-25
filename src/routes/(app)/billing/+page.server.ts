import { db } from '#lib/server/db/index.ts';
import { date, guard, id, money, month, text, values } from '#lib/server/forms.ts';
import {
	generateRent,
	listProperties,
	previewUtilitySplit,
	splitUtilityBill
} from '#lib/server/rentals.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	properties: listProperties(db, locals.user!.id, locals.today).map((p) => ({
		id: p.id,
		name: p.name
	}))
});

const tenancies = (n: number) => `${n} ${n === 1 ? 'tenancy' : 'tenancies'}`;

function billInput(data: FormData) {
	return {
		propertyId: id(text(data, 'propertyId')),
		label: text(data, 'label'),
		amountSen: money(data, 'amount', 'Bill amount'),
		fromDate: date(data, 'fromDate', 'From'),
		toDate: date(data, 'toDate', 'To'),
		dueDate: date(data, 'dueDate', 'Due date')
	};
}

export const actions: Actions = {
	rent: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const period = month(data, 'period');
			const r = generateRent(db, locals.user!.id, period);
			return {
				rent: {
					period,
					...r,
					message:
						r.created === 0
							? `Rent for ${period} was already billed (${tenancies(r.skipped)}).`
							: `Billed rent for ${period} to ${tenancies(r.created)}.`
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
