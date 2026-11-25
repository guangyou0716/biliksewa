import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { FormError, date, guard, id, money, text } from '#lib/server/forms.ts';
import { formatRM, parseRM } from '#lib/money.ts';
import {
	depositSettlementOf,
	REFUND_METHODS,
	settleDeposit,
	type Deduction,
	type RefundMethod
} from '#lib/server/deposit.ts';
import { createInvite, portalAccess, revokeAccess } from '#lib/server/portal.ts';
import { moveOut, recordPayment, RentalError, tenancyLedger } from '#lib/server/rentals.ts';
import type { Actions, PageServerLoad } from './$types';

const METHODS = ['cash', 'bank_transfer', 'other'] as const;

export const load: PageServerLoad = ({ locals, params }) => {
	try {
		const tenancyId = id(params.id);
		return {
			ledger: tenancyLedger(db, locals.user!.id, tenancyId, locals.today),
			portal: portalAccess(db, locals.user!.id, tenancyId),
			// Safe: tenancyLedger above already proved the tenancy belongs to this landlord.
			deposit: depositSettlementOf(db, tenancyId)
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
			const { rentAdjusted, utility } = moveOut(
				db,
				locals.user!.id,
				id(params.id),
				date(data, 'endDate', 'Move-out date')
			);
			const notes = utility.map(
				(u) =>
					`${u.label} ${u.fromDate} to ${u.toDate} re-split by nights stayed: share ${formatRM(u.beforeSen)} → ${formatRM(u.afterSen)}`
			);
			if (rentAdjusted) notes.unshift('Rent re-pro-rated');
			return { success: ['Move-out recorded', ...notes].join('. ') + '.' };
		});
	},
	settleDeposit: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			const labels = data.getAll('deductionLabel').map((v) => (typeof v === 'string' ? v : ''));
			const amounts = data.getAll('deductionAmount').map((v) => (typeof v === 'string' ? v : ''));
			const deductions: Deduction[] = [];
			for (let i = 0; i < Math.max(labels.length, amounts.length); i++) {
				const label = (labels[i] ?? '').trim();
				const amount = (amounts[i] ?? '').trim();
				if (!label && !amount) continue;
				const amountSen = parseRM(amount);
				if (!label || amountSen === null)
					throw new FormError('Each deduction needs a description and an amount like 50.00');
				deductions.push({ label, amountSen });
			}
			const method = text(data, 'refundMethod');
			const s = settleDeposit(
				db,
				locals.user!.id,
				id(params.id),
				{
					settledOn: date(data, 'settledOn', 'Settled on'),
					deductions,
					refundMethod: REFUND_METHODS.includes(method as RefundMethod)
						? (method as RefundMethod)
						: null,
					refundReference: text(data, 'refundReference')
				},
				locals.today
			);
			return {
				success: `Deposit settled: ${formatRM(s.appliedSen)} used for charges, ${formatRM(s.refundSen)} to refund`
			};
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
