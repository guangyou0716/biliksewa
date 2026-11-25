import { describe, expect, it } from 'vitest';
import { AttemptLimiter, minutes } from './rate-limit';

describe('AttemptLimiter', () => {
	const t0 = Date.UTC(2026, 10, 25, 12);

	it('blocks a key after max failures until the window ends', () => {
		const l = new AttemptLimiter(3, 60_000);
		for (let i = 0; i < 2; i++) l.fail('a', t0);
		expect(l.retryAfter('a', t0)).toBe(0);
		l.fail('a', t0 + 1000);
		expect(l.retryAfter('a', t0 + 1000)).toBe(59_000);
		expect(l.retryAfter('b', t0 + 1000)).toBe(0);
		expect(l.retryAfter('a', t0 + 60_000)).toBe(0);
	});

	it('starts a new window after the old one expires', () => {
		const l = new AttemptLimiter(2, 60_000);
		l.fail('a', t0);
		l.fail('a', t0 + 60_000);
		expect(l.retryAfter('a', t0 + 60_000)).toBe(0);
		l.fail('a', t0 + 61_000);
		expect(l.retryAfter('a', t0 + 61_000)).toBe(59_000);
	});

	it('reset clears a key (successful sign-in)', () => {
		const l = new AttemptLimiter(1, 60_000);
		l.fail('a', t0);
		expect(l.retryAfter('a', t0)).toBeGreaterThan(0);
		l.reset('a');
		expect(l.retryAfter('a', t0)).toBe(0);
	});

	it('never keeps more than maxKeys entries', () => {
		const l = new AttemptLimiter(1, 60_000, 3);
		for (const k of ['a', 'b', 'c', 'd', 'e']) l.fail(k, t0);
		expect(l.retryAfter('a', t0)).toBe(0);
		expect(l.retryAfter('b', t0)).toBe(0);
		expect(l.retryAfter('e', t0)).toBeGreaterThan(0);
	});
});

describe('minutes', () => {
	it('rounds up and never says 0', () => {
		expect(minutes(1)).toBe(1);
		expect(minutes(60_001)).toBe(2);
	});
});
