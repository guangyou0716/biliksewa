<script lang="ts">
	import { enhance } from '$app/forms';
	import DepositSummary from '#lib/components/DepositSummary.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Ledger from '#lib/components/Ledger.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { settlementAmounts } from '#lib/billing.ts';
	import { t } from '#lib/i18n.svelte.ts';
	import { formatRM, parseRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const l = $derived(data.ledger);
	const inviteUrl = $derived(form && 'inviteUrl' in form ? form.inviteUrl : null);
	let copied = $state(false);
	// Live preview of the deposit settlement; the server recomputes it when the form is sent.
	let deductionAmounts: string[] = $state([]);
	const deductionsSen = $derived(
		deductionAmounts.reduce((sum, a) => sum + (a.trim() ? (parseRM(a) ?? 0) : 0), 0)
	);
	const preview = $derived(settlementAmounts(l.tenancy.depositSen, deductionsSen, l.balanceSen));
	let linkInput: HTMLInputElement | undefined = $state();
	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			// No clipboard access (e.g. plain http): select the link so it can be copied by hand.
			linkInput?.select();
		}
	}
</script>

<svelte:head><title>{l.tenant.name} · biliksewa</title></svelte:head>

<a href="/tenancies" class="text-sm text-brand-700 hover:underline">{t('tenancy.back')}</a>
<div class="mt-1 flex flex-wrap items-baseline gap-3">
	<h1 class="text-2xl font-semibold">{l.tenant.name}</h1>
	{#if l.tenancy.endDate}
		<span class="badge bg-slate-100 text-slate-600">
			{t('common.movedOut', { date: l.tenancy.endDate })}
		</span>
	{:else}
		<span class="badge bg-brand-100 text-brand-700">{t('portal.staying')}</span>
	{/if}
</div>
<p class="text-sm text-slate-500">
	<a class="hover:underline" href="/properties/{l.property.id}">{l.property.name}</a> ·
	{t('tenancy.details', {
		room: l.room.name,
		bed: t('common.bed', { label: l.bed.label }),
		start: l.tenancy.startDate,
		rent: formatRM(l.tenancy.monthlyRentSen),
		deposit: formatRM(l.tenancy.depositSen)
	})}
</p>

<p class="mt-2">
	<a class="btn-secondary" href="/tenancies/{l.tenancy.id}/statement">
		{t('portal.statement')}
	</a>
</p>

<div class="mt-4">
	<FormMessage error={form?.error} success={form && 'success' in form ? form.success : null} />
</div>

<section aria-label={t('portal.balanceGroup')} class="mt-4 grid gap-4 sm:grid-cols-3">
	<Stat label={t('portal.billed')} value={formatRM(l.chargedSen)} />
	<Stat label={t('portal.paid')} value={formatRM(l.paidSen)} tone="good" />
	<Stat
		label={t('portal.balance')}
		value={formatRM(l.balanceSen)}
		tone={l.overdueSen > 0 ? 'warn' : 'default'}
		hint={l.overdueSen > 0
			? t('portal.overdue', { amount: formatRM(l.overdueSen) })
			: t('portal.nothingOverdue')}
	/>
</section>

<div class="mt-6 grid gap-6 lg:grid-cols-3">
	<div class="space-y-6 lg:col-span-2">
		<Ledger
			charges={l.charges}
			payments={l.payments}
			today={data.today}
			receiptHref={(id) => `/receipts/${id}`}
		/>
		{#if data.deposit}<DepositSummary settlement={data.deposit} />{/if}
	</div>

	<div class="space-y-6">
		<form method="POST" action="?/pay" use:enhance class="card space-y-3">
			<h2 class="font-semibold">{t('tenancy.recordPayment')}</h2>
			<label class="label">
				{t('tenancy.amountRM')}
				<input class="field" name="amount" required inputmode="decimal" />
			</label>
			<label class="label">
				{t('field.paidOn')}
				<input class="field" type="date" name="paidOn" required defaultValue={data.today} />
			</label>
			<label class="label">
				{t('col.method')}
				<select class="field" name="method">
					<option value="bank_transfer">{t('method.bank_transfer')}</option>
					<option value="cash">{t('method.cash')}</option>
					<option value="other">{t('method.other')}</option>
				</select>
			</label>
			<label class="label">
				{t('tenancy.reference')}
				<input class="field" name="reference" />
			</label>
			<button class="btn w-full">{t('tenancy.recordPayment')}</button>
			<p class="text-xs text-slate-500">{t('tenancy.manual')}</p>
		</form>

		<section class="card space-y-3" aria-labelledby="portal-h">
			<h2 id="portal-h" class="font-semibold">{t('tenancy.portal')}</h2>
			{#if data.portal.account}
				<p class="text-sm text-slate-600">
					{t('tenancy.portalActive', { name: l.tenant.name, email: data.portal.account.email })}
				</p>
				<form
					method="POST"
					action="?/revokePortal"
					use:enhance={({ cancel }) => {
						if (!confirm(t('tenancy.confirmRevoke', { name: l.tenant.name }))) cancel();
					}}
				>
					<button class="btn-secondary w-full">{t('tenancy.revoke')}</button>
				</form>
			{:else}
				<p class="text-sm text-slate-600">{t('tenancy.inviteIntro', { name: l.tenant.name })}</p>
				{#if inviteUrl}
					<label class="label">
						{t('tenancy.inviteLink')}
						<input
							bind:this={linkInput}
							class="field font-mono text-xs"
							readonly
							value={inviteUrl}
						/>
					</label>
					<div class="flex gap-2">
						<button type="button" class="btn-secondary flex-1" onclick={() => copy(inviteUrl)}>
							{copied ? t('reminders.copied') : t('tenancy.copyLink')}
						</button>
						<a
							class="btn-secondary flex-1"
							target="_blank"
							rel="noopener noreferrer"
							href="https://wa.me/?text={encodeURIComponent(
								t('tenancy.whatsapp', {
									name: l.tenant.name,
									property: l.property.name,
									url: inviteUrl
								})
							)}"
						>
							WhatsApp
						</a>
					</div>
				{:else if data.portal.inviteExpiresOn}
					<p class="text-xs text-slate-500">
						{t('tenancy.inviteOpen', { date: data.portal.inviteExpiresOn })}
					</p>
				{/if}
				<form
					method="POST"
					action="?/invite"
					use:enhance={() => {
						copied = false;
						return ({ update }) => update({ reset: false });
					}}
				>
					<button class="btn w-full">
						{inviteUrl ? t('tenancy.newLink') : t('tenancy.createLink')}
					</button>
				</form>
			{/if}
		</section>

		{#if l.tenancy.endDate && l.tenancy.endDate > data.today && !data.deposit && l.tenancy.depositSen > 0}
			<p class="card text-sm text-slate-500">
				{t('tenancy.settleFrom', { date: l.tenancy.endDate })}
			</p>
		{:else if l.tenancy.endDate && !data.deposit && l.tenancy.depositSen > 0}
			<form method="POST" action="?/settleDeposit" use:enhance class="card space-y-3">
				<h2 class="font-semibold">{t('tenancy.settle')}</h2>
				<p class="text-xs text-slate-500">
					{t('tenancy.settleIntro', { deposit: formatRM(l.tenancy.depositSen) })}
				</p>
				<label class="label">
					{t('field.settledOn')}
					<input class="field" type="date" name="settledOn" required defaultValue={data.today} />
				</label>
				<fieldset class="space-y-2">
					<legend class="text-sm font-medium text-slate-700">{t('tenancy.deductions')}</legend>
					{#each Array.from({ length: 3 }, (_, i) => i) as i (i)}
						<div class="flex gap-2">
							<input
								class="field flex-1"
								name="deductionLabel"
								aria-label={t('tenancy.deductionDesc', { n: i + 1 })}
								placeholder={i === 0 ? t('tenancy.deductionExample') : ''}
							/>
							<input
								class="field w-28"
								name="deductionAmount"
								inputmode="decimal"
								aria-label={t('tenancy.deductionAmount', { n: i + 1 })}
								placeholder="RM"
								bind:value={deductionAmounts[i]}
							/>
						</div>
					{/each}
				</fieldset>
				<dl class="space-y-1 text-sm" aria-label={t('tenancy.preview')}>
					<div class="flex justify-between">
						<dt class="text-slate-500">{t('tenancy.usedForCharges')}</dt>
						<dd class="tabular-nums">{formatRM(preview.appliedSen)}</dd>
					</div>
					<div class="flex justify-between font-semibold">
						<dt>{t('deposit.refund')}</dt>
						<dd class="tabular-nums">{formatRM(preview.refundSen)}</dd>
					</div>
					{#if preview.balanceAfterSen > 0}
						<p class="text-xs text-amber-700">
							{t('tenancy.stillOwing', { amount: formatRM(preview.balanceAfterSen) })}
						</p>
					{:else if preview.balanceAfterSen < 0}
						<p class="text-xs text-slate-500">
							{t('tenancy.credit', { amount: formatRM(-preview.balanceAfterSen) })}
						</p>
					{/if}
				</dl>
				<label class="label">
					{t('tenancy.refundBy')}
					<select class="field" name="refundMethod">
						<option value="bank_transfer">{t('method.bank_transfer')}</option>
						<option value="cash">{t('method.cash')}</option>
						<option value="other">{t('method.other')}</option>
					</select>
				</label>
				<label class="label">
					{t('tenancy.refundRef')}
					<input class="field" name="refundReference" />
				</label>
				<button class="btn w-full">{t('tenancy.settle')}</button>
			</form>
		{/if}

		{#if !l.tenancy.endDate}
			<form method="POST" action="?/moveOut" use:enhance class="card space-y-3">
				<h2 class="font-semibold">{t('tenancy.moveOut')}</h2>
				<label class="label">
					{t('field.moveOutDate')}
					<input class="field" type="date" name="endDate" required />
				</label>
				<p class="text-xs text-slate-500">{t('tenancy.moveOutNote')}</p>
				<button class="btn-secondary w-full">{t('tenancy.recordMoveOut')}</button>
			</form>
		{/if}
	</div>
</div>
