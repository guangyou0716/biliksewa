import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

/** WCAG 2.1 A and AA rules from axe-core; any violation fails the test with a readable list. */
async function audit(page: Page, label: string) {
	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	const summary = violations.map(
		(v) =>
			`${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect(summary, `axe violations on ${label}`).toEqual([]);
}

async function signIn(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).not.toHaveURL(/\/login/);
}

test('public pages pass the axe audit in every language', async ({ page }) => {
	for (const lang of ['EN', 'BM', '中文']) {
		await page.goto('/login');
		await page.getByRole('button', { name: new RegExp(`^${lang} – `) }).click();
		await expect(page.getByRole('button', { name: new RegExp(`^${lang} – `) })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await audit(page, `login (${lang})`);
		await page.goto('/invite/not-a-real-token');
		await audit(page, `invalid invite (${lang})`);
	}
});

test('landlord pages pass the axe audit', async ({ page }) => {
	await signIn(page, 'demo@biliksewa.test', 'demo-landlord');
	for (const path of [
		'/',
		'/properties',
		'/tenancies',
		'/billing',
		'/meters',
		'/reminders',
		'/export'
	]) {
		await page.goto(path);
		await audit(page, path);
	}
	await page.goto('/properties');
	await page.getByRole('link', { name: /Teres Cempaka/ }).click();
	await audit(page, 'property detail');
	await page.goto('/tenancies');
	await page.getByRole('link', { name: 'Hafiz Danial' }).click();
	await audit(page, 'tenancy detail');
	await page.getByRole('link', { name: 'Monthly statement' }).click();
	await page.getByRole('link', { name: /^← \d{4}-\d{2}$/ }).click();
	await audit(page, 'statement');
	await page
		.getByRole('link', { name: /^Receipt for/ })
		.first()
		.click();
	await audit(page, 'receipt');
	await page.goto('/reminders?lang=zh');
	await audit(page, 'reminders with Chinese messages');

	// The whole landlord side in Chinese and Bahasa Melayu (longer words, different scripts).
	for (const lang of ['中文', 'BM']) {
		await page.getByRole('button', { name: new RegExp(`^${lang} – `) }).click();
		for (const path of ['/', '/properties', '/tenancies', '/billing', '/meters', '/export']) {
			await page.goto(path);
			await audit(page, `${path} (${lang})`);
		}
		await page.goto('/tenancies');
		await page.getByRole('link', { name: 'Hafiz Danial' }).click();
		await audit(page, `tenancy detail (${lang})`);
	}
});

test('tenant portal pages pass the axe audit in English and Chinese', async ({ page }) => {
	await signIn(page, 'tenant@biliksewa.test', 'demo-tenant');
	await audit(page, 'portal');
	await page.getByRole('link', { name: /^Monthly statement for/ }).click();
	await audit(page, 'portal statement');
	await page.goto('/portal');
	await page
		.getByRole('link', { name: /^Receipt for/ })
		.first()
		.click();
	await audit(page, 'portal receipt');
	await page.goto('/portal');
	await page.getByRole('button', { name: /^中文 – / }).click();
	await expect(page.getByRole('heading', { name: '您好，Priya Devi' })).toBeVisible();
	await audit(page, 'portal (中文)');
});
