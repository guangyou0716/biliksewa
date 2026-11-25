import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	if (locals.user.role !== 'tenant') redirect(303, '/');
	return { user: locals.user, today: locals.today };
};
