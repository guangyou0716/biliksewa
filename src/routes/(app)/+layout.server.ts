import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	// Defence in depth: hooks already keep tenant accounts inside /portal.
	if (locals.user.role !== 'landlord') redirect(303, '/portal');
	return { user: locals.user, today: locals.today };
};
