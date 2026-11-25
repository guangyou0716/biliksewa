<script lang="ts">
	import DepositSummary from '#lib/components/DepositSummary.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import MeterCard from '#lib/components/MeterCard.svelte';
	import Ledger from '#lib/components/Ledger.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t('portal.title')} · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">{t('portal.hi', { name: data.user.name })}</h1>
<p class="text-sm text-slate-500">{t('portal.intro')}</p>

<div class="mt-4">
	<FormMessage error={form?.error} success={form && 'success' in form ? form.success : null} />
</div>

{#each data.stays as s (s.tenancy.id)}
	<section class="mt-6 space-y-4" aria-label={t('portal.stayAt', { property: s.propertyName })}>
		<div class="flex flex-wrap items-baseline gap-3">
			<h2 class="text-lg font-semibold">{s.propertyName}</h2>
			{#if s.active}
				<span class="badge bg-brand-100 text-brand-700">{t('portal.staying')}</span>
			{:else}
				<span class="badge bg-slate-100 text-slate-600">
					{t('common.movedOut', { date: s.tenancy.endDate ?? '' })}
				</span>
			{/if}
		</div>
		<p class="text-sm text-slate-500">
			{t('portal.details', {
				area: s.propertyArea,
				room: s.roomName,
				bed: t('common.bed', { label: s.bedLabel }),
				start: s.tenancy.startDate,
				rent: formatRM(s.tenancy.monthlyRentSen),
				deposit: formatRM(s.tenancy.depositSen),
				landlord: s.landlordName
			})}
		</p>
		<div class="grid gap-4 sm:grid-cols-3" aria-label={t('portal.balanceGroup')} role="group">
			<Stat label={t('portal.billed')} value={formatRM(s.chargedSen)} />
			<Stat label={t('portal.paid')} value={formatRM(s.paidSen)} tone="good" />
			<Stat
				label={t('portal.balance')}
				value={formatRM(s.balanceSen)}
				tone={s.overdueSen > 0 ? 'warn' : 'default'}
				hint={s.overdueSen > 0
					? t('portal.overdue', { amount: formatRM(s.overdueSen) })
					: t('portal.nothingOverdue')}
			/>
		</div>
		<p>
			<a
				class="btn-secondary"
				href="/portal/statements/{s.tenancy.id}"
				aria-label={t('portal.statementFor', { property: s.propertyName })}
			>
				{t('portal.statement')}
			</a>
		</p>
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
	<p class="card mt-6 text-sm text-slate-500">{t('portal.noTenancy')}</p>
{/each}
