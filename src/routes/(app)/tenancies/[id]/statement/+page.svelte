<script lang="ts">
	import Statement from '#lib/components/Statement.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.statement);
</script>

<svelte:head>
	<title>{t('statement.pageTitle', { period: s.period })} · {s.stay.tenantName} · biliksewa</title>
</svelte:head>

<a
	href="/tenancies/{s.stay.tenancy.id}"
	class="text-sm text-brand-700 hover:underline print:hidden"
>
	← {s.stay.tenantName}
</a>
<Statement
	statement={s}
	basePath="/tenancies/{s.stay.tenancy.id}/statement"
	receiptHref={(id) => `/receipts/${id}`}
/>
