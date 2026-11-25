<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Sign in · biliksewa</title></svelte:head>

<main
	class="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 to-slate-100 px-4"
>
	<div class="card w-full max-w-sm">
		<h1 class="text-xl font-semibold text-brand-900">biliksewa</h1>
		<p class="mt-1 text-sm text-slate-500">
			Room &amp; bed rental for landlords. Sign in to continue.
		</p>
		<form method="POST" use:enhance class="mt-5 space-y-4">
			<FormMessage error={form?.error} />
			<label class="label">
				Email
				<input
					class="field"
					type="email"
					name="email"
					autocomplete="username"
					required
					value={form?.email ?? ''}
				/>
			</label>
			<label class="label">
				Password
				<input
					class="field"
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/>
			</label>
			<button class="btn w-full">Sign in</button>
		</form>
		<p class="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
			Demo account (synthetic data): <code>demo@biliksewa.test</code> / <code>demo-landlord</code>
			{#if import.meta.env.VITE_PUBLIC_DEMO}
				<br />This is a public demo. Anyone can change the data, and it goes back to the sample data
				every hour.
			{/if}
		</p>
	</div>
</main>
