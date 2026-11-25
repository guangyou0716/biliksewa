<script lang="ts">
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.summary);
	const occupancy = $derived(s.beds ? Math.round((s.occupied / s.beds) * 100) : 0);
</script>

<svelte:head><title>Dashboard · biliksewa</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-2xl font-semibold">Dashboard</h1>
		<p class="text-sm text-slate-500">Month {s.period}</p>
	</div>
	<a class="btn" href="/billing">Bill this month</a>
</div>

<section aria-label="Summary" class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<Stat
		label="Beds occupied"
		value="{s.occupied} / {s.beds}"
		hint="{occupancy}% occupancy · {s.vacant} vacant"
	/>
	<Stat
		label="Billed this month"
		value={formatRM(s.billedSen)}
		hint="Rent and utilities for {s.period}"
	/>
	<Stat label="Collected this month" value={formatRM(s.collectedSen)} tone="good" />
	<Stat
		label="Outstanding"
		value={formatRM(s.outstandingSen)}
		tone={s.outstandingSen > 0 ? 'warn' : 'default'}
		hint="All unpaid balances"
	/>
</section>

<div class="mt-6 grid gap-6 lg:grid-cols-3">
	<section class="card lg:col-span-2" aria-labelledby="overdue-h">
		<div class="flex items-baseline justify-between gap-3">
			<h2 id="overdue-h" class="font-semibold">Overdue</h2>
			{#if s.overdue.length}
				<a class="text-sm text-brand-700 hover:underline" href="/reminders">Reminders →</a>
			{/if}
		</div>
		{#if s.overdue.length === 0}
			<p class="mt-3 text-sm text-slate-500">Nobody is overdue. 🎉</p>
		{:else}
			<table class="mt-3 table">
				<thead><tr><th>Tenant</th><th>Bed</th><th class="text-right">Overdue</th></tr></thead>
				<tbody>
					{#each s.overdue as t (t.id)}
						<tr>
							<td>
								<a class="font-medium text-brand-700 hover:underline" href="/tenancies/{t.id}">
									{t.tenantName}
								</a>
							</td>
							<td class="text-slate-500">{t.where}</td>
							<td class="text-right font-medium text-amber-700 tabular-nums">
								{formatRM(t.overdueSen)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="card" aria-labelledby="props-h">
		<h2 id="props-h" class="font-semibold">Properties</h2>
		<ul class="mt-3 space-y-3">
			{#each s.properties as p (p.id)}
				<li>
					<a
						href="/properties/{p.id}"
						class="block rounded-lg border border-slate-100 p-3 hover:border-brand-500"
					>
						<div class="flex justify-between text-sm">
							<span class="font-medium">{p.name}</span>
							<span class="text-slate-500">{p.occupied}/{p.beds} beds</span>
						</div>
						<div class="mt-2 h-2 rounded-full bg-slate-100" aria-hidden="true">
							<div
								class="h-2 rounded-full bg-brand-500"
								style="width: {p.beds ? (p.occupied / p.beds) * 100 : 0}%"
							></div>
						</div>
						<p class="mt-1 text-xs text-slate-500">{p.area}</p>
					</a>
				</li>
			{:else}
				<li class="text-sm text-slate-500">
					No properties yet. <a class="text-brand-700 underline" href="/properties">Add one</a>.
				</li>
			{/each}
		</ul>
	</section>
</div>
