import { db } from '#lib/server/db/index.ts';
import { FormError, date, guard, id, text } from '#lib/server/forms.ts';
import { formatKwh, parseKwh } from '#lib/meter.ts';
import { readPhoto, submitReading, tenantMeter } from '#lib/server/meter.ts';
import { tenantHome } from '#lib/server/portal.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	stays: tenantHome(db, locals.user!.id, locals.today).map((s) => ({
		...s,
		meter: tenantMeter(db, locals.user!.id, s.tenancy.id)
	}))
});

export const actions: Actions = {
	reading: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, async () => {
			const tenths = parseKwh(text(data, 'reading'));
			if (tenths === null) throw new FormError('Reading: enter the kWh on the meter, like 1234.5');
			const file = data.get('photo');
			const r = submitReading(
				db,
				locals.user!.id,
				id(text(data, 'tenancyId')),
				{
					readOn: date(data, 'readOn', 'Read on'),
					readingTenths: tenths,
					photo: await readPhoto(file instanceof File ? file : null)
				},
				locals.today
			);
			return { success: `Reading of ${formatKwh(r.readingTenths)} sent to your landlord` };
		});
	}
};
