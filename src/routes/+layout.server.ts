import type { LayoutServerLoad } from './$types';

/** Every page gets the UI language; `t()` in components reads it from `page.data`. */
export const load: LayoutServerLoad = ({ locals }) => ({ locale: locals.locale });
