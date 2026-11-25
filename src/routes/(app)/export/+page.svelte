<script lang="ts">
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let month = $derived(data.month);
	let allMonths = $state(false);
	const query = $derived(allMonths ? '' : `?month=${month}`);
</script>

<svelte:head><title>{t('nav.export')} · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">{t('export.title')}</h1>
<p class="text-sm text-slate-500">{t('export.intro')}</p>

<section class="card mt-6 max-w-xl space-y-4" aria-labelledby="export-h">
	<h2 id="export-h" class="font-semibold">{t('export.what')}</h2>
	<label class="label">
		{t('statement.month')}
		<input class="field" type="month" bind:value={month} disabled={allMonths} />
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" class="rounded border-slate-300" bind:checked={allMonths} />
		{t('export.all')}
	</label>
	<div class="flex flex-wrap gap-3">
		<a class="btn" href="/export/charges.csv{query}" download>{t('export.charges')}</a>
		<a class="btn-secondary" href="/export/payments.csv{query}" download>{t('export.payments')}</a>
	</div>
	<p class="text-xs text-slate-500">{t('export.note')}</p>
</section>
