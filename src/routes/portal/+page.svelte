<script lang="ts">
	import DepositSummary from '#lib/components/DepositSummary.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import MeterCard from '#lib/components/MeterCard.svelte';
	import Ledger from '#lib/components/Ledger.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>My rent · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">Hi, {data.user.name}</h1>
<p class="text-sm text-slate-500">Your rent, shared bills and payments.</p>

<div class="mt-4">
	<FormMessage error={form?.error} success={form && 'success' in form ? form.success : null} />
</div>

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
		<MeterCard tenancyId={s.tenancy.id} active={s.active} today={data.today} meter={s.meter} />
		<Ledger
			charges={s.charges}
			payments={s.payments}
			today={data.today}
			receiptHref={(id) => `/portal/receipts/${id}`}
		/>
		{#if s.deposit}<DepositSummary settlement={s.deposit} />{/if}
	</section>
{:else}
	<p class="card mt-6 text-sm text-slate-500">No tenancy is linked to this account yet.</p>
{/each}
