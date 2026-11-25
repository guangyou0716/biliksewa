/**
 * CSV for spreadsheets (RFC 4180: comma separated, CRLF line ends, double-quoted when needed).
 *
 * Formula injection guard: a text cell starting with `=`, `+`, `-`, `@`, tab or carriage return could be
 * run as a formula by Excel, LibreOffice or Google Sheets (e.g. a tenant named `=HYPERLINK(...)`), so it
 * is prefixed with `'` and shown as plain text. Leading spaces before those characters and the
 * full-width forms `＝＋－＠` (which some spreadsheet apps also accept) are caught too. Plain numbers such
 * as `-12.50` are left alone: they cannot be formulas and stay usable as numbers.
 */

const FORMULA_START = /^[\t\r]|^\s*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue): string {
	if (value === null || value === undefined) return '';
	let s = typeof value === 'number' ? String(value) : value;
	if (typeof value === 'string' && FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A whole CSV file. Starts with a UTF-8 byte order mark so Excel reads names like "Siti Nur 'Ain" right. */
export function toCsv(header: string[], rows: CsvValue[][]): string {
	const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
	return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/** Integer sen as a plain decimal string for spreadsheets: 45050 -> "450.50", -5 -> "-0.05". */
export function senToDecimal(sen: number): string {
	if (!Number.isSafeInteger(sen)) throw new Error('Amount must be whole sen');
	const abs = Math.abs(sen);
	return `${sen < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
