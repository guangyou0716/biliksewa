<script lang="ts">
	import { shiftMonth } from '#lib/dates.ts';
	import { formatRM } from '#lib/money.ts';
	import { t } from '#lib/i18n.svelte.ts';

	interface Line {
		date: string;
		description: string;
		chargeSen: number;
		paymentSen: number;
		balanceSen: number;
		paymentId?: number;
	}
	interface StatementView {
		period: string;
		openingSen: number;
		chargesSen: number;
		paymentsSen: number;
		closingSen: number;
		lines: Line[];
		stay: {
			tenancy: { monthlyRentSen: number };
			tenantName: string;
			propertyName: string;
			propertyArea: string;
			roomName: string;
			bedLabel: string;
			landlordName: string;
		};
	}

	let {
		statement: s,
		basePath,
		receiptHref
	}: {
		statement: StatementView;
		/** The statement page; month links and the download add to it. */
		basePath: string;
		receiptHref: (paymentId: number) => string;
	} = $props();
	const st = $derived(s.stay);
	const prev = $derived(shiftMonth(s.period, -1));
	const next = $derived(shiftMonth(s.period, 1));
</script>

<nav class="mt-3 flex flex-wrap items-end gap-3 print:hidden" aria-label={t('statement.monthNav')}>
	<a class="btn-secondary" href="{basePath}?month={prev}" rel="prev">← {prev}</a>
	<form method="GET" action={basePath} class="flex items-end gap-2">
		<label class="label">
			{t('statement.month')}
			<input class="field" type="month" name="month" value={s.period} required />
		</label>
		<button class="btn-secondary">{t('statement.show')}</button>
	</form>
	<a class="btn-secondary" href="{basePath}?month={next}" rel="next">{next} →</a>
	<div class="ml-auto flex gap-2">
		<a class="btn-secondary" href="{basePath}/download?month={s.period}" download>
			{t('statement.download')}
		</a>
		<button class="btn" onclick={() => window.print()}>{t('common.print')}</button>
	</div>
</nav>

<article
	class="card mt-4 overflow-x-auto print:mt-0 print:border-0 print:p-0 print:shadow-none"
	aria-labelledby="statement-h"
>
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 id="statement-h" class="text-xl font-semibold">
				{t('statement.title', { period: s.period })}
			</h1>
			<p class="text-sm text-slate-500">
				{st.tenantName} · {st.propertyName}, {st.propertyArea} · {st.roomName} · {t('common.bed', {
					label: st.bedLabel
				})}
			</p>
			<p class="text-sm text-slate-500">
				{t('statement.landlordLine', {
					landlord: st.landlordName,
					rent: formatRM(st.tenancy.monthlyRentSen)
				})}
			</p>
		</div>
		<div class="text-right">
			<p class="text-xs text-slate-500 uppercase">{t('statement.carried')}</p>
			<p
				class="text-2xl font-semibold tabular-nums {s.closingSen > 0
					? 'text-amber-700'
					: 'text-brand-700'}"
			>
				{formatRM(s.closingSen)}
			</p>
		</div>
	</div>

	<table class="mt-4 table">
		<thead>
			<tr>
				<th>{t('col.date')}</th><th>{t('col.description')}</th>
				<th class="text-right">{t('col.charge')}</th>
				<th class="text-right">{t('col.payment')}</th><th class="text-right">{t('col.balance')}</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td></td>
				<td class="text-slate-500">{t('statement.brought')}</td>
				<td></td>
				<td></td>
				<td class="text-right tabular-nums">{formatRM(s.openingSen)}</td>
			</tr>
			{#each s.lines as l, i (i)}
				<tr>
					<td class="whitespace-nowrap text-slate-500">{l.date}</td>
					<td>
						{l.description}
						{#if l.paymentId}
							<a
								class="ml-1 text-brand-700 underline print:hidden"
								href={receiptHref(l.paymentId)}
								aria-label={t('receipt.linkLabel', {
									amount: formatRM(l.paymentSen),
									date: l.date
								})}
							>
								{t('receipt.link')}
							</a>
						{/if}
					</td>
					<td class="text-right tabular-nums">{l.chargeSen ? formatRM(l.chargeSen) : ''}</td>
					<td class="text-right tabular-nums">{l.paymentSen ? formatRM(l.paymentSen) : ''}</td>
					<td class="text-right tabular-nums">{formatRM(l.balanceSen)}</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="text-slate-500">{t('statement.empty')}</td></tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="font-semibold">
				<td></td>
				<td>{t('statement.carried')}</td>
				<td class="text-right tabular-nums">{formatRM(s.chargesSen)}</td>
				<td class="text-right tabular-nums">{formatRM(s.paymentsSen)}</td>
				<td class="text-right tabular-nums">{formatRM(s.closingSen)}</td>
			</tr>
		</tfoot>
	</table>
	<p class="mt-4 text-xs text-slate-500">
		{t('statement.note')}
	</p>
</article>
