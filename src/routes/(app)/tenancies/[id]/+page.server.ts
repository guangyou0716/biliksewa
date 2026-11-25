import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { FormError, date, guard, id, money, text } from '#lib/server/forms.ts';
import { createInvite, portalAccess, revokeAccess } from '#lib/server/portal.ts';
import { moveOut, recordPayment, RentalError, tenancyLedger } from '#lib/server/rentals.ts';
import type { Actions, PageServerLoad } from './$types';

const METHODS = ['cash', 'bank_transfer', 'other'] as const;

export const load: PageServerLoad = ({ locals, params }) => {
	try {
		const tenancyId = id(params.id);
		return {
			ledger: tenancyLedger(db, locals.user!.id, tenancyId, locals.today),
			portal: portalAccess(db, locals.user!.id, tenancyId)
		};
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
	},
	invite: async ({ request, locals, params, url }) => {
		const data = await request.formData();
		return guard(data, () => {
			const { token } = createInvite(db, locals.user!.id, id(params.id));
			// Shown once: only a hash of the token is stored.
			return { success: 'Invite link created', inviteUrl: `${url.origin}/invite/${token}` };
		});
	},
	revokePortal: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			revokeAccess(db, locals.user!.id, id(params.id));
			return { success: 'Portal access removed' };
		});
	}
};
