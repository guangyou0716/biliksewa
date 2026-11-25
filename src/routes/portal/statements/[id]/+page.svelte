<script lang="ts">
	import Statement from '#lib/components/Statement.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.statement);
</script>

<svelte:head><title>Statement {s.period} · biliksewa</title></svelte:head>

<a href="/portal" class="text-sm text-brand-700 hover:underline print:hidden">← My rent</a>
<Statement
	statement={s}
	basePath="/portal/statements/{s.stay.tenancy.id}"
	receiptHref={(id) => `/portal/receipts/${id}`}
/>
