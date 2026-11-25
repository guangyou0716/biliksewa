<script lang="ts">
	import { page } from '$app/state';
	import LocalePicker from '#lib/components/LocalePicker.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = $derived([
		{ href: '/', label: t('nav.dashboard') },
		{ href: '/properties', label: t('nav.properties') },
		{ href: '/tenancies', label: t('nav.tenants') },
		{ href: '/billing', label: t('nav.billing') },
		{ href: '/meters', label: t('nav.meters') },
		{ href: '/reminders', label: t('nav.reminders') },
		{ href: '/export', label: t('nav.export') }
	]);
	const active = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white print:hidden">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
			<a href="/" class="flex items-center gap-2 font-semibold text-brand-900">
				<span
					class="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"
					aria-hidden="true"
				>
					bs
				</span>
				biliksewa
			</a>
			<nav
				aria-label={t('nav.main')}
				class="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto"
			>
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={active(link.href) ? 'page' : undefined}
						class="rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap {active(link.href)
							? 'bg-brand-50 text-brand-700'
							: 'text-slate-600 hover:bg-slate-100'}"
					>
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-3 text-sm text-slate-600">
				<LocalePicker />
				<span class="hidden sm:inline">{data.user.name}</span>
				<form method="POST" action="/logout">
					<button class="btn-secondary px-3 py-1.5">{t('common.signOut')}</button>
				</form>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
	<footer class="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500 print:hidden">
		{t('footer.app', { today: data.today })}
	</footer>
</div>
