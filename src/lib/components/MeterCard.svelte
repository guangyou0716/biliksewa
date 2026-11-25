<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatKwh, formatRate } from '#lib/meter.ts';
	import { formatRM } from '#lib/money.ts';

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
			photoNote = `Photo resized to ${Math.round(blob.size / 1000)} KB.`;
		} catch {
			photoNote =
				'This photo is too large (max 300 KB). Try a smaller one, or send without a photo.';
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
		<h3 id="{uid}-meter" class="font-semibold">Electricity meter (your room)</h3>
		<p class="text-sm text-slate-600">
			{#if meter.rate !== null}Billed at {formatRate(meter.rate)}.{/if}
			{#if meter.lastConfirmed}
				Last confirmed reading: <strong>{formatKwh(meter.lastConfirmed.readingTenths)}</strong> on
				{meter.lastConfirmed.readOn}.
			{:else}
				No confirmed reading yet.
			{/if}
		</p>

		{#if active && meter.enabled && meter.pending}
			<p class="text-sm text-slate-500">
				A reading for your room is waiting for the landlord to check it.
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
					Reading (kWh)
					<input class="field" name="reading" required inputmode="decimal" placeholder="1234.5" />
				</label>
				<label class="label">
					Read on <input
						class="field"
						type="date"
						name="readOn"
						required
						max={today}
						defaultValue={today}
					/>
				</label>
				<label class="label">
					Photo (optional)
					<input
						class="mt-1 block w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
						type="file"
						name="photo"
						accept="image/jpeg,image/png,image/webp"
						onchange={shrink}
					/>
				</label>
				{#if photoNote}<p class="text-xs text-slate-500 sm:col-span-3">{photoNote}</p>{/if}
				<button class="btn sm:col-span-3 sm:justify-self-start">Send reading</button>
			</form>
		{/if}

		{#if meter.readings.length}
			<table class="table">
				<thead>
					<tr>
						<th>Read on</th><th>Reading</th><th>Status</th><th class="text-right">Your share</th>
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
										class="ml-1 text-xs text-brand-700 hover:underline"
										href="/portal/readings/{r.id}/photo"
									>
										photo
									</a>
								{/if}
							</td>
							<td>
								<span class="badge {statusClass[r.status]}">
									{r.status === 'pending'
										? 'Waiting'
										: r.status === 'confirmed'
											? 'Confirmed'
											: 'Rejected'}
								</span>
								{#if r.status === 'rejected' && r.rejectReason}
									<span class="block text-xs text-red-700">Reason: {r.rejectReason}</span>
								{/if}
							</td>
							<td class="text-right tabular-nums">
								{#if r.shareSen !== null}
									{formatRM(r.shareSen)}
								{:else if r.status === 'confirmed' && r.usedTenths === null}
									<span class="text-xs text-slate-500">Opening reading</span>
								{:else}—{/if}
								{#if r.usedTenths !== null}
									<span class="block text-xs text-slate-500">
										{formatKwh(r.usedTenths)} used by the room
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
