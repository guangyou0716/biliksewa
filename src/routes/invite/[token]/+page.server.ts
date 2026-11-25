import { fail, redirect } from '@sveltejs/kit';
import {
	createSession,
	deleteSession,
	MIN_PASSWORD_LENGTH,
	SESSION_COOKIE
} from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { text } from '#lib/server/forms.ts';
import { acceptInvite, inviteDetails } from '#lib/server/portal.ts';
import { inviteByAddress, minutes } from '#lib/server/rate-limit.ts';
import { RentalError } from '#lib/server/rentals.ts';
import { translate } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, getClientAddress, setHeaders }) => {
	// The token is in the URL: keep it out of caches and Referer headers.
	setHeaders({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
	const address = getClientAddress();
	if (inviteByAddress.retryAfter(address) > 0)
		return { invite: null, minPassword: MIN_PASSWORD_LENGTH };
	const invite = inviteDetails(db, params.token);
	if (!invite) inviteByAddress.fail(address);
	return { invite, minPassword: MIN_PASSWORD_LENGTH };
};

export const actions: Actions = {
	default: async ({ request, params, cookies, url, getClientAddress, locals }) => {
		const data = await request.formData();
		const email = text(data, 'email');
		const password = text(data, 'password');
		const address = getClientAddress();
		const wait = inviteByAddress.retryAfter(address);
		if (wait > 0)
			return fail(429, {
				email,
				error: translate(locals.locale, 'err.tooManyAttempts', { minutes: minutes(wait) })
			});
		if (password !== text(data, 'confirm'))
			return fail(400, { email, error: translate(locals.locale, 'err.passwordMismatch') });
		let account;
		try {
			account = await acceptInvite(db, params.token, { email, password });
		} catch (e) {
			if (e instanceof RentalError) {
				if (!inviteDetails(db, params.token)) inviteByAddress.fail(address);
				return fail(400, { email, error: e.localized(locals.locale) });
			}
			throw e;
		}
		const previous = cookies.get(SESSION_COOKIE);
		if (previous) deleteSession(db, previous);
		const { token, expiresAt } = createSession(db, account.id);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: expiresAt
		});
		redirect(303, '/portal');
	}
};
