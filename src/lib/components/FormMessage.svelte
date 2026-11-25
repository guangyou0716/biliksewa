<script lang="ts">
	let { error, success }: { error?: string | null; success?: string | null } = $props();
</script>

{#if error}
	<p role="alert" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
		{error}
	</p>
{:else if success}
	<p
		role="status"
		class="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700"
	>
		{success}
	</p>
{/if}
