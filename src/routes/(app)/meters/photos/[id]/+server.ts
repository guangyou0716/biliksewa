import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { id } from '#lib/server/forms.ts';
import { landlordPhoto, photoHeaders } from '#lib/server/meter.ts';
import type { RequestHandler } from './$types';

/** A meter photo from one of the signed-in landlord's rooms (hooks already require sign-in). */
export const GET: RequestHandler = ({ locals, params }) => {
	if (locals.user?.role !== 'landlord') error(404, 'Not found');
	const photo = landlordPhoto(db, locals.user.id, id(params.id));
	if (!photo) error(404, 'Not found');
	return new Response(photo.bytes, { headers: photoHeaders(photo.type) });
};
