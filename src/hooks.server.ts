import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, validateSession } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { todayInMalaysia } from '#lib/server/today.ts';

const PUBLIC_PATHS = new Set(['/login']);

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? validateSession(db, token) : null;
	event.locals.today = todayInMalaysia();
	if (token && !event.locals.user) event.cookies.delete(SESSION_COOKIE, { path: '/' });

	if (!event.locals.user && !PUBLIC_PATHS.has(event.url.pathname)) {
		const next = event.url.pathname + event.url.search;
		redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
