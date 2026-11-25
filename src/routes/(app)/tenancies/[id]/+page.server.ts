import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { FormError, date, guard, id, money, text } from '#lib/server/forms.ts';
import { moveOut, recordPayment, RentalError, tenancyLedger } from '#lib/server/rentals.ts';
import type { Actions, PageServerLoad } from './$types';

const METHODS = ['cash', 'bank_transfer', 'other'] as const;

export const load: PageServerLoad = ({ locals, params }) => {
	try {
		return { ledger: tenancyLedger(db, locals.user!.id, id(params.id), locals.today) };
	} catch (e) {
		if (e instanceof RentalError) error(404, 'Tenancy not found');
		throw e;
	}
};

export const actions: Actions = {
	pay: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			const method = text(data, 'method') as (typeof METHODS)[number];
			if (!METHODS.includes(method)) throw new FormError('Choose a payment method');
			const p = recordPayment(db, locals.user!.id, id(params.id), {
				amountSen: money(data, 'amount', 'Amount'),
				paidOn: date(data, 'paidOn', 'Paid on'),
				method,
				reference: text(data, 'reference')
			});
			return { success: `Payment of RM ${(p.amountSen / 100).toFixed(2)} recorded` };
		});
	},
	moveOut: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			moveOut(db, locals.user!.id, id(params.id), date(data, 'endDate', 'Move-out date'));
			return { success: 'Move-out recorded' };
		});
	}
};
