<script lang="ts">
	import { page } from '$app/state';
	import { HTML_LANG, LOCALE_NAMES, LOCALE_SHORT, LOCALES } from '#lib/i18n.ts';
	import { currentLocale, t } from '#lib/i18n.svelte.ts';

	let { class: className = '' }: { class?: string } = $props();
	const current = $derived(currentLocale());
</script>

<!-- One submit button per language: no JavaScript needed and no surprise change on focus. -->
<form
	method="POST"
	action="/locale"
	class="flex items-center gap-0.5 text-xs print:hidden {className}"
	aria-label={t('locale.label')}
>
	<input type="hidden" name="next" value={page.url.pathname + page.url.search} />
	{#each LOCALES as locale (locale)}
		<button
			name="locale"
			value={locale}
			lang={HTML_LANG[locale]}
			title={LOCALE_NAMES[locale]}
			aria-label="{LOCALE_SHORT[locale]} – {LOCALE_NAMES[locale]}"
			aria-pressed={locale === current}
			class="rounded-md px-2 py-1 font-medium {locale === current
				? 'bg-brand-50 text-brand-900'
				: 'text-slate-600 hover:bg-slate-100'}"
		>
			{LOCALE_SHORT[locale]}
		</button>
	{/each}
</form>
