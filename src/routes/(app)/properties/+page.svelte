<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t('nav.properties')} · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">{t('nav.properties')}</h1>

<div class="mt-6 grid gap-6 lg:grid-cols-3">
	<ul class="grid gap-4 sm:grid-cols-2 lg:col-span-2">
		{#each data.properties as p (p.id)}
			<li>
				<a href="/properties/{p.id}" class="card block hover:border-brand-500">
					<h2 class="font-semibold">{p.name}</h2>
					<p class="text-sm text-slate-500">{p.area}</p>
					<p class="mt-3 text-sm">
						{t('props.bedsOccupied', { occupied: p.occupied, beds: p.beds })}
					</p>
				</a>
			</li>
		{:else}
			<li class="card text-sm text-slate-500">{t('props.none')}</li>
		{/each}
	</ul>

	<form method="POST" use:enhance class="card space-y-4 self-start">
		<h2 class="font-semibold">{t('props.add')}</h2>
		<FormMessage error={form?.error} />
		<label class="label">
			{t('props.name')}
			<input
				class="field"
				name="name"
				required
				placeholder="Rumah Melur"
				value={form?.values?.name ?? ''}
			/>
		</label>
		<label class="label">
			{t('props.area')}
			<input
				class="field"
				name="area"
				required
				placeholder="Simpang Ampat"
				value={form?.values?.area ?? ''}
			/>
		</label>
		<button class="btn">{t('props.add')}</button>
	</form>
</div>
