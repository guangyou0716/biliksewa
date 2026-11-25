import { formatRM } from '../money';
import { DEFAULT_LOCALE, HTML_LANG, translator, type Locale } from '../i18n';
import type { MonthlyStatement } from './reports';

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/**
 * A monthly statement as one self-contained HTML file (inline styles, no scripts, no external
 * requests) for the download button. It opens offline in any browser and prints to PDF from there,
 * and needs no PDF library, so it works the same on Node and in the Cloudflare Worker demo.
 * Labels follow the viewer's language; stored data (names, descriptions) is shown as entered.
 */
export function statementHtml(
	s: MonthlyStatement,
	generatedOn: string,
	locale: Locale = DEFAULT_LOCALE
): string {
	const t = translator(locale);
	const e = escapeHtml;
	const rm = (sen: number) => e(formatRM(sen));
	const st = s.stay;
	const rows = s.lines
		.map(
			(l) =>
				`<tr><td>${e(l.date)}</td><td>${e(l.description)}</td>` +
				`<td class="n">${l.chargeSen ? rm(l.chargeSen) : ''}</td>` +
				`<td class="n">${l.paymentSen ? rm(l.paymentSen) : ''}</td>` +
				`<td class="n">${rm(l.balanceSen)}</td></tr>`
		)
		.join('\n');
	return `<!doctype html>
<html lang="${HTML_LANG[locale]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(t('statement.pageTitle', { period: s.period }))} - ${e(st.tenantName)}</title>
<style>
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;max-width:760px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.4rem;margin:0}.muted{color:#64748b;font-size:.85rem}
dl{display:grid;grid-template-columns:auto 1fr;gap:.25rem 1.5rem;font-size:.9rem;margin:1.25rem 0}dt{color:#64748b}dd{margin:0}
table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:1rem}th,td{padding:.4rem .5rem;border-bottom:1px solid #e2e8f0;text-align:left}
th{font-size:.75rem;text-transform:uppercase;color:#64748b}.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tfoot td{font-weight:600}
</style>
</head>
<body>
<h1>${e(t('statement.title', { period: s.period }))}</h1>
<p class="muted">biliksewa · ${e(t('statement.generated', { date: generatedOn }))}</p>
<dl>
<dt>${e(t('common.tenant'))}</dt><dd>${e(st.tenantName)}</dd>
<dt>${e(t('statement.bedLabel'))}</dt><dd>${e(st.propertyName)}, ${e(st.propertyArea)} · ${e(st.roomName)} · ${e(t('common.bed', { label: st.bedLabel }))}</dd>
<dt>${e(t('common.landlord'))}</dt><dd>${e(st.landlordName)}</dd>
<dt>${e(t('statement.monthlyRent'))}</dt><dd>${rm(st.tenancy.monthlyRentSen)}</dd>
</dl>
<table>
<thead><tr><th>${e(t('col.date'))}</th><th>${e(t('col.description'))}</th><th class="n">${e(t('col.charge'))}</th><th class="n">${e(t('col.payment'))}</th><th class="n">${e(t('col.balance'))}</th></tr></thead>
<tbody>
<tr><td></td><td>${e(t('statement.brought'))}</td><td></td><td></td><td class="n">${rm(s.openingSen)}</td></tr>
${rows}
</tbody>
<tfoot><tr><td></td><td>${e(t('statement.carried'))}</td><td class="n">${rm(s.chargesSen)}</td><td class="n">${rm(s.paymentsSen)}</td><td class="n">${rm(s.closingSen)}</td></tr></tfoot>
</table>
<p class="muted">${e(t('statement.note'))}</p>
</body>
</html>
`;
}

/** Download file name; uses ids only, so no personal data ends up in file names or URLs. */
export function statementFileName(s: MonthlyStatement): string {
	return `biliksewa-statement-${s.stay.tenancy.id}-${s.period}.html`;
}

/** The download response: an attachment that is never cached and cannot run anything if opened inline. */
export function statementDownload(
	s: MonthlyStatement,
	generatedOn: string,
	locale: Locale = DEFAULT_LOCALE
): Response {
	return new Response(statementHtml(s, generatedOn, locale), {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'content-disposition': `attachment; filename="${statementFileName(s)}"`,
			'cache-control': 'private, no-store',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
		}
	});
}
