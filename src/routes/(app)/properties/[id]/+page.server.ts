import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { guard, id, money, text } from '#lib/server/forms.ts';
import { addBed, addRoom, propertyBoard, RentalError } from '#lib/server/rentals.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	try {
		return { board: propertyBoard(db, locals.user!.id, id(params.id), locals.today) };
	} catch (e) {
		if (e instanceof RentalError) error(404, 'Property not found');
		throw e;
	}
};

export const actions: Actions = {
	room: async ({ request, locals, params }) => {
		const data = await request.formData();
		return guard(data, () => {
			const r = addRoom(db, locals.user!.id, id(params.id), text(data, 'name'));
			return { success: `Added ${r.name}` };
		});
	},
	bed: async ({ request, locals }) => {
		const data = await request.formData();
		return guard(data, () => {
			const b = addBed(db, locals.user!.id, id(text(data, 'roomId')), {
				label: text(data, 'label'),
				defaultRentSen: money(data, 'rent', 'Rent')
			});
			return { success: `Added bed ${b.label}` };
		});
	}
};
