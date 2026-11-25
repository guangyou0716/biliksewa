import { error, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { date, guard, id, money, text } from '#lib/server/forms.ts';
import { bedForMoveIn, moveIn, RentalError } from '#lib/server/rentals.ts';
import type { Actions, PageServerLoad } from './$types';

function loadBed(ownerId: number, raw: string | null) {
	try {
		return bedForMoveIn(db, ownerId, id(raw));
	} catch (e) {
		if (e instanceof RentalError) error(404, 'Bed not found');
		throw e;
	}
}

export const load: PageServerLoad = ({ locals, url }) => {
	const { bed, room, property } = loadBed(locals.user!.id, url.searchParams.get('bed'));
	return { bed, room, property };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const { bed } = loadBed(locals.user!.id, url.searchParams.get('bed'));
		const data = await request.formData();
		const result = await guard(data, () =>
			moveIn(db, locals.user!.id, {
				bedId: bed.id,
				tenantName: text(data, 'name'),
				tenantEmail: text(data, 'email'),
				startDate: date(data, 'startDate', 'Move-in date'),
				monthlyRentSen: money(data, 'rent', 'Monthly rent'),
				depositSen: money(data, 'deposit', 'Deposit')
			})
		);
		if ('id' in result) redirect(303, `/tenancies/${result.id}`);
		return result;
	}
};
