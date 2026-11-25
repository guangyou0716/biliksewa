/**
 * Deposit settlement at move-out: deductions (cleaning, repairs...) become charges, the deposit
 * pays the tenant's unpaid charges, and whatever is left is refunded.
 */
import { asc, eq } from 'drizzle-orm';
import { settlementAmounts } from '../billing';
import type { DB } from './db/client';
import { charge, depositSettlement, payment } from './db/schema';
import { ledgerEntries, ownedTenancy, RentalError } from './rentals';

export const MAX_DEDUCTIONS = 5;
const MAX_LABEL = 80;
export const REFUND_METHODS = ['cash', 'bank_transfer', 'other'] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

export interface Deduction {
	label: string;
	amountSen: number;
}

export function settleDeposit(
	db: DB,
	ownerId: number,
	tenancyId: number,
	input: {
		settledOn: string;
		deductions: Deduction[];
		refundMethod: RefundMethod | null;
		refundReference?: string | null;
	},
	today: string
) {
	const { tenancy: t } = ownedTenancy(db, ownerId, tenancyId);
	if (!t.endDate) throw new RentalError('Record the move-out before settling the deposit');
	if (!(t.depositSen > 0)) throw new RentalError('No deposit is held for this tenancy');
	if (input.settledOn < t.endDate)
		throw new RentalError('The settlement date cannot be before the move-out date');
	if (input.settledOn > today) throw new RentalError('The settlement date cannot be in the future');
	if (input.deductions.length > MAX_DEDUCTIONS)
		throw new RentalError(`At most ${MAX_DEDUCTIONS} deductions`);
	const deductions = input.deductions.map((d) => ({
		label: d.label.trim(),
		amountSen: d.amountSen
	}));
	for (const d of deductions) {
		if (!d.label) throw new RentalError('Each deduction needs a description');
		if (d.label.length > MAX_LABEL)
			throw new RentalError(`Keep each deduction description under ${MAX_LABEL} characters`);
		if (!Number.isSafeInteger(d.amountSen) || d.amountSen <= 0)
			throw new RentalError('Each deduction must be more than RM 0');
	}
	const deductionsSen = deductions.reduce((s, d) => s + d.amountSen, 0);
	if (deductionsSen > t.depositSen)
		throw new RentalError('Deductions cannot be more than the deposit held');
	if (input.refundMethod !== null && !REFUND_METHODS.includes(input.refundMethod))
		throw new RentalError('Choose how the refund is paid');

	// better-sqlite3 is synchronous: the balance read and the writes cannot interleave with others.
	return db.transaction((tx) => {
		if (tx.select().from(depositSettlement).where(eq(depositSettlement.tenancyId, tenancyId)).get())
			throw new RentalError('The deposit was already settled');
		const { balanceSen } = ledgerEntries(tx, tenancyId, today);
		const amounts = settlementAmounts(t.depositSen, deductionsSen, balanceSen);
		if (amounts.refundSen > 0 && input.refundMethod === null)
			throw new RentalError('Choose how the refund is paid');

		const paid = amounts.appliedSen
			? tx
					.insert(payment)
					.values({
						tenancyId,
						amountSen: amounts.appliedSen,
						paidOn: input.settledOn,
						method: 'deposit',
						reference: 'Deposit'
					})
					.returning()
					.get()
			: null;
		const settlement = tx
			.insert(depositSettlement)
			.values({
				tenancyId,
				settledOn: input.settledOn,
				depositSen: t.depositSen,
				deductionsSen,
				appliedSen: amounts.appliedSen,
				refundSen: amounts.refundSen,
				refundMethod: amounts.refundSen > 0 ? input.refundMethod : null,
				refundReference: amounts.refundSen > 0 ? input.refundReference?.trim() || null : null,
				paymentId: paid?.id ?? null
			})
			.returning()
			.get();
		for (const d of deductions) {
			tx.insert(charge)
				.values({
					tenancyId,
					kind: 'other',
					period: input.settledOn.slice(0, 7),
					description: `Deposit deduction: ${d.label}`,
					amountSen: d.amountSen,
					dueDate: input.settledOn,
					depositSettlementId: settlement.id
				})
				.run();
		}
		return { ...settlement, balanceAfterSen: amounts.balanceAfterSen };
	});
}

/**
 * The settlement of a tenancy with its deductions, or null.
 * Does no access check: callers must first prove the tenancy belongs to the signed-in user.
 */
export function depositSettlementOf(db: DB, tenancyId: number) {
	const s = db
		.select()
		.from(depositSettlement)
		.where(eq(depositSettlement.tenancyId, tenancyId))
		.get();
	if (!s) return null;
	const deductions = db
		.select({ id: charge.id, description: charge.description, amountSen: charge.amountSen })
		.from(charge)
		.where(eq(charge.depositSettlementId, s.id))
		.orderBy(asc(charge.id))
		.all()
		.map((c) => ({
			id: c.id,
			label: c.description.replace(/^Deposit deduction: /, ''),
			amountSen: c.amountSen
		}));
	return { ...s, deductions };
}
