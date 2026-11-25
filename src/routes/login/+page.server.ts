import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSession, SESSION_COOKIE } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

/** Only allow redirects back into this app. */
function safeNext(next: string | null): string {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = text(data, 'email');
		const password = text(data, 'password');
		const found = await authenticate(db, email, password);
		if (!found) return fail(400, { email, error: 'Wrong email or password' });
		const { token, expiresAt } = createSession(db, found.id);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: expiresAt
		});
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
