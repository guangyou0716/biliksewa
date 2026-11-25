<script lang="ts">
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let showPast = $state(false);
	const rows = $derived(data.tenancies.filter((t) => showPast || t.active));
</script>

<svelte:head><title>Tenants · biliksewa</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold">Tenants</h1>
	<label class="flex items-center gap-2 text-sm text-slate-600">
		<input
			type="checkbox"
			class="rounded border-slate-300 text-brand-600"
			bind:checked={showPast}
		/> Show moved-out
	</label>
</div>

<div class="card mt-6 overflow-x-auto p-0">
	<table class="table">
		<thead>
			<tr>
				<th>Tenant</th><th>Bed</th><th>Stay</th><th class="text-right">Balance</th><th
					class="text-right"
				>
					Overdue
				</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as t (t.id)}
				<tr>
					<td>
						<a class="font-medium text-brand-700 hover:underline" href="/tenancies/{t.id}">
							{t.tenantName}
						</a>
					</td>
					<td class="text-slate-500">{t.where}</td>
					<td class="text-slate-500">{t.startDate} → {t.endDate ?? 'now'}</td>
					<td class="text-right tabular-nums">{formatRM(t.balanceSen)}</td>
					<td
						class="text-right tabular-nums {t.overdueSen > 0
							? 'font-medium text-amber-700'
							: 'text-slate-400'}"
					>
						{formatRM(t.overdueSen)}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="5" class="text-slate-500">
						No tenants yet. Move someone into a vacant bed from a property page.
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
