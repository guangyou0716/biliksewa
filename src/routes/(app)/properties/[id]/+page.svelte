<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const board = $derived(data.board);
</script>

<svelte:head><title>{board.property.name} · biliksewa</title></svelte:head>

<a href="/properties" class="text-sm text-brand-700 hover:underline">← Properties</a>
<h1 class="mt-1 text-2xl font-semibold">{board.property.name}</h1>
<p class="text-sm text-slate-500">
	{board.property.area} · rent due on day {board.property.rentDueDay} of each month
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
							<span class="font-medium">Bed {b.label}</span>
							<span
								class="badge {b.occupant
									? 'bg-brand-100 text-brand-700'
									: 'bg-slate-100 text-slate-600'}"
							>
								{b.occupant ? 'Occupied' : 'Vacant'}
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
								{formatRM(b.occupant.rentSen)}/month · since {b.occupant.startDate}
							</p>
						{:else}
							<p class="mt-2 text-xs text-slate-500">Asking {formatRM(b.defaultRentSen)}/month</p>
							<a class="btn mt-2 px-3 py-1 text-xs" href="/tenancies/new?bed={b.id}">Move in</a>
						{/if}
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/bed" use:enhance class="mt-4 flex flex-wrap items-end gap-3">
				<input type="hidden" name="roomId" value={r.id} />
				<label class="label">
					Bed label <input class="field w-28" name="label" required placeholder="C" />
				</label>
				<label class="label">
					Rent (RM) <input
						class="field w-32"
						name="rent"
						required
						inputmode="decimal"
						placeholder="350"
					/>
				</label>
				<button class="btn-secondary">Add bed to {r.name}</button>
			</form>
		</section>
	{:else}
		<p class="card text-sm text-slate-500">No rooms yet. Add the first room below.</p>
	{/each}

	<form method="POST" action="?/room" use:enhance class="card flex flex-wrap items-end gap-3">
		<label class="label">
			New room <input class="field" name="name" required placeholder="Room 4" />
		</label>
		<button class="btn">Add room</button>
	</form>
</div>
