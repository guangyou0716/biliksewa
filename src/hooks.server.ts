import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, validateSession } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { todayInMalaysia } from '#lib/server/today.ts';
import { HTML_LANG, LOCALE_COOKIE, pickLocale } from '#lib/i18n.ts';

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

/** Pages anyone can open without signing in. */
const isPublic = (path: string) =>
	path === '/login' || path === '/locale' || path.startsWith('/invite/');

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const user = token ? validateSession(db, token) : null;
	event.locals.user = user;
	event.locals.today = todayInMalaysia();
	event.locals.locale = pickLocale(
		event.cookies.get(LOCALE_COOKIE),
		event.request.headers.get('accept-language')
	);
	if (token && !user) event.cookies.delete(SESSION_COOKIE, { path: '/' });

	const path = event.url.pathname;
	if (!user && !isPublic(path)) {
		redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	}
	// Tenants only ever see their own portal; landlords never see it.
	if (user?.role === 'tenant' && !under(path, '/portal') && path !== '/logout' && !isPublic(path))
		redirect(303, '/portal');
	if (user?.role === 'landlord' && under(path, '/portal')) redirect(303, '/');

	const lang = HTML_LANG[event.locals.locale];
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	// Pages may ask for a stricter policy (the invite page uses no-referrer).
	if (!response.headers.has('Referrer-Policy'))
		response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
