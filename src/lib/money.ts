/** Money is always integer sen (RM 1 = 100 sen) to avoid floating point drift. */

const formatter = new Intl.NumberFormat('en-MY', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export function formatRM(sen: number): string {
	const sign = sen < 0 ? '-' : '';
	return `${sign}RM ${formatter.format(Math.abs(sen) / 100)}`;
}

/** Parses user input such as "450", "450.5", "RM 1,200.00" into sen. Returns null when invalid. */
export function parseRM(input: string): number | null {
	const cleaned = input
		.trim()
		.replace(/^RM\s*/i, '')
		.replace(/,/g, '');
	if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
	const [whole, frac = ''] = cleaned.split('.');
	return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
