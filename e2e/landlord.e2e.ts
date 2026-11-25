import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, next = '/') {
	await page.goto(next);
	await expect(page).toHaveURL(/\/login/);
	await page.getByLabel('Email').fill('demo@biliksewa.test');
	await page.getByLabel('Password').fill('demo-landlord');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).not.toHaveURL(/\/login/);
}

function money(text: string | null): number {
	return Math.round(Number((text ?? '').replace(/[^0-9.]/g, '')) * 100);
}

test('requires sign in and rejects a wrong password', async ({ page }) => {
	await page.goto('/properties');
	await expect(page).toHaveURL(/\/login\?next=%2Fproperties/);
	await page.getByLabel('Email').fill('demo@biliksewa.test');
	await page.getByLabel('Password').fill('nope');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Wrong email or password');
});

test('dashboard shows occupancy and overdue tenants from the demo data', async ({ page }) => {
	await signIn(page);
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page.getByText('6 / 10')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Overdue' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Tan Wei Jie' })).toBeVisible();
});

test('moves a tenant into a vacant bed', async ({ page }) => {
	await signIn(page, '/properties');
	await page.getByRole('link', { name: /Teres Cempaka/ }).click();
	const vacant = page.getByTestId('bed').filter({ hasText: 'Vacant' }).first();
	await vacant.getByRole('link', { name: 'Move in' }).click();
	await page.getByLabel('Tenant name').fill('Nadia Demo');
	await page.getByLabel('Monthly rent (RM)').fill('300');
	await page.getByLabel('Deposit (RM)').fill('600');
	await page.getByRole('button', { name: 'Move in' }).click();
	await expect(page.getByRole('heading', { name: 'Nadia Demo' })).toBeVisible();
	await expect(page.getByText('Staying')).toBeVisible();

	await page.getByRole('link', { name: 'Teres Cempaka (demo)' }).click();
	await expect(page.getByRole('link', { name: 'Nadia Demo' })).toBeVisible();
});

test('generates rent once per month', async ({ page }) => {
	await signIn(page, '/billing');
	// The demo data already billed this month; only the tenant who moved in today is new.
	await page.getByRole('button', { name: 'Generate rent' }).click();
	await expect(page.getByRole('status')).toContainText(
		/Billed rent for \d{4}-\d{2} to 1 tenancy\./
	);
	await page.getByRole('button', { name: 'Generate rent' }).click();
	await expect(page.getByRole('status')).toContainText('was already billed (7 tenancies)');
	await page.getByLabel('Month').fill('2099-01');
	await page.getByRole('button', { name: 'Generate rent' }).click();
	await expect(page.getByRole('status')).toContainText('Billed rent for 2099-01 to 7 tenancies');
	await page.getByLabel('Month').fill('2099-01');
	await page.getByRole('button', { name: 'Generate rent' }).click();
	await expect(page.getByRole('status')).toContainText(
		'Rent for 2099-01 was already billed (7 tenancies)'
	);
});

test('splits a house bill by nights with an exact total', async ({ page }) => {
	await signIn(page, '/billing');
	await page.getByLabel('Property').selectOption({ label: 'Rumah Mawar (demo)' });
	await page.getByLabel('Bill', { exact: true }).fill('Unifi internet');
	await page.getByLabel('Amount (RM)').fill('129.00');
	await page.getByRole('button', { name: 'Preview split' }).click();
	const preview = page.getByRole('region', { name: /Preview: Unifi internet/ });
	await expect(preview).toBeVisible();
	const shares = await preview.locator('tbody tr:not(:last-child) td:last-child').allTextContents();
	expect(shares.length).toBe(3);
	expect(shares.reduce((s, t) => s + money(t), 0)).toBe(12900);
	await preview.getByRole('button', { name: /Confirm and bill 3 tenants/ }).click();
	await expect(page.getByRole('status')).toContainText(
		'Split Unifi internet (RM 129.00) across 3 tenants'
	);
});

test('records a payment and lowers the balance', async ({ page }) => {
	await signIn(page, '/tenancies');
	await page.getByRole('link', { name: 'Tan Wei Jie' }).click();
	const balance = page.getByRole('region', { name: 'Balance' });
	const before = money(await balance.locator('p.text-2xl').nth(2).textContent());
	await page.getByLabel('Amount (RM)').fill('100');
	await page.getByLabel('Reference (optional)').fill('DEMO-E2E-1');
	await page.getByRole('button', { name: 'Record payment' }).click();
	await expect(page.getByRole('status')).toContainText('Payment of RM 100.00 recorded');
	await expect(page.getByRole('cell', { name: 'DEMO-E2E-1' })).toBeVisible();
	await expect
		.poll(async () => money(await balance.locator('p.text-2xl').nth(2).textContent()))
		.toBe(before - 10000);
});

test('unknown or foreign records are 404, and sign out works', async ({ page }) => {
	await signIn(page);
	const res = await page.goto('/properties/99999');
	expect(res?.status()).toBe(404);
	await page.goto('/');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/');
	await expect(page).toHaveURL(/\/login/);
});
