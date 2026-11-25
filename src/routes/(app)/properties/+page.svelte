<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Properties · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">Properties</h1>

<div class="mt-6 grid gap-6 lg:grid-cols-3">
	<ul class="grid gap-4 sm:grid-cols-2 lg:col-span-2">
		{#each data.properties as p (p.id)}
			<li>
				<a href="/properties/{p.id}" class="card block hover:border-brand-500">
					<h2 class="font-semibold">{p.name}</h2>
					<p class="text-sm text-slate-500">{p.area}</p>
					<p class="mt-3 text-sm">
						<span class="font-medium">{p.occupied}</span> of {p.beds} beds occupied
					</p>
				</a>
			</li>
		{:else}
			<li class="card text-sm text-slate-500">No properties yet.</li>
		{/each}
	</ul>

	<form method="POST" use:enhance class="card space-y-4 self-start">
		<h2 class="font-semibold">Add property</h2>
		<FormMessage error={form?.error} />
		<label class="label">
			Name <input
				class="field"
				name="name"
				required
				placeholder="Rumah Melur"
				value={form?.values?.name ?? ''}
			/>
		</label>
		<label class="label">
			Area <input
				class="field"
				name="area"
				required
				placeholder="Simpang Ampat"
				value={form?.values?.area ?? ''}
			/>
		</label>
		<button class="btn">Add property</button>
	</form>
</div>
