import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { id } from '#lib/server/forms.ts';
import { landlordReceipt } from '#lib/server/reports.ts';
import { RentalError } from '#lib/server/rentals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	try {
		return { receipt: landlordReceipt(db, locals.user!.id, id(params.id)) };
	} catch (e) {
		// Same 404 for "does not exist" and "another landlord's", so ids cannot be probed.
		if (e instanceof RentalError) error(404, 'Receipt not found');
		throw e;
	}
};
