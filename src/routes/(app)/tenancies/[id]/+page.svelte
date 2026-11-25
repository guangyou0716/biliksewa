<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Ledger from '#lib/components/Ledger.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const l = $derived(data.ledger);
	const inviteUrl = $derived(form && 'inviteUrl' in form ? form.inviteUrl : null);
	let copied = $state(false);
	let linkInput: HTMLInputElement | undefined = $state();
	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			// No clipboard access (e.g. plain http): select the link so it can be copied by hand.
			linkInput?.select();
		}
	}
</script>

<svelte:head><title>{l.tenant.name} · biliksewa</title></svelte:head>

<a href="/tenancies" class="text-sm text-brand-700 hover:underline">← Tenants</a>
<div class="mt-1 flex flex-wrap items-baseline gap-3">
	<h1 class="text-2xl font-semibold">{l.tenant.name}</h1>
	{#if l.tenancy.endDate}
		<span class="badge bg-slate-100 text-slate-600">Moved out {l.tenancy.endDate}</span>
	{:else}
		<span class="badge bg-brand-100 text-brand-700">Staying</span>
	{/if}
</div>
<p class="text-sm text-slate-500">
	<a class="hover:underline" href="/properties/{l.property.id}">{l.property.name}</a> · {l.room
		.name} · Bed
	{l.bed.label} · since {l.tenancy.startDate} · {formatRM(l.tenancy.monthlyRentSen)}/month · deposit
	held
	{formatRM(l.tenancy.depositSen)}
</p>

<div class="mt-4">
	<FormMessage error={form?.error} success={form && 'success' in form ? form.success : null} />
</div>

<section aria-label="Balance" class="mt-4 grid gap-4 sm:grid-cols-3">
	<Stat label="Billed" value={formatRM(l.chargedSen)} />
	<Stat label="Paid" value={formatRM(l.paidSen)} tone="good" />
	<Stat
		label="Balance"
		value={formatRM(l.balanceSen)}
		tone={l.overdueSen > 0 ? 'warn' : 'default'}
		hint={l.overdueSen > 0 ? `${formatRM(l.overdueSen)} overdue` : 'Nothing overdue'}
	/>
</section>

<div class="mt-6 grid gap-6 lg:grid-cols-3">
	<div class="space-y-6 lg:col-span-2">
		<Ledger charges={l.charges} payments={l.payments} today={data.today} />
	</div>

	<div class="space-y-6">
		<form method="POST" action="?/pay" use:enhance class="card space-y-3">
			<h2 class="font-semibold">Record payment</h2>
			<label class="label">
				Amount (RM) <input class="field" name="amount" required inputmode="decimal" />
			</label>
			<label class="label">
				Paid on <input class="field" type="date" name="paidOn" required defaultValue={data.today} />
			</label>
			<label class="label">
				Method
				<select class="field" name="method">
					<option value="bank_transfer">Bank transfer</option>
					<option value="cash">Cash</option>
					<option value="other">Other</option>
				</select>
			</label>
			<label class="label">Reference (optional) <input class="field" name="reference" /></label>
			<button class="btn w-full">Record payment</button>
			<p class="text-xs text-slate-500">Recorded manually. No payment gateway is involved.</p>
		</form>

		<section class="card space-y-3" aria-labelledby="portal-h">
			<h2 id="portal-h" class="font-semibold">Tenant portal</h2>
			{#if data.portal.account}
				<p class="text-sm text-slate-600">
					Active. {l.tenant.name} signs in as <strong>{data.portal.account.email}</strong> and sees only
					this ledger.
				</p>
				<form
					method="POST"
					action="?/revokePortal"
					use:enhance={({ cancel }) => {
						if (!confirm(`Remove portal access for ${l.tenant.name}?`)) cancel();
					}}
				>
					<button class="btn-secondary w-full">Remove portal access</button>
				</form>
			{:else}
				<p class="text-sm text-slate-600">
					Send {l.tenant.name} a one-time link so they can check their own rent, bills and receipts.
				</p>
				{#if inviteUrl}
					<label class="label">
						Invite link (shown once, valid 7 days)
						<input
							bind:this={linkInput}
							class="field font-mono text-xs"
							readonly
							value={inviteUrl}
						/>
					</label>
					<div class="flex gap-2">
						<button type="button" class="btn-secondary flex-1" onclick={() => copy(inviteUrl)}>
							{copied ? 'Copied' : 'Copy link'}
						</button>
						<a
							class="btn-secondary flex-1"
							target="_blank"
							rel="noopener noreferrer"
							href="https://wa.me/?text={encodeURIComponent(
								`Hi ${l.tenant.name}, check your rent and payments for ${l.property.name} here: ${inviteUrl}`
							)}"
						>
							WhatsApp
						</a>
					</div>
				{:else if data.portal.inviteExpiresOn}
					<p class="text-xs text-slate-500">
						An invite link is open until {data.portal.inviteExpiresOn}. Creating a new one cancels
						it.
					</p>
				{/if}
				<form
					method="POST"
					action="?/invite"
					use:enhance={() => {
						copied = false;
						return ({ update }) => update({ reset: false });
					}}
				>
					<button class="btn w-full">
						{inviteUrl ? 'Create a new link' : 'Create invite link'}
					</button>
				</form>
			{/if}
		</section>

		{#if !l.tenancy.endDate}
			<form method="POST" action="?/moveOut" use:enhance class="card space-y-3">
				<h2 class="font-semibold">Move out</h2>
				<label class="label">
					Move-out date <input class="field" type="date" name="endDate" required />
				</label>
				<p class="text-xs text-slate-500">The tenant's last night is the night before this date.</p>
				<button class="btn-secondary w-full">Record move-out</button>
			</form>
		{/if}
	</div>
</div>
