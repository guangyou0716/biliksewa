import { redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { guard, text } from '#lib/server/forms.ts';
import { addProperty, listProperties } from '#lib/server/rentals.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	properties: listProperties(db, locals.user!.id, locals.today)
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const result = await guard(data, () =>
			addProperty(db, locals.user!.id, { name: text(data, 'name'), area: text(data, 'area') })
		);
		if ('id' in result) redirect(303, `/properties/${result.id}`);
		return result;
	}
};
