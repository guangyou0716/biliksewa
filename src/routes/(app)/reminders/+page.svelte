<script lang="ts">
	import Stat from '#lib/components/Stat.svelte';
	import { formatRM } from '#lib/money.ts';
	import { dayCount, HTML_LANG, LOCALE_NAMES, LOCALES } from '#lib/i18n.ts';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const totalSen = $derived(data.reminders.reduce((s, r) => s + r.overdueSen, 0));
	let copiedId: number | null = $state(null);
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

<svelte:head><title>{t('reminders.title')} · biliksewa</title></svelte:head>

<h1 class="text-2xl font-semibold">{t('reminders.title')}</h1>
<p class="text-sm text-slate-500">{t('reminders.intro', { today: data.today })}</p>

<section aria-label={t('reminders.summary')} class="mt-4 grid gap-4 sm:grid-cols-2">
	<Stat
		label={t('reminders.total')}
		value={formatRM(totalSen)}
		tone={totalSen > 0 ? 'warn' : 'default'}
	/>
	<Stat label={t('reminders.count')} value={String(data.reminders.length)} />
</section>

<nav class="mt-4 flex flex-wrap items-center gap-2 text-sm" aria-labelledby="msg-lang">
	<span id="msg-lang" class="text-slate-500">{t('reminders.messageLang')}</span>
	{#each LOCALES as locale (locale)}
		<a
			href="?lang={locale}"
			lang={HTML_LANG[locale]}
			aria-current={locale === data.messageLocale ? 'true' : undefined}
			class="rounded-md px-2 py-1 {locale === data.messageLocale
				? 'bg-brand-50 font-medium text-brand-900'
				: 'text-brand-700 hover:underline'}"
		>
			{LOCALE_NAMES[locale]}
		</a>
	{/each}
</nav>

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
							<span class="badge ml-1 bg-slate-100 text-slate-600">
								{t('common.movedOut', { date: r.endDate ?? '' })}
							</span>
						{/if}
					</h2>
					<p class="text-sm text-slate-500">{r.where}</p>
				</div>
				<div class="text-right">
					<p class="text-lg font-semibold text-amber-700 tabular-nums">
						{formatRM(r.overdueSen)}
					</p>
					<p class="text-xs text-slate-500">
						{t('reminders.since', {
							days: dayCount(t, r.daysOverdue),
							date: r.oldestDueDate ?? ''
						})}
					</p>
				</div>
			</div>
			<table class="table">
				<thead>
					<tr>
						<th>{t('col.due')}</th><th>{t('col.charge')}</th>
						<th class="text-right">{t('col.daysOverdue')}</th>
						<th class="text-right">{t('col.unpaid')}</th>
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
				{t('reminders.messageFor', { name: r.tenantName })}
				<textarea
					lang={HTML_LANG[data.messageLocale]}
					class="field font-mono text-xs"
					rows="6"
					readonly
					bind:this={boxes[r.tenancyId]}
					value={r.message}></textarea>
			</label>
			<div class="flex items-center gap-3">
				<button class="btn-secondary" onclick={() => copy(r.tenancyId, r.message)}>
					{t('reminders.copy')}
				</button>
				<a class="text-sm text-brand-700 hover:underline" href="/tenancies/{r.tenancyId}/statement">
					{t('reminders.statement')}
				</a>
				{#if copiedId === r.tenancyId}
					<span class="text-sm text-brand-700" role="status">{t('reminders.copied')}</span>
				{/if}
			</div>
		</article>
	{:else}
		<p class="card text-sm text-slate-500">{t('reminders.none')}</p>
	{/each}
</div>
