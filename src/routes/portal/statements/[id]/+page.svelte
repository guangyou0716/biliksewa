<script lang="ts">
	import Statement from '#lib/components/Statement.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.statement);
</script>

<svelte:head>
	<title>{t('statement.pageTitle', { period: s.period })} · biliksewa</title>
</svelte:head>

<a href="/portal" class="text-sm text-brand-700 hover:underline print:hidden">{t('portal.back')}</a>
<Statement
	statement={s}
	basePath="/portal/statements/{s.stay.tenancy.id}"
	receiptHref={(id) => `/portal/receipts/${id}`}
/>
