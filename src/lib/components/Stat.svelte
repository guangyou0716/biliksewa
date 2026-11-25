<script lang="ts">
	let {
		label,
		value,
		hint,
		tone = 'default'
	}: {
		label: string;
		value: string;
		hint?: string;
		tone?: 'default' | 'good' | 'warn';
	} = $props();
	const tones = { default: 'text-slate-900', good: 'text-brand-700', warn: 'text-amber-700' };
</script>

<div class="card">
	<p class="text-sm text-slate-500">{label}</p>
	<p class="mt-1 text-2xl font-semibold tabular-nums {tones[tone]}">{value}</p>
	{#if hint}<p class="mt-1 text-xs text-slate-500">{hint}</p>{/if}
</div>
