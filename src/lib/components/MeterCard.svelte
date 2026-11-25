<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatKwh, formatRate } from '#lib/meter.ts';
	import { formatRM } from '#lib/money.ts';
	import { t } from '#lib/i18n.svelte.ts';

	interface Reading {
		id: number;
		readOn: string;
		readingTenths: number;
		status: 'pending' | 'confirmed' | 'rejected';
		rejectReason: string | null;
		hasPhoto: boolean;
		mine: boolean;
		usedTenths: number | null;
		shareSen: number | null;
	}
	let {
		tenancyId,
		active,
		today,
		meter
	}: {
		tenancyId: number;
		active: boolean;
		today: string;
		meter: {
			enabled: boolean;
			rate: number | null;
			lastConfirmed: { readOn: string; readingTenths: number } | null;
			pending: boolean;
			readings: Reading[];
		};
	} = $props();

	const uid = $props.id();
	/** Phone photos are several MB: shrink them in the browser before upload (server limit 300 KB). */
	const LIMIT = 300_000;
	let photoNote = $state('');

	async function shrink(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		photoNote = '';
		if (!file || file.size <= LIMIT) return;
		try {
			const bitmap = await createImageBitmap(file);
			const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(bitmap.width * scale);
			canvas.height = Math.round(bitmap.height * scale);
			canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.7));
			if (!blob || blob.size > LIMIT) throw new Error('still too large');
			const files = new DataTransfer();
			files.items.add(new File([blob], 'meter.jpg', { type: 'image/jpeg' }));
			input.files = files.files;
			photoNote = t('meter.resized', { kb: Math.round(blob.size / 1000) });
		} catch {
			photoNote = t('meter.tooLarge');
			input.value = '';
		}
	}
	const statusClass = {
		pending: 'bg-amber-100 text-amber-800',
		confirmed: 'bg-brand-100 text-brand-700',
		rejected: 'bg-red-100 text-red-700'
	};
</script>

{#if meter.enabled || meter.readings.length}
	<section class="card space-y-3" aria-labelledby="{uid}-meter">
		<h3 id="{uid}-meter" class="font-semibold">{t('meter.heading')}</h3>
		<p class="text-sm text-slate-600">
			{#if meter.rate !== null}{t('meter.billedAt', { rate: formatRate(meter.rate) })}{/if}
			{#if meter.lastConfirmed}
				{t('meter.lastConfirmed', {
					kwh: formatKwh(meter.lastConfirmed.readingTenths),
					date: meter.lastConfirmed.readOn
				})}
			{:else}
				{t('meter.noConfirmed')}
			{/if}
		</p>

		{#if active && meter.enabled && meter.pending}
			<p class="text-sm text-slate-500">
				{t('meter.waiting')}
			</p>
		{:else if active && meter.enabled}
			<form
				method="POST"
				action="?/reading"
				enctype="multipart/form-data"
				use:enhance
				class="grid gap-3 sm:grid-cols-3"
			>
				<input type="hidden" name="tenancyId" value={tenancyId} />
				<label class="label">
					{t('meter.reading')}
					<input class="field" name="reading" required inputmode="decimal" placeholder="1234.5" />
				</label>
				<label class="label">
					{t('col.readOn')}
					<input
						class="field"
						type="date"
						name="readOn"
						required
						max={today}
						defaultValue={today}
					/>
				</label>
				<label class="label">
					{t('meter.photo')}
					<input
						class="mt-1 block w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
						type="file"
						name="photo"
						accept="image/jpeg,image/png,image/webp"
						onchange={shrink}
					/>
				</label>
				{#if photoNote}<p class="text-xs text-slate-500 sm:col-span-3">{photoNote}</p>{/if}
				<button class="btn sm:col-span-3 sm:justify-self-start">{t('meter.send')}</button>
			</form>
		{/if}

		{#if meter.readings.length}
			<table class="table">
				<thead>
					<tr>
						<th>{t('col.readOn')}</th><th>{t('col.reading')}</th><th>{t('col.status')}</th>
						<th class="text-right">{t('col.yourShare')}</th>
					</tr>
				</thead>
				<tbody>
					{#each meter.readings as r (r.id)}
						<tr>
							<td class="whitespace-nowrap text-slate-500">{r.readOn}</td>
							<td class="tabular-nums">
								{formatKwh(r.readingTenths)}
								{#if r.mine && r.hasPhoto}
									<a
										class="ml-1 text-xs text-brand-700 underline"
										href="/portal/readings/{r.id}/photo"
									>
										{t('meter.photoLink')}
									</a>
								{/if}
							</td>
							<td>
								<span class="badge {statusClass[r.status]}">
									{t(`meter.status.${r.status}`)}
								</span>
								{#if r.status === 'rejected' && r.rejectReason}
									<span class="block text-xs text-red-700">
										{t('meter.reason', { reason: r.rejectReason })}
									</span>
								{/if}
							</td>
							<td class="text-right tabular-nums">
								{#if r.shareSen !== null}
									{formatRM(r.shareSen)}
								{:else if r.status === 'confirmed' && r.usedTenths === null}
									<span class="text-xs text-slate-500">{t('meter.opening')}</span>
								{:else}—{/if}
								{#if r.usedTenths !== null}
									<span class="block text-xs text-slate-500">
										{t('meter.used', { kwh: formatKwh(r.usedTenths) })}
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
{/if}
