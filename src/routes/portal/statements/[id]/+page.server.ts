import { error } from '@sveltejs/kit';
import { monthOf } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import { id, monthParam } from '#lib/server/forms.ts';
import { tenantStatement } from '#lib/server/reports.ts';
import { RentalError } from '#lib/server/rentals.ts';
import { translate } from '#lib/i18n.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, url }) => {
	const period = monthParam(url, monthOf(locals.today));
	try {
		return { statement: tenantStatement(db, locals.user!.id, id(params.id), period) };
	} catch (e) {
		// Same 404 for "does not exist" and "not yours".
		if (e instanceof RentalError) error(404, translate(locals.locale, 'err.statementNotFound'));
		throw e;
	}
};
