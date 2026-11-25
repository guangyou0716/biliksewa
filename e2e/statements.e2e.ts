import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).not.toHaveURL(/\/login/);
}
const landlord = (page: Page) => signIn(page, 'demo@biliksewa.test', 'demo-landlord');
const tenant = (page: Page) => signIn(page, 'tenant@biliksewa.test', 'demo-tenant');

test('the landlord opens a monthly statement, downloads it and opens a receipt', async ({
	page
}) => {
	await landlord(page);
	await page.goto('/tenancies');
	await page.getByRole('link', { name: 'Hafiz Danial' }).click();
	await page.getByRole('link', { name: 'Monthly statement' }).click();
	await expect(page).toHaveURL(/\/tenancies\/\d+\/statement$/);
	await expect(
		page.getByRole('heading', { name: /^Monthly statement \d{4}-\d{2}$/ })
	).toBeVisible();
	await expect(page.getByText('Balance brought forward')).toBeVisible();

	// Previous month: Hafiz paid by bank transfer, with a receipt link.
	await page.getByRole('link', { name: /^← \d{4}-\d{2}$/ }).click();
	await expect(page.getByText(/Payment, bank transfer \(DEMO-TRF-1005\)/)).toBeVisible();

	const download = await page.request.get(
		(await page.getByRole('link', { name: 'Download (HTML)' }).getAttribute('href'))!
	);
	expect(download.status()).toBe(200);
	expect(download.headers()['content-disposition']).toMatch(
		/^attachment; filename="biliksewa-statement-\d+-\d{4}-\d{2}\.html"$/
	);
	expect(download.headers()['cache-control']).toBe('private, no-store');
	expect(await download.text()).toContain('Hafiz Danial');

	await page
		.getByRole('link', { name: /^Receipt for/ })
		.first()
		.click();
	await expect(page.getByRole('heading', { name: 'Payment receipt' })).toBeVisible();
	await expect(page.getByRole('article').getByText('Hafiz Danial')).toBeVisible();

	expect((await page.goto('/receipts/999999'))?.status()).toBe(404);
	expect((await page.goto('/tenancies/999999/statement'))?.status()).toBe(404);
	expect((await page.request.get('/tenancies/999999/statement/download')).status()).toBe(404);
	expect((await page.goto('/tenancies/1/statement?month=2026-13'))?.status()).toBe(400);
});

test('the overdue reminders list shows who owes what with a copyable message', async ({ page }) => {
	await landlord(page);
	await page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'Reminders' })
		.click();
	await expect(page.getByRole('heading', { name: 'Overdue reminders' })).toBeVisible();
	const tan = page.getByRole('article', { name: /Tan Wei Jie/ });
	await expect(tan).toContainText(/\d+ days overdue \(since \d{4}-\d{2}-07\)/);
	const message = await tan.getByLabel('Reminder message for Tan Wei Jie').inputValue();
	expect(message).toMatch(/^Hi Tan Wei Jie, this is a friendly reminder from Demo Landlord/);
	expect(message).toMatch(
		/- Rent \d{4}-\d{2} \(due \d{4}-\d{2}-07\): RM [\d,]+\.\d{2}, \d+ days? overdue/
	);
	// One card per overdue tenant, matching the summary; earlier e2e tests change who owes what.
	const count = await page.getByRole('article').count();
	await expect(page.getByRole('region', { name: 'Overdue summary' })).toContainText(
		new RegExp(`Tenants overdue\\s*${count}\\s*$`)
	);
});

test('the landlord exports charges and payments as guarded CSV', async ({ page }) => {
	await landlord(page);
	await page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'Export' })
		.click();
	await page.getByLabel('All months').check();
	const href = await page.getByRole('link', { name: 'Download charges CSV' }).getAttribute('href');
	expect(href).toBe('/export/charges.csv');

	const charges = await page.request.get(href!);
	expect(charges.status()).toBe(200);
	expect(charges.headers()['content-type']).toBe('text/csv; charset=utf-8');
	expect(charges.headers()['content-disposition']).toBe(
		'attachment; filename="biliksewa-charges-all.csv"'
	);
	const text = await charges.text();
	expect(text.split('\r\n')[0].replace(/^\uFEFF/, '')).toBe(
		'charge_id,billing_month,due_date,tenant,property,room,bed,kind,description,amount_rm,unpaid_rm'
	);
	expect(text).toContain('Tan Wei Jie');

	const payments = await page.request.get('/export/payments.csv?month=2000-01');
	expect(payments.status()).toBe(200);
	expect((await payments.text()).trimEnd().split('\r\n')).toHaveLength(1);
	expect((await page.request.get('/export/payments.csv')).status()).toBe(200);
	expect((await page.request.get('/export/charges.csv?month=nope')).status()).toBe(400);
});

test('a tenant sees only their own statements and cannot reach landlord exports', async ({
	page
}) => {
	await tenant(page);
	await page.getByRole('link', { name: 'Monthly statement' }).click();
	await expect(page).toHaveURL(/\/portal\/statements\/\d+$/);
	await expect(page.getByRole('heading', { name: /^Monthly statement/ })).toBeVisible();
	await expect(page.getByText('Priya Devi ·')).toBeVisible();
	const own = Number(new URL(page.url()).pathname.split('/').pop());
	expect((await page.request.get(`/portal/statements/${own}/download`)).status()).toBe(200);

	// Tenancy 1 belongs to another tenant: same 404 as a missing one.
	const otherId = own === 1 ? 2 : 1;
	expect((await page.goto(`/portal/statements/${otherId}`))?.status()).toBe(404);
	expect((await page.goto('/portal/statements/999999'))?.status()).toBe(404);
	expect((await page.request.get(`/portal/statements/${otherId}/download`)).status()).toBe(404);

	// Landlord pages and exports send a tenant back to their portal.
	for (const path of [
		'/reminders',
		'/export',
		'/export/charges.csv',
		'/export/payments.csv',
		'/receipts/1',
		`/tenancies/${own}/statement`,
		`/tenancies/${own}/statement/download`
	]) {
		await page.goto(path);
		await expect(page).toHaveURL(/\/portal$/);
	}
});

test('a landlord cannot open tenant portal statements', async ({ page }) => {
	await landlord(page);
	await page.goto('/portal/statements/1');
	await expect(page).toHaveURL(/\/$/);
});
