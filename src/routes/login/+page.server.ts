import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSession, SESSION_COOKIE } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { text } from '#lib/server/forms.ts';
import { loginByAddress, loginByEmail, minutes } from '#lib/server/rate-limit.ts';
import { safeNext } from '#lib/safe-next.ts';
import { translate } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress, locals }) => {
		const data = await request.formData();
		const email = text(data, 'email');
		const address = getClientAddress();
		// Keyed by email *and* address, so nobody can lock another person out of their account.
		const emailKey = `${email.trim().toLowerCase()} ${address}`;
		const wait = Math.max(loginByEmail.retryAfter(emailKey), loginByAddress.retryAfter(address));
		if (wait > 0) {
			return fail(429, {
				email,
				error: translate(locals.locale, 'login.tooMany', { minutes: minutes(wait) })
			});
		}
		const found = await authenticate(db, email, text(data, 'password'));
		if (!found) {
			loginByEmail.fail(emailKey);
			loginByAddress.fail(address);
			return fail(400, { email, error: translate(locals.locale, 'login.wrong') });
		}
		loginByEmail.reset(emailKey);
		const { token, expiresAt } = createSession(db, found.id);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: expiresAt
		});
		const next = safeNext(url.searchParams.get('next'));
		const tenantOk = next === '/portal' || next.startsWith('/portal/');
		redirect(303, found.role === 'tenant' && !tenantOk ? '/portal' : next);
	}
};
