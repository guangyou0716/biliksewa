import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { id } from '#lib/server/forms.ts';
import { photoHeaders, tenantPhoto } from '#lib/server/meter.ts';
import type { RequestHandler } from './$types';

/** A meter photo the signed-in tenant sent themselves; anything else is a 404. */
export const GET: RequestHandler = ({ locals, params }) => {
	if (locals.user?.role !== 'tenant') error(404, 'Not found');
	const photo = tenantPhoto(db, locals.user.id, id(params.id));
	if (!photo) error(404, 'Not found');
	return new Response(photo.bytes, { headers: photoHeaders(photo.type) });
};
