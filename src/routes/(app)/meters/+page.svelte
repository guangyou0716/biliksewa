<script lang="ts">
	import { enhance } from '$app/forms';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import { formatKwh, formatRate, rateInput } from '#lib/meter.ts';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const m = $derived(data.meters);
</script>

<svelte:head><title>Meter readings · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">Meter readings</h1>
<p class="text-sm text-slate-500">
	Room electricity sub-meters. Tenants send readings from their portal; a confirmed reading bills
	the kWh since the previous one at the property's rate, split by nights stayed in a shared room.
</p>

<div class="mt-4">
	<FormMessage error={form?.error} success={form && 'success' in form ? form.success : null} />
</div>

<section class="mt-6 space-y-3" aria-labelledby="pending-h">
	<h2 id="pending-h" class="text-lg font-semibold">Waiting for you ({m.pending.length})</h2>
	{#each m.pending as r (r.id)}
		<article class="card space-y-3" aria-label="Reading from {r.tenantName ?? 'landlord'}">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<p class="font-medium">
					{r.propertyName} · {r.roomName}
					<span class="text-sm font-normal text-slate-500">
						from {r.tenantName ?? 'you'} · read {r.readOn}
					</span>
				</p>
				{#if r.hasPhoto}
					<a
						class="text-sm text-brand-700 hover:underline"
						href="/meters/photos/{r.id}"
						target="_blank"
					>
						View photo
					</a>
				{/if}
			</div>
			<dl class="grid gap-2 text-sm sm:grid-cols-3">
				<div>
					<dt class="text-slate-500">Reading</dt>
					<dd class="tabular-nums">{formatKwh(r.readingTenths)}</dd>
				</div>
				<div>
					<dt class="text-slate-500">Last confirmed</dt>
					<dd class="tabular-nums">
						{r.last
							? `${formatKwh(r.last.readingTenths)} on ${r.last.readOn}`
							: 'None (opening reading)'}
					</dd>
				</div>
				<div>
					<dt class="text-slate-500">Would bill</dt>
					<dd class="tabular-nums">
						{#if r.usedTenths !== null && r.usedTenths < 0}
							<span class="text-red-700">Lower than the last reading</span>
						{:else if r.usedTenths !== null && r.estimateSen !== null}
							{formatKwh(r.usedTenths)} = {formatRM(r.estimateSen)}
						{:else}—{/if}
					</dd>
				</div>
			</dl>
			<div class="flex flex-wrap items-end gap-3">
				<form method="POST" action="?/confirm" use:enhance>
					<input type="hidden" name="readingId" value={r.id} />
					<button class="btn">Confirm and bill</button>
				</form>
				<form
					method="POST"
					action="?/reject"
					use:enhance
					class="flex flex-1 flex-wrap items-end gap-2"
				>
					<input type="hidden" name="readingId" value={r.id} />
					<label class="label flex-1">
						Reason for rejecting
						<input
							class="field"
							name="reason"
							required
							maxlength="200"
							placeholder="e.g. Photo is blurry"
						/>
					</label>
					<button class="btn-secondary">Reject</button>
				</form>
			</div>
		</article>
	{:else}
		<p class="card text-sm text-slate-500">No readings are waiting.</p>
	{/each}
</section>

<section class="mt-8 grid gap-6 lg:grid-cols-2">
	{#each m.properties as p (p.id)}
		<div class="card space-y-4" aria-label="Meters at {p.name}" role="group">
			<h2 class="font-semibold">{p.name}</h2>
			<form method="POST" action="?/rate" use:enhance class="flex flex-wrap items-end gap-2">
				<input type="hidden" name="propertyId" value={p.id} />
				<label class="label">
					Rate (RM per kWh)
					<input
						class="field w-32"
						name="rate"
						inputmode="decimal"
						placeholder="Off"
						value={p.rate === null ? '' : rateInput(p.rate)}
					/>
				</label>
				<button class="btn-secondary">Save rate</button>
				<span class="text-xs text-slate-500">
					{p.rate === null
						? 'Meter readings are off. Leave empty to keep them off.'
						: `Now ${formatRate(p.rate)}. Empty turns readings off.`}
				</span>
			</form>
			{#if p.rooms.length}
				<table class="table">
					<thead><tr><th>Room</th><th>Last confirmed</th></tr></thead>
					<tbody>
						{#each p.rooms as r (r.id)}
							<tr>
								<td>{r.name}</td>
								<td class="text-slate-600 tabular-nums">
									{r.last ? `${formatKwh(r.last.readingTenths)} on ${r.last.readOn}` : '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<form
					method="POST"
					action="?/record"
					use:enhance
					class="grid gap-2 sm:grid-cols-4 sm:items-end"
				>
					<label class="label">
						Room
						<select class="field" name="roomId">
							{#each p.rooms as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
						</select>
					</label>
					<label class="label">
						Reading (kWh) <input class="field" name="reading" required inputmode="decimal" />
					</label>
					<label class="label">
						Read on <input
							class="field"
							type="date"
							name="readOn"
							required
							max={data.today}
							defaultValue={data.today}
						/>
					</label>
					<button class="btn-secondary">Record reading</button>
				</form>
			{/if}
		</div>
	{/each}
</section>

<section class="card mt-8 overflow-x-auto" aria-labelledby="history-h">
	<h2 id="history-h" class="font-semibold">Recent decisions</h2>
	<table class="mt-3 table">
		<thead>
			<tr>
				<th>Read on</th><th>Room</th><th>From</th><th>Reading</th><th>Status</th><th
					class="text-right"
				>
					Billed
				</th>
			</tr>
		</thead>
		<tbody>
			{#each m.decided as r (r.id)}
				<tr>
					<td class="whitespace-nowrap text-slate-500">{r.readOn}</td>
					<td>{r.propertyName} · {r.roomName}</td>
					<td>{r.tenantName ?? 'You'}</td>
					<td class="tabular-nums">{formatKwh(r.readingTenths)}</td>
					<td>
						{r.status === 'confirmed' ? 'Confirmed' : 'Rejected'}
						{#if r.rejectReason}<span class="block text-xs text-slate-500">
								{r.rejectReason}
							</span>{/if}
					</td>
					<td class="text-right tabular-nums">
						{#if r.amountSen !== null && r.usedTenths !== null}
							{formatRM(r.amountSen)}
							<span class="block text-xs text-slate-500">{formatKwh(r.usedTenths)}</span>
						{:else if r.status === 'confirmed'}<span class="text-xs text-slate-500">
								Opening
							</span>{:else}—{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="text-slate-500">No readings yet.</td></tr>
			{/each}
		</tbody>
	</table>
</section>
