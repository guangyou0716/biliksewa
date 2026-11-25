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
import { translate, translator } from '#lib/i18n.ts';
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
		if (e instanceof RentalError) error(404, translate(locals.locale, 'err.tenancyNotFound'));
		throw e;
	}
};

export const actions: Actions = {
	pay: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			const method = text(data, 'method') as (typeof METHODS)[number];
			if (!METHODS.includes(method)) throw new FormError('err.paymentMethod');
			const p = recordPayment(db, locals.user!.id, id(params.id), {
				amountSen: money(data, 'amount', 'field.amount'),
				paidOn: date(data, 'paidOn', 'field.paidOn'),
				method,
				reference: text(data, 'reference')
			});
			return {
				success: translate(locals.locale, 'ok.paymentRecorded', { amount: formatRM(p.amountSen) })
			};
		});
	},
	moveOut: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			const { rentAdjusted, utility } = moveOut(
				db,
				locals.user!.id,
				id(params.id),
				date(data, 'endDate', 'field.moveOutDate')
			);
			const t = translator(locals.locale);
			const notes = utility.map((u) =>
				t('ok.utilityResplit', {
					label: u.label,
					from: u.fromDate,
					to: u.toDate,
					before: formatRM(u.beforeSen),
					after: formatRM(u.afterSen)
				})
			);
			if (rentAdjusted) notes.unshift(t('ok.rentReprorated'));
			// Chinese sentences end in 。 and are not separated by spaces.
			return { success: [t('ok.moveOut'), ...notes].join(locals.locale === 'zh' ? '' : ' ') };
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
				if (!label || amountSen === null) throw new FormError('err.deductionInput');
				deductions.push({ label, amountSen });
			}
			const method = text(data, 'refundMethod');
			const s = settleDeposit(
				db,
				locals.user!.id,
				id(params.id),
				{
					settledOn: date(data, 'settledOn', 'field.settledOn'),
					deductions,
					refundMethod: REFUND_METHODS.includes(method as RefundMethod)
						? (method as RefundMethod)
						: null,
					refundReference: text(data, 'refundReference')
				},
				locals.today
			);
			return {
				success: translate(locals.locale, 'ok.depositSettled', {
					applied: formatRM(s.appliedSen),
					refund: formatRM(s.refundSen)
				})
			};
		});
	},
	invite: async ({ request, locals, params, url }) => {
		const data = await request.formData();
		return guard(data, () => {
			const { token } = createInvite(db, locals.user!.id, id(params.id));
			// Shown once: only a hash of the token is stored.
			return {
				success: translate(locals.locale, 'ok.inviteCreated'),
				inviteUrl: `${url.origin}/invite/${token}`
			};
		});
	},
	revokePortal: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			revokeAccess(db, locals.user!.id, id(params.id));
			return { success: translate(locals.locale, 'ok.portalRemoved') };
		});
	}
};
