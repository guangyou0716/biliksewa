import { error, redirect } from '@sveltejs/kit';
import { isLocale, LOCALE_COOKIE } from '#lib/i18n.ts';
import { safeNext } from '#lib/safe-next.ts';
import type { RequestHandler } from './$types';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The language picker posts here (a plain form, so it works without JavaScript). The choice is kept
 * in a cookie for a year, then the visitor goes back to the page they were on. SvelteKit's
 * same-origin check for form posts stops other sites from changing it.
 */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const data = await request.formData();
	const locale = data.get('locale');
	if (!isLocale(locale)) error(400, 'Unknown language');
	cookies.set(LOCALE_COOKIE, locale, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: ONE_YEAR
	});
	const next = data.get('next');
	redirect(303, safeNext(typeof next === 'string' ? next : null));
};
