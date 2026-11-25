import { error } from '@sveltejs/kit';
import { monthOf } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import { id, monthParam } from '#lib/server/forms.ts';
import { landlordStatement } from '#lib/server/reports.ts';
import { RentalError } from '#lib/server/rentals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, url }) => {
	const period = monthParam(url, monthOf(locals.today));
	try {
		return { statement: landlordStatement(db, locals.user!.id, id(params.id), period) };
	} catch (e) {
		if (e instanceof RentalError) error(404, 'Tenancy not found');
		throw e;
	}
};
