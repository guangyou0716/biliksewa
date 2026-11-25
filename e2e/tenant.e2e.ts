import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).not.toHaveURL(/\/login/);
}

test('the demo tenant sees only their own ledger and receipts', async ({ page }) => {
	await signIn(page, 'tenant@biliksewa.test', 'demo-tenant');
	await expect(page).toHaveURL(/\/portal$/);
	await expect(page.getByRole('heading', { name: 'Hi, Priya Devi' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Rumah Mawar (demo)' })).toBeVisible();
	await expect(page.getByText('DEMO-TRF-1006')).toBeVisible();
	// Other tenants' payments and names never show up.
	await expect(page.getByText('DEMO-TRF-1001')).toHaveCount(0);
	await expect(page.getByText('Tan Wei Jie')).toHaveCount(0);

	await page
		.getByRole('link', { name: /^Receipt for/ })
		.first()
		.click();
	await expect(page.getByRole('heading', { name: 'Payment receipt' })).toBeVisible();
	await expect(page.getByText(/^R-\d{6}$/)).toBeVisible();
	await expect(page.getByRole('article').getByText('Priya Devi')).toBeVisible();

	// Payment 1 belongs to another tenant: same 404 as a missing one.
	expect((await page.goto('/portal/receipts/1'))?.status()).toBe(404);
	expect((await page.goto('/portal/receipts/999999'))?.status()).toBe(404);
});

test('a tenant account cannot open landlord pages', async ({ page }) => {
	await signIn(page, 'tenant@biliksewa.test', 'demo-tenant');
	for (const path of ['/', '/properties', '/tenancies', '/billing', '/tenancies/1']) {
		await page.goto(path);
		await expect(page).toHaveURL(/\/portal$/);
	}
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login/);
});

test('a landlord invites a tenant, who signs up once with the link', async ({ page, browser }) => {
	await signIn(page, 'demo@biliksewa.test', 'demo-landlord');
	await page.goto('/portal');
	await expect(page).toHaveURL(/\/$/);
	await page.goto('/tenancies');
	await page.getByRole('link', { name: 'Ooi Mei Xin' }).click();
	const card = page.getByRole('region', { name: 'Tenant portal' });
	await card.getByRole('button', { name: 'Create invite link' }).click();
	const link = await card.getByLabel(/Invite link/).inputValue();
	expect(link).toMatch(/^http:\/\/localhost:4173\/invite\/[\w-]{43}$/);

	const tenantCtx = await browser.newContext();
	const tenantPage = await tenantCtx.newPage();
	const res = await tenantPage.goto(link);
	// The token is in the URL, so it must not leak through Referer headers or caches.
	expect(res?.headers()['referrer-policy']).toBe('no-referrer');
	expect(res?.headers()['cache-control']).toBe('no-store');
	await expect(tenantPage.getByText(/invited Ooi Mei Xin/)).toBeVisible();
	await expect(tenantPage.getByLabel('Email')).toHaveValue('ooi.mei.xin@example.test');
	await tenantPage.getByLabel('Password', { exact: true }).fill('mei-xin-pass');
	await tenantPage.getByLabel('Confirm password').fill('mei-xin-pass');
	await tenantPage.getByRole('button', { name: 'Create my account' }).click();
	await expect(tenantPage).toHaveURL(/\/portal$/);
	await expect(tenantPage.getByRole('heading', { name: 'Hi, Ooi Mei Xin' })).toBeVisible();
	await expect(tenantPage.getByText('DEMO-TRF-1003')).toBeVisible();

	// The link works once.
	const again = await tenantCtx.newPage();
	await again.goto(link);
	await expect(again.getByRole('alert')).toContainText('not valid');
	await tenantCtx.close();

	await page.reload();
	await expect(card).toContainText('ooi.mei.xin@example.test');
	await expect(card.getByRole('button', { name: 'Remove portal access' })).toBeVisible();
});

test('repeated wrong passwords are rate limited', async ({ page }) => {
	await page.goto('/login');
	for (let i = 0; i < 5; i++) {
		await page.getByLabel('Email').fill('nobody@biliksewa.test');
		await page.getByLabel('Password').fill(`wrong-${i}`);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByRole('alert')).toHaveText('Wrong email or password');
	}
	await page.getByLabel('Password').fill('wrong-again');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toContainText('Too many failed sign-ins');
});
