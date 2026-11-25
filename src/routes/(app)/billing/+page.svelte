<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import { addDays, monthRange } from '#lib/dates.ts';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const thisMonth = $derived(data.today.slice(0, 7));
	const lastMonth = $derived.by(() => {
		const [y, m] = thisMonth.split('-').map(Number);
		return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
	});
	const lastRange = $derived(monthRange(lastMonth));
	const v = $derived(form?.values ?? {});
	const preview = $derived(form && 'preview' in form ? (form.preview ?? null) : null);
	const rentDone = $derived(form && 'rent' in form ? (form.rent ?? null) : null);
	const splitDone = $derived(form && 'split' in form ? (form.split ?? null) : null);
</script>

<svelte:head><title>Billing · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">Billing</h1>
<p class="text-sm text-slate-500">
	All amounts are in ringgit. Nothing is charged to a card: this only records bills.
</p>

<div class="mt-4">
	<FormMessage
		error={form?.error}
		success={rentDone
			? rentDone.message
			: splitDone
				? `Split ${splitDone.label} (${formatRM(splitDone.amountSen)}) across ${splitDone.count} tenants.`
				: null}
	/>
</div>

<div class="mt-4 grid gap-6 lg:grid-cols-2">
	<form method="POST" action="?/rent" use:enhance class="card space-y-4 self-start">
		<h2 class="font-semibold">Monthly rent</h2>
		<p class="text-sm text-slate-500">
			Creates one rent charge per tenancy for the month. Move-ins and move-outs are pro-rated by
			nights. Running it twice is safe.
		</p>
		<label class="label">
			Month <input class="field" type="month" name="period" required defaultValue={thisMonth} />
		</label>
		<button class="btn">Generate rent</button>
	</form>

	<form
		method="POST"
		action="?/preview"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
		class="card space-y-4"
	>
		<h2 class="font-semibold">Split a house bill</h2>
		<p class="text-sm text-slate-500">
			Electricity, water or internet for the whole house, shared by the nights each tenant stayed.
			Shares always add up to the bill, to the sen.
		</p>
		<label class="label">
			Property
			<select class="field" name="propertyId" required>
				{#each data.properties as p (p.id)}
					<option value={p.id} selected={String(p.id) === v.propertyId}>{p.name}</option>
				{/each}
			</select>
		</label>
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="label">
				Bill <input
					class="field"
					name="label"
					required
					placeholder="TNB electricity"
					value={v.label ?? ''}
				/>
			</label>
			<label class="label">
				Amount (RM) <input
					class="field"
					name="amount"
					required
					inputmode="decimal"
					value={v.amount ?? ''}
				/>
			</label>
			<label class="label">
				From <input
					class="field"
					type="date"
					name="fromDate"
					required
					value={v.fromDate ?? lastRange.start}
				/>
			</label>
			<label class="label">
				To <input
					class="field"
					type="date"
					name="toDate"
					required
					value={v.toDate ?? addDays(lastRange.endExclusive, -1)}
				/>
			</label>
			<label class="label">
				Due date <input
					class="field"
					type="date"
					name="dueDate"
					required
					value={v.dueDate ?? addDays(data.today, 14)}
				/>
			</label>
		</div>
		<button class="btn-secondary">Preview split</button>
	</form>
</div>

{#if preview}
	<section class="card mt-6" aria-labelledby="preview-h">
		<h2 id="preview-h" class="font-semibold">
			Preview: {preview.input.label} · {formatRM(preview.input.amountSen)} · {preview.input
				.fromDate} to {preview.input.toDate}
		</h2>
		<table class="mt-3 table">
			<thead>
				<tr><th>Tenant</th><th class="text-right">Nights</th><th class="text-right">Share</th></tr>
			</thead>
			<tbody>
				{#each preview.shares as s (s.id)}
					<tr>
						<td>{s.tenantName}</td>
						<td class="text-right tabular-nums">{s.nights}</td>
						<td class="text-right tabular-nums">{formatRM(s.amountSen)}</td>
					</tr>
				{/each}
				<tr class="font-semibold">
					<td>Total</td>
					<td class="text-right tabular-nums">
						{preview.shares.reduce((n, s) => n + s.nights, 0)}
					</td>
					<td class="text-right tabular-nums">
						{formatRM(preview.shares.reduce((n, s) => n + s.amountSen, 0))}
					</td>
				</tr>
			</tbody>
		</table>
		<form method="POST" action="?/split" use:enhance class="mt-4">
			<input type="hidden" name="propertyId" value={preview.input.propertyId} />
			<input type="hidden" name="label" value={preview.input.label} />
			<input type="hidden" name="amount" value={(preview.input.amountSen / 100).toFixed(2)} />
			<input type="hidden" name="fromDate" value={preview.input.fromDate} />
			<input type="hidden" name="toDate" value={preview.input.toDate} />
			<input type="hidden" name="dueDate" value={preview.input.dueDate} />
			<button class="btn">Confirm and bill {preview.shares.length} tenants</button>
		</form>
	</section>
{/if}
