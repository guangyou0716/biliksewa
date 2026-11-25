import { db } from '#lib/server/db/index.ts';
import { overdueReminders } from '#lib/server/reports.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	reminders: overdueReminders(db, locals.user!.id, locals.today)
});
