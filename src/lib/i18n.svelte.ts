import { page } from '$app/state';
import {
	DEFAULT_LOCALE,
	isLocale,
	translate,
	type Locale,
	type MessageKey,
	type Params
} from './i18n';

/** The current page's UI language (set by the root layout from the cookie or Accept-Language). */
export function currentLocale(): Locale {
	const locale = page.data?.locale;
	return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** Translate in the current page's language. Reactive when used in markup or `$derived`. */
export function t(key: MessageKey, params?: Params): string {
	return translate(currentLocale(), key, params);
}
