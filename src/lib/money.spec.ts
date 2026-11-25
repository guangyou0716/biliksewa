import { describe, expect, it } from 'vitest';
import { formatRM, parseRM } from './money';

describe('parseRM', () => {
	it.each([
		['450', 45000],
		['450.5', 45050],
		['450.05', 45005],
		['RM 1,200.00', 120000],
		['rm12', 1200],
		[' 0.01 ', 1]
	])('parses %s', (input, sen) => {
		expect(parseRM(input)).toBe(sen);
	});

	it.each(['', 'abc', '-5', '1.234', '1e3', '12.'])('rejects %s', (input) => {
		expect(parseRM(input)).toBeNull();
	});
});

describe('formatRM', () => {
	it('formats sen with thousands separators', () => {
		expect(formatRM(120050)).toBe('RM 1,200.50');
		expect(formatRM(5)).toBe('RM 0.05');
		expect(formatRM(-2500)).toBe('-RM 25.00');
	});

	it('round-trips with parseRM', () => {
		for (const sen of [0, 1, 99, 100, 123456, 9999999]) expect(parseRM(formatRM(sen))).toBe(sen);
	});
});
