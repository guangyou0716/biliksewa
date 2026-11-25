import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
	it('keeps in-app paths', () => {
		expect(safeNext('/tenancies/3?x=1')).toBe('/tenancies/3?x=1');
	});
	it.each([
		null,
		'',
		'https://evil.example',
		'//evil.example',
		'/\\evil.example',
		'javascript:alert(1)'
	])('falls back to / for %s', (next) => {
		expect(safeNext(next)).toBe('/');
	});
});
