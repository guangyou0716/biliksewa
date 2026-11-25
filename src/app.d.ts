// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '#lib/server/auth.ts';
import type { Locale } from '#lib/i18n.ts';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			/** Today's date in Malaysia (`YYYY-MM-DD`). */
			today: string;
			/** UI language from the `bs_locale` cookie or Accept-Language. */
			locale: Locale;
		}
		interface PageData {
			locale: Locale;
		}
	}
}

export {};
