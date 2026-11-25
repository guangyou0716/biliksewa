import { isLocale } from '#lib/i18n.ts';
import { db } from '#lib/server/db/index.ts';
import { overdueReminders } from '#lib/server/reports.ts';
import type { PageServerLoad } from './$types';

/** `?lang=ms` writes the reminder messages in another language than the page (the tenant's). */
export const load: PageServerLoad = ({ locals, url }) => {
	const lang = url.searchParams.get('lang');
	const messageLocale = isLocale(lang) ? lang : locals.locale;
	return {
		messageLocale,
		reminders: overdueReminders(db, locals.user!.id, locals.today, messageLocale)
	};
};
