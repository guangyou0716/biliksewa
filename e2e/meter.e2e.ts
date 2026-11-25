import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

/** A PNG signature plus padding: the server checks the file's bytes, not its name or declared type. */
const PNG = Buffer.from([
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
	...new Array<number>(64).fill(0)
]);

async function signIn(browser: Browser, email: string, password: string): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).not.toHaveURL(/\/login/);
	return page;
}

test('the landlord confirms a waiting reading and it is billed on the tenant ledger', async ({
	browser
}) => {
	const page = await signIn(browser, 'demo@biliksewa.test', 'demo-landlord');
	await page.getByRole('link', { name: 'Meters' }).click();
	const reading = page.getByRole('article', { name: 'Reading from Aina Sofea' });
	await expect(reading).toContainText('2405.5 kWh');
	await expect(reading).toContainText('195.5 kWh = RM 107.53');

	const href = await reading.getByRole('link', { name: 'View photo' }).getAttribute('href');
	const photo = await page.request.get(href!);
	expect(photo.status()).toBe(200);
	expect(photo.headers()['content-type']).toBe('image/png');
	expect(photo.headers()['content-security-policy']).toContain("default-src 'none'");

	await reading.getByRole('button', { name: 'Confirm and bill' }).click();
	await expect(page.getByRole('status')).toHaveText(
		'Reading confirmed. 195.5 kWh used: RM 107.53 billed.'
	);
	await expect(page.getByRole('heading', { name: 'Waiting for you (0)' })).toBeVisible();

	await page.getByRole('link', { name: 'Tenants' }).click();
	await page.getByRole('link', { name: 'Aina Sofea' }).click();
	await expect(
		page.getByRole('cell', { name: /^Electricity Master room .*195\.5 kWh at RM 0\.55\/kWh$/ })
	).toBeVisible();
});

test('a tenant sends a reading; the landlord rejects it with a reason, then confirms the retry', async ({
	browser
}) => {
	const tenant = await signIn(browser, 'tenant@biliksewa.test', 'demo-tenant');
	const meter = tenant.getByRole('region', { name: 'Electricity meter (your room)' });
	await expect(meter).toContainText('RM 0.55/kWh');
	await expect(meter).toContainText('Last confirmed reading: 1702.6 kWh');

	await meter.getByLabel('Reading (kWh)').fill('1700');
	await meter.getByRole('button', { name: 'Send reading' }).click();
	await expect(tenant.getByRole('alert')).toContainText('cannot be lower than the last confirmed');

	await meter.getByLabel('Reading (kWh)').fill('1850.0');
	await meter.getByLabel('Photo (optional)').setInputFiles({
		name: 'meter.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await meter.getByRole('button', { name: 'Send reading' }).click();
	await expect(tenant.getByRole('status')).toHaveText(
		'Reading of 1850.0 kWh sent to your landlord'
	);
	await expect(meter.getByText('Waiting', { exact: true })).toBeVisible();
	await expect(meter.getByRole('button', { name: 'Send reading' })).toHaveCount(0);
	const own = await meter.getByRole('link', { name: 'photo' }).getAttribute('href');
	expect((await tenant.request.get(own!)).status()).toBe(200);
	// Aina's photo (reading 5 in the demo data) is not this tenant's: 404 like a missing one.
	expect((await tenant.request.get('/portal/readings/5/photo')).status()).toBe(404);
	expect((await tenant.request.get('/portal/readings/99999/photo')).status()).toBe(404);

	const landlord = await signIn(browser, 'demo@biliksewa.test', 'demo-landlord');
	await landlord.goto('/meters');
	let reading = landlord.getByRole('article', { name: 'Reading from Priya Devi' });
	await reading.getByLabel('Reason for rejecting').fill('Photo is blurry');
	await reading.getByRole('button', { name: 'Reject' }).click();
	await expect(landlord.getByRole('status')).toContainText('Reading rejected');

	await tenant.reload();
	await expect(meter).toContainText('Reason: Photo is blurry');
	await meter.getByLabel('Reading (kWh)').fill('1850.0');
	await meter.getByRole('button', { name: 'Send reading' }).click();
	await expect(tenant.getByRole('status')).toContainText('sent to your landlord');

	await landlord.reload();
	reading = landlord.getByRole('article', { name: 'Reading from Priya Devi' });
	await expect(reading).toContainText('147.4 kWh = RM 81.07');
	await reading.getByRole('button', { name: 'Confirm and bill' }).click();
	await expect(landlord.getByRole('status')).toContainText(
		'147.4 kWh used: RM 81.07 billed across 2 tenants by nights stayed.'
	);

	await tenant.reload();
	await expect(tenant.getByRole('cell', { name: /^Electricity Middle room / })).toBeVisible();
	await expect(meter.getByText('Confirmed', { exact: true }).first()).toBeVisible();
	await expect(meter).toContainText('147.4 kWh used by the room');
	// The room total (RM 81.07) is split with the housemate; the tenant only sees their own share.
	await expect(meter).not.toContainText('RM 81.07');
	// The housemate who shares the meter (and the charge) is never named.
	await expect(tenant.getByText('Tan Wei Jie')).toHaveCount(0);
});
