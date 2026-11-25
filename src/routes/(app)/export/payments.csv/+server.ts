import { error } from '@sveltejs/kit';
import { isIsoMonth } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import { csvResponse } from '#lib/server/forms.ts';
import { paymentsCsv } from '#lib/server/reports.ts';
import type { RequestHandler } from './$types';

/** The signed-in landlord's payments as CSV, optionally for one month (?month=YYYY-MM). */
export const GET: RequestHandler = ({ locals, url }) => {
	if (locals.user?.role !== 'landlord') error(404, 'Not found');
	const period = url.searchParams.get('month') || undefined;
	if (period !== undefined && !isIsoMonth(period)) error(400, 'Month must look like 2026-11');
	return csvResponse(
		paymentsCsv(db, locals.user.id, period),
		`biliksewa-payments-${period ?? 'all'}.csv`
	);
};
