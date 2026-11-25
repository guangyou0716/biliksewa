<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import LocalePicker from '#lib/components/LocalePicker.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t('invite.title')} · biliksewa</title></svelte:head>

<main
	class="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 to-slate-100 px-4"
>
	<div class="card w-full max-w-sm">
		<div class="flex items-start justify-between gap-2">
			<h1 class="text-xl font-semibold text-brand-900">{t('invite.heading')}</h1>
			<LocalePicker class="-mt-1 -mr-2" />
		</div>
		{#if data.invite}
			<p class="mt-1 text-sm text-slate-600">
				{t('invite.intro', {
					landlord: data.invite.landlordName,
					tenant: data.invite.tenantName
				})}
			</p>
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
						defaultValue={form?.email ?? data.invite.email}
					/>
				</label>
				<label class="label">
					{t('login.password')}
					<input
						class="field"
						type="password"
						name="password"
						autocomplete="new-password"
						minlength={data.minPassword}
						required
					/>
				</label>
				<label class="label">
					{t('invite.confirm')}
					<input
						class="field"
						type="password"
						name="confirm"
						autocomplete="new-password"
						minlength={data.minPassword}
						required
					/>
				</label>
				<button class="btn w-full">{t('invite.submit')}</button>
			</form>
			<p class="mt-4 text-xs text-slate-500">
				{t('invite.expires', { date: data.invite.expiresOn })}
			</p>
		{:else}
			<p role="alert" class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
				{t('invite.invalid')}
			</p>
			<a href="/login" class="btn-secondary mt-4 w-full">{t('invite.goSignIn')}</a>
		{/if}
	</div>
</main>
