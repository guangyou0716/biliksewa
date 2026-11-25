import { describe, expect, it } from 'vitest';
import { allocatePayments, overdueSen, proratedRent, splitByNights } from './billing';

describe('proratedRent', () => {
	it('bills the exact monthly rent for a full month', () => {
		expect(proratedRent(45000, '2026-02', '2025-12-15', null)).toBe(45000);
	});
	it('pro-rates a mid-month move-in by nights (16 of 31 nights)', () => {
		// 38000 * 16 / 31 = 19612.9 -> 19613
		expect(proratedRent(38000, '2026-10', '2026-10-16', null)).toBe(19613);
	});
	it('pro-rates a mid-month move-out (9 of 31 nights)', () => {
		// 30000 * 9 / 31 = 8709.7 -> 8710
		expect(proratedRent(30000, '2026-10', '2026-01-01', '2026-10-10')).toBe(8710);
	});
	it('rounds half up', () => {
		// 1 sen * 15 / 30 = 0.5 -> 1
		expect(proratedRent(1, '2026-11', '2026-11-16', null)).toBe(1);
	});
	it('is zero when the stay misses the month', () => {
		expect(proratedRent(30000, '2026-10', '2026-11-01', null)).toBe(0);
	});
});

describe('splitByNights', () => {
	it('splits a TNB bill by nights so shares add up to the sen', () => {
		// 28745 over 31 + 31 + 16 = 78 nights. Floors 11424 + 11424 + 5896 = 28744;
		// remainders 23, 23, 32 (out of 78) -> the last sen goes to the 16-night stay.
		const shares = splitByNights(28745, [
			{ id: 1, nights: 31 },
			{ id: 2, nights: 31 },
			{ id: 3, nights: 16 }
		]);
		expect(shares.map((s) => s.amountSen)).toEqual([11424, 11424, 5897]);
	});

	it('omits people who did not stay and rejects an empty house', () => {
		expect(
			splitByNights(1000, [
				{ id: 1, nights: 0 },
				{ id: 2, nights: 5 }
			])
		).toEqual([{ id: 2, nights: 5, amountSen: 1000 }]);
		expect(() => splitByNights(1000, [{ id: 1, nights: 0 }])).toThrow(/Nobody stayed/);
		expect(() => splitByNights(10.5, [{ id: 1, nights: 1 }])).toThrow(/whole sen/);
	});

	it('breaks remainder ties deterministically by lower id', () => {
		const shares = splitByNights(100, [
			{ id: 9, nights: 1 },
			{ id: 3, nights: 1 },
			{ id: 5, nights: 1 }
		]);
		expect(shares).toEqual([
			{ id: 9, nights: 1, amountSen: 33 },
			{ id: 3, nights: 1, amountSen: 34 },
			{ id: 5, nights: 1, amountSen: 33 }
		]);
	});

	it('invariant: shares always sum to the bill and differ from the exact share by < 1 sen', () => {
		let seed = 42;
		const rand = (n: number) => {
			seed = (seed * 1103515245 + 12345) % 2 ** 31;
			return seed % n;
		};
		for (let round = 0; round < 500; round++) {
			const total = rand(1_000_000);
			const stays = Array.from({ length: 1 + rand(8) }, (_, i) => ({
				id: i + 1,
				nights: rand(32)
			}));
			const nights = stays.reduce((s, x) => s + x.nights, 0);
			if (nights === 0) continue;
			const shares = splitByNights(total, stays);
			expect(shares.reduce((s, x) => s + x.amountSen, 0)).toBe(total);
			for (const s of shares) {
				expect(Math.abs(s.amountSen - (total * s.nights) / nights)).toBeLessThan(1);
			}
		}
	});
});

describe('allocatePayments / overdueSen', () => {
	const charges = [
		{ id: 2, amountSen: 38000, dueDate: '2026-10-07' },
		{ id: 1, amountSen: 38000, dueDate: '2026-09-07' },
		{ id: 3, amountSen: 11424, dueDate: '2026-11-07' }
	];

	it('pays the oldest charge first', () => {
		expect(allocatePayments(charges, 50000)).toEqual([
			{ id: 1, unpaidSen: 0, dueDate: '2026-09-07' },
			{ id: 2, unpaidSen: 26000, dueDate: '2026-10-07' },
			{ id: 3, unpaidSen: 11424, dueDate: '2026-11-07' }
		]);
	});

	it('only counts unpaid charges already past due', () => {
		expect(overdueSen(charges, 50000, '2026-11-01')).toBe(26000);
		expect(overdueSen(charges, 50000, '2026-11-08')).toBe(37424);
		expect(overdueSen(charges, 87424, '2026-12-01')).toBe(0);
	});

	it('a charge due today is not overdue yet', () => {
		expect(overdueSen(charges, 0, '2026-09-07')).toBe(0);
	});
});
