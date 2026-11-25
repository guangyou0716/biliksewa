<script lang="ts">
	import { formatRM } from '#lib/money.ts';

	interface Settlement {
		settledOn: string;
		depositSen: number;
		deductionsSen: number;
		appliedSen: number;
		refundSen: number;
		refundMethod: string | null;
		refundReference: string | null;
		deductions: { id: number; label: string; amountSen: number }[];
	}

	let { settlement: s }: { settlement: Settlement } = $props();
	const uid = $props.id();
	const methodLabel: Record<string, string> = {
		cash: 'cash',
		bank_transfer: 'bank transfer',
		other: 'other'
	};
	/** Deposit used for unpaid rent and bills, beyond the deductions themselves. */
	const otherChargesSen = $derived(Math.max(0, s.appliedSen - s.deductionsSen));
</script>

<section class="card" aria-labelledby="{uid}-deposit">
	<h2 id="{uid}-deposit" class="font-semibold">Deposit settled on {s.settledOn}</h2>
	<dl class="mt-3 space-y-1 text-sm">
		<div class="flex justify-between gap-4">
			<dt class="text-slate-500">Deposit held</dt>
			<dd class="tabular-nums">{formatRM(s.depositSen)}</dd>
		</div>
		{#each s.deductions as d (d.id)}
			<div class="flex justify-between gap-4">
				<dt class="text-slate-500">Deduction: {d.label}</dt>
				<dd class="tabular-nums">-{formatRM(d.amountSen)}</dd>
			</div>
		{/each}
		{#if otherChargesSen > 0}
			<div class="flex justify-between gap-4">
				<dt class="text-slate-500">Unpaid rent and bills</dt>
				<dd class="tabular-nums">-{formatRM(otherChargesSen)}</dd>
			</div>
		{/if}
		<div class="flex justify-between gap-4 border-t border-slate-200 pt-1 font-semibold">
			<dt>Refund</dt>
			<dd class="tabular-nums" data-testid="refund">{formatRM(s.refundSen)}</dd>
		</div>
	</dl>
	{#if s.refundSen > 0 && s.refundMethod}
		<p class="mt-2 text-xs text-slate-500">
			Refunded by {methodLabel[s.refundMethod]}{s.refundReference
				? ` (ref ${s.refundReference})`
				: ''}.
		</p>
	{/if}
</section>
