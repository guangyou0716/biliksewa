<script lang="ts">
	import Receipt from '#lib/components/Receipt.svelte';
	import { t } from '#lib/i18n.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('receipt.pageTitle', { number: data.receipt.number })} · biliksewa</title>
</svelte:head>

<a
	href="/tenancies/{data.receipt.payment.tenancyId}"
	class="text-sm text-brand-700 hover:underline print:hidden"
>
	← {data.receipt.tenantName}
</a>
<Receipt receipt={data.receipt} />
