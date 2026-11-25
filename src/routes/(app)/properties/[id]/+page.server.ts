import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { guard, id, money, text } from '#lib/server/forms.ts';
import { addBed, addRoom, propertyBoard, RentalError } from '#lib/server/rentals.ts';
import { translate } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	try {
		return { board: propertyBoard(db, locals.user!.id, id(params.id), locals.today) };
	} catch (e) {
		if (e instanceof RentalError) error(404, translate(locals.locale, 'err.propertyNotFound'));
		throw e;
	}
};

export const actions: Actions = {
	room: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			const r = addRoom(db, locals.user!.id, id(params.id), text(data, 'name'));
			return { success: translate(locals.locale, 'ok.roomAdded', { name: r.name }) };
		});
	},
	bed: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const b = addBed(db, locals.user!.id, id(text(data, 'roomId')), {
				label: text(data, 'label'),
				defaultRentSen: money(data, 'rent', 'field.rent')
			});
			return { success: translate(locals.locale, 'ok.bedAdded', { label: b.label }) };
		});
	}
};
