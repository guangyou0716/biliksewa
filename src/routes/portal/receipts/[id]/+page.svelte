<script lang="ts">
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const r = $derived(data.receipt);
	const methodLabel: Record<string, string> = {
		cash: 'Cash',
		bank_transfer: 'Bank transfer',
		other: 'Other'
	};
</script>

<svelte:head><title>Receipt {r.number} · biliksewa</title></svelte:head>

<a href="/portal" class="text-sm text-brand-700 hover:underline print:hidden">← My rent</a>

<article
	class="card mx-auto mt-3 max-w-lg print:border-0 print:shadow-none"
	aria-labelledby="receipt-h"
>
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 id="receipt-h" class="text-xl font-semibold">Payment receipt</h1>
			<p class="text-sm text-slate-500">{r.number}</p>
		</div>
		<p class="text-right text-2xl font-semibold text-brand-700 tabular-nums">
			{formatRM(r.payment.amountSen)}
		</p>
	</div>
	<dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
		<dt class="text-slate-500">Received from</dt>
		<dd>{r.tenantName}</dd>
		<dt class="text-slate-500">For</dt>
		<dd>{r.propertyName}, {r.propertyArea} · {r.roomName} · Bed {r.bedLabel}</dd>
		<dt class="text-slate-500">Paid on</dt>
		<dd>{r.payment.paidOn}</dd>
		<dt class="text-slate-500">Method</dt>
		<dd>{methodLabel[r.payment.method]}</dd>
		<dt class="text-slate-500">Reference</dt>
		<dd>{r.payment.reference ?? '—'}</dd>
		<dt class="text-slate-500">Landlord</dt>
		<dd>{r.landlordName}</dd>
	</dl>
	<p class="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
		Recorded by your landlord in biliksewa. This is an acknowledgement of payment, not a tax
		invoice.
	</p>
	<button class="btn-secondary mt-4 print:hidden" onclick={() => window.print()}>Print</button>
</article>
