import { db } from '#lib/server/db/index.ts';
import { dashboard } from '#lib/server/rentals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	summary: dashboard(db, locals.user!.id, locals.today)
});
