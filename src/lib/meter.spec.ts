import { describe, expect, it } from 'vitest';
import { formatKwh, formatRate, meterChargeSen, parseKwh, parseRate, rateInput } from './meter';

describe('parseKwh', () => {
	it('reads whole and one-decimal kWh into tenths', () => {
		expect(parseKwh('1234')).toBe(12340);
		expect(parseKwh(' 1,234.5 ')).toBe(12345);
		expect(parseKwh('0')).toBe(0);
	});
	it('rejects anything else', () => {
		for (const bad of ['', '-1', '12.34', 'abc', '1e3', '12345678'])
			expect(parseKwh(bad)).toBeNull();
	});
});

describe('parseRate', () => {
	it('reads RM per kWh with up to 4 decimals into sen x 100', () => {
		expect(parseRate('0.55')).toBe(5500);
		expect(parseRate('RM 0.2180')).toBe(2180);
		expect(parseRate('0.5/kWh')).toBe(5000);
		expect(parseRate('5')).toBe(50000);
	});
	it('rejects zero, too many decimals and absurd rates', () => {
		for (const bad of ['0', '0.0000', '0.12345', '5.0001', '12', 'x', ''])
			expect(parseRate(bad)).toBeNull();
	});
});

describe('formatting', () => {
	it('formats kWh and rates', () => {
		expect(formatKwh(12345)).toBe('1234.5 kWh');
		expect(formatRate(5500)).toBe('RM 0.55/kWh');
		expect(formatRate(2180)).toBe('RM 0.218/kWh');
		expect(formatRate(2185)).toBe('RM 0.2185/kWh');
		expect(rateInput(2000)).toBe('0.20');
	});
});

describe('meterChargeSen', () => {
	it('bills used kWh at the rate, rounded half up to the sen', () => {
		// 195.5 kWh x RM 0.55 = RM 107.525 -> RM 107.53
		expect(meterChargeSen(1955, 5500)).toBe(10753);
		// 210 kWh x RM 0.55 = RM 115.50 exactly
		expect(meterChargeSen(2100, 5500)).toBe(11550);
		// 0.1 kWh x RM 0.2180 = 2.18 sen -> 2 sen; 0.3 kWh -> 6.54 -> 7
		expect(meterChargeSen(1, 2180)).toBe(2);
		expect(meterChargeSen(3, 2180)).toBe(7);
		expect(meterChargeSen(0, 5500)).toBe(0);
	});
	it('refuses non-integer or negative input', () => {
		expect(() => meterChargeSen(-1, 5500)).toThrow();
		expect(() => meterChargeSen(1.5, 5500)).toThrow();
	});
});
