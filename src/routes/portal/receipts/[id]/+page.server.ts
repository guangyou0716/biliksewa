import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { id } from '#lib/server/forms.ts';
import { tenantReceipt } from '#lib/server/portal.ts';
import { RentalError } from '#lib/server/rentals.ts';
import { translate } from '#lib/i18n.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	try {
		return { receipt: tenantReceipt(db, locals.user!.id, id(params.id)) };
	} catch (e) {
		// Same 404 for "does not exist" and "not yours", so ids cannot be probed.
		if (e instanceof RentalError) error(404, translate(locals.locale, 'err.receiptNotFound'));
		throw e;
	}
};
