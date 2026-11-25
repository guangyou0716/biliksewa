import { describe, expect, it } from 'vitest';
import {
	addDays,
	daysInMonth,
	isIsoDate,
	isIsoMonth,
	monthRange,
	overlapNights,
	shiftMonth,
	staysOverlap
} from './dates';

describe('calendar helpers', () => {
	it('validates ISO dates including leap days', () => {
		expect(isIsoDate('2028-02-29')).toBe(true);
		expect(isIsoDate('2026-02-29')).toBe(false);
		expect(isIsoDate('2026-13-01')).toBe(false);
		expect(isIsoDate('26-01-01')).toBe(false);
		expect(isIsoMonth('2026-12')).toBe(true);
		expect(isIsoMonth('2026-00')).toBe(false);
	});

	it('knows month lengths and wraps December', () => {
		expect(daysInMonth('2026-02')).toBe(28);
		expect(daysInMonth('2028-02')).toBe(29);
		expect(daysInMonth('2026-11')).toBe(30);
		expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});
});

describe('overlapNights', () => {
	const from = '2026-10-01';
	const to = '2026-11-01';
	it('counts a full month for an open-ended stay', () => {
		expect(overlapNights('2026-01-01', null, from, to)).toBe(31);
	});
	it('counts from move-in day', () => {
		expect(overlapNights('2026-10-16', null, from, to)).toBe(16);
	});
	it('does not count the move-out day as a night', () => {
		expect(overlapNights('2026-09-01', '2026-10-10', from, to)).toBe(9);
	});
	it('is zero outside the window', () => {
		expect(overlapNights('2026-11-01', null, from, to)).toBe(0);
		expect(overlapNights('2026-08-01', '2026-10-01', from, to)).toBe(0);
	});
});

describe('staysOverlap', () => {
	it('lets a new tenant move in on the day the previous one moves out', () => {
		expect(staysOverlap('2026-01-01', '2026-10-10', '2026-10-10', null)).toBe(false);
	});
	it('detects overlap with an open-ended stay', () => {
		expect(staysOverlap('2026-01-01', null, '2026-12-01', null)).toBe(true);
		expect(staysOverlap('2026-12-01', null, '2026-01-01', '2026-12-02')).toBe(true);
	});
});

describe('shiftMonth', () => {
	it('moves across year boundaries both ways', () => {
		expect(shiftMonth('2026-11', 1)).toBe('2026-12');
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
		expect(shiftMonth('2026-03', -14)).toBe('2025-01');
		expect(shiftMonth('2026-05', 0)).toBe('2026-05');
	});
});
