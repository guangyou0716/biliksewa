<script lang="ts">
	import { formatRM } from '#lib/money.ts';
	import { methodKey } from '#lib/i18n.ts';
	import { t } from '#lib/i18n.svelte.ts';

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
</script>

<section class="card overflow-x-auto" aria-labelledby="{uid}-charges">
	<h2 id="{uid}-charges" class="font-semibold">{t('ledger.charges')}</h2>
	<table class="mt-3 table">
		<thead>
			<tr>
				<th>{t('col.due')}</th><th>{t('col.description')}</th>
				<th class="text-right">{t('col.amount')}</th><th class="text-right">{t('col.unpaid')}</th>
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
							<span class="badge bg-brand-100 text-brand-700">{t('ledger.paid')}</span>
						{:else}
							<span class={c.dueDate < today ? 'font-medium text-amber-700' : ''}>
								{formatRM(c.unpaidSen)}
							</span>
						{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="4" class="text-slate-500">{t('ledger.noCharges')}</td></tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="card overflow-x-auto" aria-labelledby="{uid}-payments">
	<h2 id="{uid}-payments" class="font-semibold">{t('ledger.payments')}</h2>
	<table class="mt-3 table">
		<thead>
			<tr>
				<th>{t('col.paidOn')}</th><th>{t('col.method')}</th><th>{t('col.reference')}</th>
				<th class="text-right">{t('col.amount')}</th>
				{#if receiptHref}<th><span class="sr-only">{t('col.receipt')}</span></th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each payments as p (p.id)}
				<tr>
					<td class="text-slate-500">{p.paidOn}</td>
					<td>{t(methodKey(p.method))}</td>
					<td class="text-slate-500">{p.reference ?? '—'}</td>
					<td class="text-right tabular-nums">{formatRM(p.amountSen)}</td>
					{#if receiptHref}
						<td class="text-right">
							<a
								class="text-brand-700 hover:underline"
								href={receiptHref(p.id)}
								aria-label={t('receipt.linkLabel', {
									amount: formatRM(p.amountSen),
									date: p.paidOn
								})}
							>
								{t('receipt.link')}
							</a>
						</td>
					{/if}
				</tr>
			{:else}
				<tr>
					<td colspan={receiptHref ? 5 : 4} class="text-slate-500">{t('ledger.noPayments')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
