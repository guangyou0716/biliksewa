<script lang="ts">
	import { t } from '#lib/i18n.svelte.ts';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let showPast = $state(false);
	const rows = $derived(data.tenancies.filter((r) => showPast || r.active));
</script>

<svelte:head><title>{t('nav.tenants')} · biliksewa</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold">{t('nav.tenants')}</h1>
	<label class="flex items-center gap-2 text-sm text-slate-600">
		<input
			type="checkbox"
			class="rounded border-slate-300 text-brand-600"
			bind:checked={showPast}
		/>
		{t('tenants.showPast')}
	</label>
</div>

<div class="card mt-6 overflow-x-auto p-0">
	<table class="table">
		<thead>
			<tr>
				<th>{t('common.tenant')}</th><th>{t('col.bed')}</th><th>{t('col.stay')}</th><th
					class="text-right"
				>
					{t('col.balance')}
				</th><th class="text-right">{t('col.overdue')}</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.id)}
				<tr>
					<td>
						<a class="font-medium text-brand-700 hover:underline" href="/tenancies/{r.id}">
							{r.tenantName}
						</a>
					</td>
					<td class="text-slate-500">{r.where}</td>
					<td class="text-slate-500">{r.startDate} → {r.endDate ?? t('tenants.now')}</td>
					<td class="text-right tabular-nums">{formatRM(r.balanceSen)}</td>
					<td
						class="text-right tabular-nums {r.overdueSen > 0
							? 'font-medium text-amber-700'
							: 'text-slate-500'}"
					>
						{formatRM(r.overdueSen)}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="5" class="text-slate-500">{t('tenants.none')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
