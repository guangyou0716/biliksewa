<script lang="ts">
	import { formatRM } from '#lib/money.ts';

	interface Charge {
		id: number;
		dueDate: string;
		description: string;
		amountSen: number;
		unpaidSen: number;
	}
	interface Payment {
		id: number;
		paidOn: string;
		method: string;
		reference: string | null;
		amountSen: number;
	}

	let {
		charges,
		payments,
		today,
		receiptHref
	}: {
		charges: Charge[];
		payments: Payment[];
		today: string;
		/** When set, each payment links to its receipt. */
		receiptHref?: (paymentId: number) => string;
	} = $props();

	const uid = $props.id();
	const methodLabel: Record<string, string> = {
		cash: 'Cash',
		bank_transfer: 'Bank transfer',
		other: 'Other'
	};
</script>

<section class="card overflow-x-auto" aria-labelledby="{uid}-charges">
	<h2 id="{uid}-charges" class="font-semibold">Charges</h2>
	<table class="mt-3 table">
		<thead>
			<tr>
				<th>Due</th><th>Description</th><th class="text-right">Amount</th><th class="text-right">
					Unpaid
				</th>
			</tr>
		</thead>
		<tbody>
			{#each charges as c (c.id)}
				<tr>
					<td class="whitespace-nowrap text-slate-500">{c.dueDate}</td>
					<td>{c.description}</td>
					<td class="text-right tabular-nums">{formatRM(c.amountSen)}</td>
					<td class="text-right tabular-nums">
						{#if c.unpaidSen === 0}
							<span class="badge bg-brand-100 text-brand-700">Paid</span>
						{:else}
							<span class={c.dueDate < today ? 'font-medium text-amber-700' : ''}>
								{formatRM(c.unpaidSen)}
							</span>
						{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="4" class="text-slate-500">No charges yet.</td></tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="card overflow-x-auto" aria-labelledby="{uid}-payments">
	<h2 id="{uid}-payments" class="font-semibold">Payments</h2>
	<table class="mt-3 table">
		<thead>
			<tr>
				<th>Paid on</th><th>Method</th><th>Reference</th><th class="text-right">Amount</th>
				{#if receiptHref}<th><span class="sr-only">Receipt</span></th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each payments as p (p.id)}
				<tr>
					<td class="text-slate-500">{p.paidOn}</td>
					<td>{methodLabel[p.method]}</td>
					<td class="text-slate-500">{p.reference ?? '—'}</td>
					<td class="text-right tabular-nums">{formatRM(p.amountSen)}</td>
					{#if receiptHref}
						<td class="text-right">
							<a
								class="text-brand-700 hover:underline"
								href={receiptHref(p.id)}
								aria-label="Receipt for {formatRM(p.amountSen)} paid on {p.paidOn}"
							>
								Receipt
							</a>
						</td>
					{/if}
				</tr>
			{:else}
				<tr>
					<td colspan={receiptHref ? 5 : 4} class="text-slate-500">No payments yet.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
