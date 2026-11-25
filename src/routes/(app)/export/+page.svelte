<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let month = $derived(data.month);
	let allMonths = $state(false);
	const query = $derived(allMonths ? '' : `?month=${month}`);
</script>

<svelte:head><title>Export · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">Export to a spreadsheet</h1>
<p class="text-sm text-slate-500">
	CSV files for Excel, Google Sheets or your accountant. Amounts are in RM with two decimals. Text
	that could run as a spreadsheet formula is prefixed with ' so it opens as plain text.
</p>

<section class="card mt-6 max-w-xl space-y-4" aria-labelledby="export-h">
	<h2 id="export-h" class="font-semibold">What to export</h2>
	<label class="label">
		Month
		<input class="field" type="month" bind:value={month} disabled={allMonths} />
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" class="rounded border-slate-300" bind:checked={allMonths} />
		All months
	</label>
	<div class="flex flex-wrap gap-3">
		<a class="btn" href="/export/charges.csv{query}" download>Download charges CSV</a>
		<a class="btn-secondary" href="/export/payments.csv{query}" download>Download payments CSV</a>
	</div>
	<p class="text-xs text-slate-500">
		Charges are filtered by billing month and include what is still unpaid on each; payments are
		filtered by the date paid and carry their receipt number.
	</p>
</section>
