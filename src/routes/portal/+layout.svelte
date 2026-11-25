<script lang="ts">
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white print:hidden">
		<div class="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
			<a href="/portal" class="flex items-center gap-2 font-semibold text-brand-900">
				<span
					class="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"
					aria-hidden="true"
				>
					bs
				</span>
				biliksewa
				<span class="badge bg-slate-100 text-slate-600">Tenant</span>
			</a>
			<div class="ml-auto flex items-center gap-3 text-sm text-slate-600">
				<span class="hidden sm:inline">{data.user.name}</span>
				<form method="POST" action="/logout">
					<button class="btn-secondary px-3 py-1.5">Sign out</button>
				</form>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-4xl px-4 py-6">
		{@render children()}
	</main>
	<footer class="mx-auto max-w-4xl px-4 pb-8 text-xs text-slate-400 print:hidden">
		Read-only view of your own account. Questions about a charge? Ask your landlord. Today in
		Malaysia: {data.today}
	</footer>
</div>
