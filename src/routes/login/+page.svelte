<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import LocalePicker from '#lib/components/LocalePicker.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>{t('login.title')} · biliksewa</title></svelte:head>

<main
	class="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 to-slate-100 px-4"
>
	<div class="card w-full max-w-sm">
		<div class="flex items-start justify-between gap-2">
			<h1 class="text-xl font-semibold text-brand-900">biliksewa</h1>
			<LocalePicker class="-mt-1 -mr-2" />
		</div>
		<p class="mt-1 text-sm text-slate-500">{t('login.intro')}</p>
		<form method="POST" use:enhance class="mt-5 space-y-4">
			<FormMessage error={form?.error} />
			<label class="label">
				{t('login.email')}
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
				{t('login.password')}
				<input
					class="field"
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/>
			</label>
			<button class="btn w-full">{t('login.submit')}</button>
		</form>
		<p class="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
			{t('login.demoAccounts')}<br />
			{t('common.landlord')} <code>demo@biliksewa.test</code> / <code>demo-landlord</code><br />
			{t('common.tenant')} <code>tenant@biliksewa.test</code> / <code>demo-tenant</code>
			{#if import.meta.env.VITE_PUBLIC_DEMO}
				<br />{t('login.publicDemo')}
			{/if}
		</p>
	</div>
</main>
