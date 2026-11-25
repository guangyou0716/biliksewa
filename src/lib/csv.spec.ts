import { describe, expect, it } from 'vitest';
import { csvCell, senToDecimal, toCsv } from './csv';

describe('csvCell formula injection guard', () => {
	it.each(['=1+1', '+60123', '-cmd', '@SUM(A1)', '\tTab', '\rCR', '=HYPERLINK("http://x","y")'])(
		'prefixes %j with a quote so spreadsheets show it as text',
		(v) => {
			const out = csvCell(v);
			expect(out.replace(/^"/, '').startsWith("'")).toBe(true);
		}
	);

	it('quotes and escapes cells with commas, quotes and line breaks', () => {
		expect(csvCell('Rumah Mawar, Room 1')).toBe('"Rumah Mawar, Room 1"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell('a\nb')).toBe('"a\nb"');
		// A guarded cell that also needs quoting keeps both protections.
		expect(csvCell('=A1,"x"')).toBe(`"'=A1,""x"""`);
		expect(csvCell('\rhi')).toBe(`"'\rhi"`);
	});

	it('leaves plain text, plain numbers and empty values alone', () => {
		expect(csvCell('Aina Sofea')).toBe('Aina Sofea');
		expect(csvCell('-12.50')).toBe('-12.50');
		expect(csvCell('450')).toBe('450');
		expect(csvCell(-5)).toBe('-5');
		expect(csvCell(null)).toBe('');
		expect(csvCell(undefined)).toBe('');
		expect(csvCell('')).toBe('');
	});
});

describe('toCsv', () => {
	it('writes a BOM, a header and CRLF rows', () => {
		expect(
			toCsv(
				['a', 'b'],
				[
					['x', 1],
					['=y', null]
				]
			)
		).toBe("\uFEFFa,b\r\nx,1\r\n'=y,\r\n");
	});
});

describe('senToDecimal', () => {
	it('formats integer sen exactly, without floating point', () => {
		expect(senToDecimal(45050)).toBe('450.50');
		expect(senToDecimal(5)).toBe('0.05');
		expect(senToDecimal(0)).toBe('0.00');
		expect(senToDecimal(-5)).toBe('-0.05');
		expect(senToDecimal(123456789)).toBe('1234567.89');
	});

	it('rejects fractions of a sen', () => {
		expect(() => senToDecimal(1.5)).toThrow();
	});
});
