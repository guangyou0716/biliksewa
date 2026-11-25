<script lang="ts">
	import Ledger from '#lib/components/Ledger.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>My rent · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">Hi, {data.user.name}</h1>
<p class="text-sm text-slate-500">Your rent, shared bills and payments.</p>

{#each data.stays as s (s.tenancy.id)}
	<section class="mt-6 space-y-4" aria-label="Stay at {s.propertyName}">
		<div class="flex flex-wrap items-baseline gap-3">
			<h2 class="text-lg font-semibold">{s.propertyName}</h2>
			{#if s.active}
				<span class="badge bg-brand-100 text-brand-700">Staying</span>
			{:else}
				<span class="badge bg-slate-100 text-slate-600">Moved out {s.tenancy.endDate}</span>
			{/if}
		</div>
		<p class="text-sm text-slate-500">
			{s.propertyArea} · {s.roomName} · Bed {s.bedLabel} · since {s.tenancy.startDate} · {formatRM(
				s.tenancy.monthlyRentSen
			)}/month · deposit {formatRM(s.tenancy.depositSen)} · landlord {s.landlordName}
		</p>
		<div class="grid gap-4 sm:grid-cols-3" aria-label="Balance" role="group">
			<Stat label="Billed" value={formatRM(s.chargedSen)} />
			<Stat label="Paid" value={formatRM(s.paidSen)} tone="good" />
			<Stat
				label="Balance"
				value={formatRM(s.balanceSen)}
				tone={s.overdueSen > 0 ? 'warn' : 'default'}
				hint={s.overdueSen > 0 ? `${formatRM(s.overdueSen)} overdue` : 'Nothing overdue'}
			/>
		</div>
		<Ledger
			charges={s.charges}
			payments={s.payments}
			today={data.today}
			receiptHref={(id) => `/portal/receipts/${id}`}
		/>
	</section>
{:else}
	<p class="card mt-6 text-sm text-slate-500">No tenancy is linked to this account yet.</p>
{/each}
