import { error, fail } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { isIsoDate, isIsoMonth } from '../dates';
import { DEFAULT_LOCALE, isLocale, type Locale, type MessageKey } from '../i18n';
import { parseRM } from '../money';
import { UserError } from './errors';

/** A form field that could not be read (bad amount, date, method...). */
export class FormError extends UserError {}

export function text(data: FormData, key: string): string {
	const v = data.get(key);
	return typeof v === 'string' ? v : '';
}

/** `label` names the field in error messages ("Amount: enter an amount like 450"). */
export function money(data: FormData, key: string, label: MessageKey): number {
	const sen = parseRM(text(data, key));
	if (sen === null) throw new FormError('err.amount', {}, label);
	return sen;
}

export function date(data: FormData, key: string, label: MessageKey): string {
	const v = text(data, key);
	if (!isIsoDate(v)) throw new FormError('err.date', {}, label);
	return v;
}

export function month(data: FormData, key: string): string {
	const v = text(data, key);
	if (!isIsoMonth(v)) throw new FormError('err.month');
	return v;
}

/**
 * The `?month=YYYY-MM` query parameter, or `fallback` when it is missing. A malformed month is a 400
 * rather than a silent fallback, so a bookmarked statement link never shows the wrong month.
 */
export function monthParam(url: URL, fallback: string): string {
	const v = url.searchParams.get('month');
	if (v === null || v === '') return fallback;
	if (!isIsoMonth(v)) error(400, 'Month must look like 2026-11');
	return v;
}

export function id(value: string | null | undefined): number {
	const n = Number(value);
	if (!Number.isSafeInteger(n) || n <= 0) error(404, 'Not found');
	return n;
}

/** The submitted text fields, so a page can show them again. */
export function values(data: FormData): Record<string, string> {
	return Object.fromEntries([...data].filter(([, v]) => typeof v === 'string')) as Record<
		string,
		string
	>;
}

/** The UI language of the request being handled (English outside a request, e.g. in unit tests). */
export function requestLocale(): Locale {
	try {
		const locale = getRequestEvent().locals.locale;
		return isLocale(locale) ? locale : DEFAULT_LOCALE;
	} catch {
		return DEFAULT_LOCALE;
	}
}

/**
 * Runs a form action body, turning validation errors into a 400 with the message (in the visitor's
 * language) and the submitted values.
 */
export async function guard<T>(data: FormData, run: () => T | Promise<T>) {
	try {
		return await run();
	} catch (e) {
		if (e instanceof UserError) {
			return fail(400, {
				error: e.localized(requestLocale()),
				values: Object.fromEntries([...data].filter(([, v]) => typeof v === 'string')) as Record<
					string,
					string
				>
			});
		}
		throw e;
	}
}

/** A CSV download that is never cached. */
export function csvResponse(body: string, fileName: string): Response {
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${fileName}"`,
			'cache-control': 'private, no-store'
		}
	});
}
