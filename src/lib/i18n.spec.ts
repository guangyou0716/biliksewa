import { describe, expect, it } from 'vitest';
import {
	dayCount,
	DEFAULT_LOCALE,
	HTML_LANG,
	isLocale,
	LOCALE_NAMES,
	LOCALES,
	MESSAGES,
	methodKey,
	pickLocale,
	translate,
	translator,
	type MessageKey
} from './i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const englishKeys = Object.keys(MESSAGES.en).sort() as MessageKey[];

describe('message catalogue coverage', () => {
	it.each(LOCALES)('%s has exactly the English keys, none empty', (locale) => {
		const keys = Object.keys(MESSAGES[locale]).sort();
		expect(keys).toEqual(englishKeys);
		for (const key of englishKeys) expect(MESSAGES[locale][key].trim(), key).not.toBe('');
	});

	it.each(LOCALES)('%s uses the same placeholders as English in every message', (locale) => {
		for (const key of englishKeys)
			expect(placeholders(MESSAGES[locale][key]), `${locale} ${key}`).toEqual(
				placeholders(MESSAGES.en[key])
			);
	});

	it('BM and Chinese are actually translated, not copies of English', () => {
		for (const locale of ['ms', 'zh'] as const) {
			const same = englishKeys.filter((k) => MESSAGES[locale][k] === MESSAGES.en[k]);
			// A few words are the same in BM (e.g. "Meter", "Status"); everything else must differ.
			expect(same.length, `${locale}: ${same.join(', ')}`).toBeLessThanOrEqual(4);
		}
		expect(MESSAGES.zh['reminder.closing']).toMatch(/[\u4e00-\u9fff]/);
	});

	it('every locale has a picker name and an html lang', () => {
		for (const locale of LOCALES) {
			expect(LOCALE_NAMES[locale]).toBeTruthy();
			expect(HTML_LANG[locale]).toMatch(/^[a-z]{2}(-[A-Za-z]+)?$/);
		}
	});
});

describe('translate', () => {
	it('fills placeholders and leaves unknown ones as they are', () => {
		expect(translate('en', 'portal.hi', { name: 'Aina' })).toBe('Hi, Aina');
		expect(translate('ms', 'portal.hi', { name: 'Aina' })).toBe('Hai, Aina');
		expect(translate('zh', 'portal.hi', { name: 'Aina' })).toBe('您好，Aina');
		expect(translate('en', 'portal.hi')).toBe('Hi, {name}');
		expect(translate('en', 'portal.hi', { other: 'x' })).toBe('Hi, {name}');
	});

	it('does not read inherited properties as parameters or interpret $ patterns', () => {
		expect(translate('en', 'portal.hi', { name: '$& $1 $$' })).toBe('Hi, $& $1 $$');
		const params = Object.create({ name: 'inherited' }) as Record<string, string>;
		expect(translate('en', 'portal.hi', params)).toBe('Hi, {name}');
	});

	it('counts days with the right word', () => {
		const en = translator('en');
		expect(dayCount(en, 1)).toBe('1 day');
		expect(dayCount(en, 0)).toBe('0 days');
		expect(dayCount(en, 50)).toBe('50 days');
		expect(dayCount(translator('ms'), 1)).toBe('1 hari');
		expect(dayCount(translator('zh'), 3)).toBe('3 天');
	});

	it('maps stored payment methods to labels, unknown ones to Other', () => {
		expect(translate('ms', methodKey('bank_transfer'))).toBe('Pindahan bank');
		expect(translate('zh', methodKey('deposit'))).toBe('从押金扣除');
		expect(methodKey('toString')).toBe('method.other');
		expect(methodKey('weird')).toBe('method.other');
	});
});

describe('pickLocale', () => {
	it('prefers a valid cookie over the browser language', () => {
		expect(pickLocale('zh', 'ms-MY,ms;q=0.9')).toBe('zh');
		expect(pickLocale('ms', null)).toBe('ms');
	});

	it('ignores an invalid cookie and falls back to Accept-Language', () => {
		expect(pickLocale('fr', 'zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh');
		expect(pickLocale('constructor', 'ms')).toBe('ms');
	});

	it('honours q-values and order, skipping unsupported languages', () => {
		expect(pickLocale(undefined, 'fr-FR,fr;q=0.9,ms;q=0.8,en;q=0.7')).toBe('ms');
		expect(pickLocale(undefined, 'en;q=0.5,zh-TW;q=0.8')).toBe('zh');
		expect(pickLocale(undefined, 'ms;q=0,en-GB')).toBe('en');
		expect(pickLocale(undefined, 'EN-us')).toBe('en');
	});

	it('defaults to English for missing or junk headers', () => {
		expect(pickLocale(undefined, null)).toBe(DEFAULT_LOCALE);
		expect(pickLocale(undefined, '')).toBe('en');
		expect(pickLocale(undefined, 'fr, de;q=abc, ;;;')).toBe('en');
		expect(pickLocale(undefined, 'x,'.repeat(5000) + 'zh')).toBe('en');
	});

	it('isLocale accepts only supported codes', () => {
		expect(LOCALES.every(isLocale)).toBe(true);
		for (const v of ['', 'EN', 'zh-CN', 'toString', null, 1]) expect(isLocale(v)).toBe(false);
	});
});
