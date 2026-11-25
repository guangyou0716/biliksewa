import { formatRM } from '../money';
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
 */
export function statementHtml(s: MonthlyStatement, generatedOn: string): string {
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
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statement ${e(s.period)} - ${e(st.tenantName)}</title>
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
<h1>Monthly statement ${e(s.period)}</h1>
<p class="muted">biliksewa · generated ${e(generatedOn)}</p>
<dl>
<dt>Tenant</dt><dd>${e(st.tenantName)}</dd>
<dt>Bed</dt><dd>${e(st.propertyName)}, ${e(st.propertyArea)} · ${e(st.roomName)} · Bed ${e(st.bedLabel)}</dd>
<dt>Landlord</dt><dd>${e(st.landlordName)}</dd>
<dt>Monthly rent</dt><dd>${rm(st.tenancy.monthlyRentSen)}</dd>
</dl>
<table>
<thead><tr><th>Date</th><th>Description</th><th class="n">Charge</th><th class="n">Payment</th><th class="n">Balance</th></tr></thead>
<tbody>
<tr><td></td><td>Balance brought forward</td><td></td><td></td><td class="n">${rm(s.openingSen)}</td></tr>
${rows}
</tbody>
<tfoot><tr><td></td><td>Balance carried forward</td><td class="n">${rm(s.chargesSen)}</td><td class="n">${rm(s.paymentsSen)}</td><td class="n">${rm(s.closingSen)}</td></tr></tfoot>
</table>
<p class="muted">A negative balance is credit in the tenant's favour. This statement is not a tax invoice.</p>
</body>
</html>
`;
}

/** Download file name; uses ids only, so no personal data ends up in file names or URLs. */
export function statementFileName(s: MonthlyStatement): string {
	return `biliksewa-statement-${s.stay.tenancy.id}-${s.period}.html`;
}

/** The download response: an attachment that is never cached and cannot run anything if opened inline. */
export function statementDownload(s: MonthlyStatement, generatedOn: string): Response {
	return new Response(statementHtml(s, generatedOn), {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'content-disposition': `attachment; filename="${statementFileName(s)}"`,
			'cache-control': 'private, no-store',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
		}
	});
}
