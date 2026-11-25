import { error, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { date, guard, id, money, text } from '#lib/server/forms.ts';
import { bedForMoveIn, moveIn, RentalError } from '#lib/server/rentals.ts';
import { translate, type Locale } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

function loadBed(ownerId: number, raw: string | null, locale: Locale) {
	try {
		return bedForMoveIn(db, ownerId, id(raw));
	} catch (e) {
		if (e instanceof RentalError) error(404, translate(locale, 'err.bedNotFound'));
		throw e;
	}
}

export const load: PageServerLoad = ({ locals, url }) => {
	const { bed, room, property } = loadBed(
		locals.user!.id,
		url.searchParams.get('bed'),
		locals.locale
	);
	return { bed, room, property };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const { bed } = loadBed(locals.user!.id, url.searchParams.get('bed'), locals.locale);
		const data = await request.formData();
		const result = await guard(data, () =>
			moveIn(db, locals.user!.id, {
				bedId: bed.id,
				tenantName: text(data, 'name'),
				tenantEmail: text(data, 'email'),
				startDate: date(data, 'startDate', 'field.moveInDate'),
				monthlyRentSen: money(data, 'rent', 'field.monthlyRent'),
				depositSen: money(data, 'deposit', 'field.deposit')
			})
		);
		if ('id' in result) redirect(303, `/tenancies/${result.id}`);
		return result;
	}
};
