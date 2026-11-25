import { db } from '#lib/server/db/index.ts';
import { listTenancies } from '#lib/server/rentals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	tenancies: listTenancies(db, locals.user!.id, locals.today)
});
