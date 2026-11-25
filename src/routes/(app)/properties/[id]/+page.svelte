<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const board = $derived(data.board);
</script>

<svelte:head><title>{board.property.name} · biliksewa</title></svelte:head>

<a href="/properties" class="text-sm text-brand-700 hover:underline">{t('prop.back')}</a>
<h1 class="mt-1 text-2xl font-semibold">{board.property.name}</h1>
<p class="text-sm text-slate-500">
	{t('prop.dueDay', { area: board.property.area, day: board.property.rentDueDay })}
</p>

<div class="mt-4">
	<FormMessage error={form?.error} success={form && 'success' in form ? form.success : null} />
</div>

<div class="mt-4 space-y-6">
	{#each board.rooms as r (r.id)}
		<section class="card" aria-labelledby="room-{r.id}">
			<h2 id="room-{r.id}" class="font-semibold">{r.name}</h2>
			<ul class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each r.beds as b (b.id)}
					<li
						class="rounded-lg border p-3 {b.occupant
							? 'border-brand-100 bg-brand-50'
							: 'border-dashed border-slate-300 bg-white'}"
						data-testid="bed"
					>
						<div class="flex items-center justify-between">
							<span class="font-medium">{t('common.bed', { label: b.label })}</span>
							<span
								class="badge {b.occupant
									? 'bg-brand-100 text-brand-700'
									: 'bg-slate-100 text-slate-600'}"
							>
								{b.occupant ? t('prop.occupied') : t('prop.vacant')}
							</span>
						</div>
						{#if b.occupant}
							<a
								class="mt-2 block text-sm font-medium text-brand-700 hover:underline"
								href="/tenancies/{b.occupant.tenancyId}"
							>
								{b.occupant.tenantName}
							</a>
							<p class="text-xs text-slate-600">
								{t('prop.rentSince', {
									rent: formatRM(b.occupant.rentSen),
									date: b.occupant.startDate
								})}
							</p>
						{:else}
							<p class="mt-2 text-xs text-slate-500">
								{t('prop.asking', { rent: formatRM(b.defaultRentSen) })}
							</p>
							<a class="btn mt-2 px-3 py-1 text-xs" href="/tenancies/new?bed={b.id}">
								{t('prop.moveIn')}
							</a>
						{/if}
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/bed" use:enhance class="mt-4 flex flex-wrap items-end gap-3">
				<input type="hidden" name="roomId" value={r.id} />
				<label class="label">
					{t('prop.bedLabel')}
					<input class="field w-28" name="label" required placeholder="C" />
				</label>
				<label class="label">
					{t('prop.rentRM')}
					<input class="field w-32" name="rent" required inputmode="decimal" placeholder="350" />
				</label>
				<button class="btn-secondary">{t('prop.addBed', { room: r.name })}</button>
			</form>
		</section>
	{:else}
		<p class="card text-sm text-slate-500">{t('prop.noRooms')}</p>
	{/each}

	<form method="POST" action="?/room" use:enhance class="card flex flex-wrap items-end gap-3">
		<label class="label">
			{t('prop.newRoom')}
			<input class="field" name="name" required placeholder="Room 4" />
		</label>
		<button class="btn">{t('prop.addRoom')}</button>
	</form>
</div>
