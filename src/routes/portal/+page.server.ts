import { db } from '#lib/server/db/index.ts';
import { tenantHome } from '#lib/server/portal.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	stays: tenantHome(db, locals.user!.id, locals.today)
});
