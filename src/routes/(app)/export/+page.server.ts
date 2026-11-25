import { monthOf } from '#lib/dates.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({ month: monthOf(locals.today) });
