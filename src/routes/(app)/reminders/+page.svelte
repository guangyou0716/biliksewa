<script lang="ts">
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const totalSen = $derived(data.reminders.reduce((s, r) => s + r.overdueSen, 0));
	let copiedId: number | null = $state(null);
	const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
	const boxes: Record<number, HTMLTextAreaElement> = {};

	async function copy(tenancyId: number, message: string) {
		try {
			await navigator.clipboard.writeText(message);
			copiedId = tenancyId;
		} catch {
			// No clipboard access (e.g. plain http): select the text so it can be copied by hand.
			boxes[tenancyId]?.select();
		}
	}
</script>

<svelte:head><title>Overdue reminders · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">Overdue reminders</h1>
<p class="text-sm text-slate-500">
	Who owes what as of {data.today}. Copy a message into WhatsApp, SMS or email yourself: biliksewa
	never sends anything.
</p>

<section aria-label="Overdue summary" class="mt-4 grid gap-4 sm:grid-cols-2">
	<Stat
		label="Overdue in total"
		value={formatRM(totalSen)}
		tone={totalSen > 0 ? 'warn' : 'default'}
	/>
	<Stat label="Tenants overdue" value={String(data.reminders.length)} />
</section>

<div class="mt-6 space-y-4">
	{#each data.reminders as r (r.tenancyId)}
		<article class="card space-y-3" aria-labelledby="rem-{r.tenancyId}">
			<div class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<h2 id="rem-{r.tenancyId}" class="font-semibold">
						<a class="text-brand-700 hover:underline" href="/tenancies/{r.tenancyId}">
							{r.tenantName}
						</a>
						{#if !r.active}
							<span class="badge ml-1 bg-slate-100 text-slate-600">Moved out {r.endDate}</span>
						{/if}
					</h2>
					<p class="text-sm text-slate-500">{r.where}</p>
				</div>
				<div class="text-right">
					<p class="text-lg font-semibold text-amber-700 tabular-nums">
						{formatRM(r.overdueSen)}
					</p>
					<p class="text-xs text-slate-500">
						{days(r.daysOverdue)} overdue (since {r.oldestDueDate})
					</p>
				</div>
			</div>
			<table class="table">
				<thead>
					<tr>
						<th>Due</th><th>Charge</th><th class="text-right">Days overdue</th>
						<th class="text-right">Unpaid</th>
					</tr>
				</thead>
				<tbody>
					{#each r.items as i (i.chargeId)}
						<tr>
							<td class="whitespace-nowrap text-slate-500">{i.dueDate}</td>
							<td>{i.description}</td>
							<td class="text-right tabular-nums">{i.daysOverdue}</td>
							<td class="text-right tabular-nums">{formatRM(i.unpaidSen)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<label class="label">
				Reminder message for {r.tenantName}
				<textarea
					class="field font-mono text-xs"
					rows="6"
					readonly
					bind:this={boxes[r.tenancyId]}
					value={r.message}></textarea>
			</label>
			<div class="flex items-center gap-3">
				<button class="btn-secondary" onclick={() => copy(r.tenancyId, r.message)}>
					Copy message
				</button>
				<a class="text-sm text-brand-700 hover:underline" href="/tenancies/{r.tenancyId}/statement">
					Statement
				</a>
				{#if copiedId === r.tenancyId}
					<span class="text-sm text-brand-700" role="status">Copied</span>
				{/if}
			</div>
		</article>
	{:else}
		<p class="card text-sm text-slate-500">Nobody is overdue. 🎉</p>
	{/each}
</div>
