<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import { addDays, monthRange } from '#lib/dates.ts';
	import { t } from '#lib/i18n.svelte.ts';
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

<svelte:head><title>{t('nav.billing')} · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">{t('nav.billing')}</h1>
<p class="text-sm text-slate-500">{t('bill.intro')}</p>

<div class="mt-4">
	<FormMessage
		error={form?.error}
		success={rentDone
			? rentDone.message
			: splitDone
				? t('ok.split', {
						label: splitDone.label,
						amount: formatRM(splitDone.amountSen),
						n: splitDone.count
					})
				: null}
	/>
</div>

<div class="mt-4 grid gap-6 lg:grid-cols-2">
	<form method="POST" action="?/rent" use:enhance class="card space-y-4 self-start">
		<h2 class="font-semibold">{t('field.monthlyRent')}</h2>
		<p class="text-sm text-slate-500">{t('bill.rentIntro')}</p>
		<label class="label">
			{t('statement.month')}
			<input class="field" type="month" name="period" required defaultValue={thisMonth} />
		</label>
		<button class="btn">{t('bill.generate')}</button>
	</form>

	<form
		method="POST"
		action="?/preview"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
		class="card space-y-4"
	>
		<h2 class="font-semibold">{t('bill.split')}</h2>
		<p class="text-sm text-slate-500">{t('bill.splitIntro')}</p>
		<label class="label">
			{t('bill.property')}
			<select class="field" name="propertyId" required>
				{#each data.properties as p (p.id)}
					<option value={p.id} selected={String(p.id) === v.propertyId}>{p.name}</option>
				{/each}
			</select>
		</label>
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="label">
				{t('bill.bill')}
				<input
					class="field"
					name="label"
					required
					placeholder="TNB electricity"
					value={v.label ?? ''}
				/>
			</label>
			<label class="label">
				{t('tenancy.amountRM')}
				<input class="field" name="amount" required inputmode="decimal" value={v.amount ?? ''} />
			</label>
			<label class="label">
				{t('field.from')}
				<input
					class="field"
					type="date"
					name="fromDate"
					required
					value={v.fromDate ?? lastRange.start}
				/>
			</label>
			<label class="label">
				{t('field.to')}
				<input
					class="field"
					type="date"
					name="toDate"
					required
					value={v.toDate ?? addDays(lastRange.endExclusive, -1)}
				/>
			</label>
			<label class="label">
				{t('field.dueDate')}
				<input
					class="field"
					type="date"
					name="dueDate"
					required
					value={v.dueDate ?? addDays(data.today, 14)}
				/>
			</label>
		</div>
		<button class="btn-secondary">{t('bill.previewBtn')}</button>
	</form>
</div>

{#if preview}
	<section class="card mt-6" aria-labelledby="preview-h">
		<h2 id="preview-h" class="font-semibold">
			{t('bill.previewHeading', {
				label: preview.input.label,
				amount: formatRM(preview.input.amountSen),
				from: preview.input.fromDate,
				to: preview.input.toDate
			})}
		</h2>
		<table class="mt-3 table">
			<thead>
				<tr>
					<th>{t('common.tenant')}</th><th class="text-right">{t('col.nights')}</th><th
						class="text-right"
					>
						{t('col.share')}
					</th>
				</tr>
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
					<td>{t('col.total')}</td>
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
			<button class="btn">{t('bill.confirm', { n: preview.shares.length })}</button>
		</form>
	</section>
{/if}
