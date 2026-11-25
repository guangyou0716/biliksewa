<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const rent = $derived((data.bed.defaultRentSen / 100).toFixed(2));
</script>

<svelte:head><title>{t('prop.moveIn')} · biliksewa</title></svelte:head>

<a href="/properties/{data.property.id}" class="text-sm text-brand-700 hover:underline">
	← {data.property.name}
</a>
<h1 class="mt-1 text-2xl font-semibold">{t('prop.moveIn')}</h1>
<p class="text-sm text-slate-500">
	{data.property.name} · {data.room.name} · {t('common.bed', { label: data.bed.label })}
</p>

<form method="POST" use:enhance class="card mt-6 max-w-xl space-y-4">
	<FormMessage error={form?.error} />
	<label class="label">
		{t('moveIn.tenantName')}
		<input class="field" name="name" required value={form?.values?.name ?? ''} />
	</label>
	<label class="label">
		{t('moveIn.email')}
		<input class="field" type="email" name="email" value={form?.values?.email ?? ''} />
	</label>
	<div class="grid gap-4 sm:grid-cols-3">
		<label class="label">
			{t('field.moveInDate')}
			<input
				class="field"
				type="date"
				name="startDate"
				required
				value={form?.values?.startDate ?? data.today}
			/>
		</label>
		<label class="label">
			{t('moveIn.rent')}
			<input
				class="field"
				name="rent"
				required
				inputmode="decimal"
				value={form?.values?.rent ?? rent}
			/>
		</label>
		<label class="label">
			{t('moveIn.deposit')}
			<input
				class="field"
				name="deposit"
				required
				inputmode="decimal"
				value={form?.values?.deposit ?? rent}
			/>
		</label>
	</div>
	<p class="text-xs text-slate-500">{t('moveIn.prorated')}</p>
	<button class="btn">{t('prop.moveIn')}</button>
</form>
