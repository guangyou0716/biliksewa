<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Tenant invite · biliksewa</title></svelte:head>

<main
	class="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 to-slate-100 px-4"
>
	<div class="card w-full max-w-sm">
		<h1 class="text-xl font-semibold text-brand-900">biliksewa tenant portal</h1>
		{#if data.invite}
			<p class="mt-1 text-sm text-slate-600">
				{data.invite.landlordName} invited <strong>{data.invite.tenantName}</strong> to see their rent,
				bills and payments online. Choose a password to finish.
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
						defaultValue={form?.email ?? data.invite.email}
					/>
				</label>
				<label class="label">
					Password
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
					Confirm password
					<input
						class="field"
						type="password"
						name="confirm"
						autocomplete="new-password"
						minlength={data.minPassword}
						required
					/>
				</label>
				<button class="btn w-full">Create my account</button>
			</form>
			<p class="mt-4 text-xs text-slate-500">
				This link works once and expires on {data.invite.expiresOn}.
			</p>
		{:else}
			<p role="alert" class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
				This invite link is not valid. It may have been used already or expired. Ask your landlord
				for a new link.
			</p>
			<a href="/login" class="btn-secondary mt-4 w-full">Go to sign in</a>
		{/if}
	</div>
</main>
