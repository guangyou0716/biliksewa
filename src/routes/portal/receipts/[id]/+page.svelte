<script lang="ts">
	import Receipt from '#lib/components/Receipt.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Receipt {data.receipt.number} · biliksewa</title></svelte:head>

<a href="/portal" class="text-sm text-brand-700 hover:underline print:hidden">← My rent</a>
<Receipt receipt={data.receipt} />
