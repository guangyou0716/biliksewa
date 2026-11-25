<script lang="ts">
	import { formatRM } from '#lib/money.ts';
	import { methodKey } from '#lib/i18n.ts';
	import { t } from '#lib/i18n.svelte.ts';

	interface Receipt {
		number: string;
		payment: { amountSen: number; paidOn: string; method: string; reference: string | null };
		tenantName: string;
		propertyName: string;
		propertyArea: string;
		roomName: string;
		bedLabel: string;
		landlordName: string;
	}

	let { receipt: r }: { receipt: Receipt } = $props();
</script>

<article
	class="card mx-auto mt-3 max-w-lg print:mt-0 print:border-0 print:shadow-none"
	aria-labelledby="receipt-h"
>
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 id="receipt-h" class="text-xl font-semibold">{t('receipt.title')}</h1>
			<p class="text-sm text-slate-500">{r.number}</p>
		</div>
		<p class="text-right text-2xl font-semibold text-brand-700 tabular-nums">
			{formatRM(r.payment.amountSen)}
		</p>
	</div>
	<dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
		<dt class="text-slate-500">{t('receipt.from')}</dt>
		<dd>{r.tenantName}</dd>
		<dt class="text-slate-500">{t('receipt.for')}</dt>
		<dd>
			{r.propertyName}, {r.propertyArea} · {r.roomName} · {t('common.bed', { label: r.bedLabel })}
		</dd>
		<dt class="text-slate-500">{t('col.paidOn')}</dt>
		<dd>{r.payment.paidOn}</dd>
		<dt class="text-slate-500">{t('col.method')}</dt>
		<dd>{t(methodKey(r.payment.method))}</dd>
		<dt class="text-slate-500">{t('col.reference')}</dt>
		<dd>{r.payment.reference ?? '—'}</dd>
		<dt class="text-slate-500">{t('common.landlord')}</dt>
		<dd>{r.landlordName}</dd>
	</dl>
	<p class="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
		{t('receipt.note')}
	</p>
	<button class="btn-secondary mt-4 print:hidden" onclick={() => window.print()}>
		{t('common.print')}
	</button>
</article>
