import { error } from '@sveltejs/kit';
import { monthOf } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import { id, monthParam } from '#lib/server/forms.ts';
import { tenantStatement } from '#lib/server/reports.ts';
import { RentalError } from '#lib/server/rentals.ts';
import { statementDownload } from '#lib/server/statement-html.ts';
import type { RequestHandler } from './$types';

/** The signed-in tenant's own statement as a standalone HTML file. */
export const GET: RequestHandler = ({ locals, params, url }) => {
	if (locals.user?.role !== 'tenant') error(404, 'Not found');
	const period = monthParam(url, monthOf(locals.today));
	try {
		const s = tenantStatement(db, locals.user.id, id(params.id), period);
		return statementDownload(s, locals.today);
	} catch (e) {
		if (e instanceof RentalError) error(404, 'Not found');
		throw e;
	}
};
