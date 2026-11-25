<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const l = $derived(data.ledger);
	const methodLabel: Record<string, string> = {
		cash: 'Cash',
		bank_transfer: 'Bank transfer',
		other: 'Other'
	};
</script>

<svelte:head><title>{l.tenant.name} · biliksewa</title></svelte:head>

<a href="/tenancies" class="text-sm text-brand-700 hover:underline">← Tenants</a>
<div class="mt-1 flex flex-wrap items-baseline gap-3">
	<h1 class="text-2xl font-semibold">{l.tenant.name}</h1>
	{#if l.tenancy.endDate}
		<span class="badge bg-slate-100 text-slate-600">Moved out {l.tenancy.endDate}</span>
	{:else}
		<span class="badge bg-brand-100 text-brand-700">Staying</span>
	{/if}
</div>
<p class="text-sm text-slate-500">
	<a class="hover:underline" href="/properties/{l.property.id}">{l.property.name}</a> · {l.room
		.name} · Bed
	{l.bed.label} · since {l.tenancy.startDate} · {formatRM(l.tenancy.monthlyRentSen)}/month · deposit
	held
	{formatRM(l.tenancy.depositSen)}
</p>

<div class="mt-4">
	<FormMessage error={form?.error} success={form && 'success' in form ? form.success : null} />
</div>

<section aria-label="Balance" class="mt-4 grid gap-4 sm:grid-cols-3">
	<Stat label="Billed" value={formatRM(l.chargedSen)} />
	<Stat label="Paid" value={formatRM(l.paidSen)} tone="good" />
	<Stat
		label="Balance"
		value={formatRM(l.balanceSen)}
		tone={l.overdueSen > 0 ? 'warn' : 'default'}
		hint={l.overdueSen > 0 ? `${formatRM(l.overdueSen)} overdue` : 'Nothing overdue'}
	/>
</section>

<div class="mt-6 grid gap-6 lg:grid-cols-3">
	<div class="space-y-6 lg:col-span-2">
		<section class="card overflow-x-auto" aria-labelledby="charges-h">
			<h2 id="charges-h" class="font-semibold">Charges</h2>
			<table class="mt-3 table">
				<thead>
					<tr>
						<th>Due</th><th>Description</th><th class="text-right">Amount</th><th
							class="text-right"
						>
							Unpaid
						</th>
					</tr>
				</thead>
				<tbody>
					{#each l.charges as c (c.id)}
						<tr>
							<td class="whitespace-nowrap text-slate-500">{c.dueDate}</td>
							<td>{c.description}</td>
							<td class="text-right tabular-nums">{formatRM(c.amountSen)}</td>
							<td class="text-right tabular-nums">
								{#if c.unpaidSen === 0}
									<span class="badge bg-brand-100 text-brand-700">Paid</span>
								{:else}
									<span class={c.dueDate < data.today ? 'font-medium text-amber-700' : ''}>
										{formatRM(c.unpaidSen)}
									</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr><td colspan="4" class="text-slate-500">No charges yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="card overflow-x-auto" aria-labelledby="payments-h">
			<h2 id="payments-h" class="font-semibold">Payments</h2>
			<table class="mt-3 table">
				<thead>
					<tr>
						<th>Paid on</th><th>Method</th><th>Reference</th><th class="text-right">Amount</th>
					</tr>
				</thead>
				<tbody>
					{#each l.payments as p (p.id)}
						<tr>
							<td class="text-slate-500">{p.paidOn}</td>
							<td>{methodLabel[p.method]}</td>
							<td class="text-slate-500">{p.reference ?? '—'}</td>
							<td class="text-right tabular-nums">{formatRM(p.amountSen)}</td>
						</tr>
					{:else}
						<tr><td colspan="4" class="text-slate-500">No payments yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</section>
	</div>

	<div class="space-y-6">
		<form method="POST" action="?/pay" use:enhance class="card space-y-3">
			<h2 class="font-semibold">Record payment</h2>
			<label class="label">
				Amount (RM) <input class="field" name="amount" required inputmode="decimal" />
			</label>
			<label class="label">
				Paid on <input class="field" type="date" name="paidOn" required defaultValue={data.today} />
			</label>
			<label class="label">
				Method
				<select class="field" name="method">
					<option value="bank_transfer">Bank transfer</option>
					<option value="cash">Cash</option>
					<option value="other">Other</option>
				</select>
			</label>
			<label class="label">Reference (optional) <input class="field" name="reference" /></label>
			<button class="btn w-full">Record payment</button>
			<p class="text-xs text-slate-500">Recorded manually. No payment gateway is involved.</p>
		</form>

		{#if !l.tenancy.endDate}
			<form method="POST" action="?/moveOut" use:enhance class="card space-y-3">
				<h2 class="font-semibold">Move out</h2>
				<label class="label">
					Move-out date <input class="field" type="date" name="endDate" required />
				</label>
				<p class="text-xs text-slate-500">The tenant's last night is the night before this date.</p>
				<button class="btn-secondary w-full">Record move-out</button>
			</form>
		{/if}
	</div>
</div>
