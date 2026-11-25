import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('the language picker switches the UI and the choice survives sign-in', async ({ page }) => {
	await page.goto('/login');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await page.getByRole('button', { name: 'BM – Bahasa Melayu' }).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'ms');
	await page.getByLabel('E-mel').fill('tenant@biliksewa.test');
	await page.getByLabel('Kata laluan').fill('nope');
	await page.getByRole('button', { name: 'Log masuk' }).click();
	await expect(page.getByRole('alert')).toHaveText('E-mel atau kata laluan salah');
	await page.getByLabel('Kata laluan').fill('demo-tenant');
	await page.getByRole('button', { name: 'Log masuk' }).click();

	await expect(page).toHaveURL(/\/portal$/);
	await expect(page.getByRole('heading', { name: 'Hai, Priya Devi' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Caj' })).toBeVisible();
	await expect(
		page.getByRole('link', { name: /^Penyata bulanan untuk Rumah Mawar/ })
	).toBeVisible();

	// Switch to Chinese from inside the portal: back on the same page, still signed in.
	await page.getByRole('button', { name: '中文 – 简体中文' }).click();
	await expect(page).toHaveURL(/\/portal$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
	await expect(page.getByRole('heading', { name: '您好，Priya Devi' })).toBeVisible();
	await page.getByRole('link', { name: /的月结单$/ }).click();
	await expect(page.getByRole('heading', { name: /^\d{4}-\d{2} 月结单$/ })).toBeVisible();
	const href = await page.getByRole('link', { name: '下载（HTML）' }).getAttribute('href');
	const file = await (await page.request.get(href!)).text();
	expect(file).toContain('<html lang="zh-Hans">');
	expect(file).toContain('上期结余');
});

test('the browser language is used until a choice is saved; bad input is rejected', async ({
	browser
}) => {
	const ctx = await browser.newContext({ locale: 'zh-CN' });
	const page = await ctx.newPage();
	await page.goto('/login');
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
	await expect(page.getByRole('button', { name: '登录' })).toBeVisible();

	// Other sites cannot change the language (SvelteKit's same-origin check for form posts).
	const crossSite = { origin: 'https://evil.example' };
	expect(
		(await page.request.post('/locale', { form: { locale: 'ms' }, headers: crossSite })).status()
	).toBe(403);
	const sameSite = { origin: 'http://localhost:4173' };
	expect(
		(await page.request.post('/locale', { form: { locale: 'xx' }, headers: sameSite })).status()
	).toBe(400);
	// Never redirects off-site.
	const res = await page.request.post('/locale', {
		form: { locale: 'en', next: '//evil.example' },
		headers: sameSite,
		maxRedirects: 0
	});
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe('/');
	await page.goto('/login');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await ctx.close();
});

test('the landlord writes a reminder in the tenant’s language', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('demo@biliksewa.test');
	await page.getByLabel('Password').fill('demo-landlord');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).not.toHaveURL(/\/login/);
	await page.goto('/reminders');
	const first = page.getByRole('article').first();
	await expect(first.getByRole('textbox')).toHaveValue(/^Hi .+, this is a friendly reminder/);
	await page.getByRole('link', { name: 'Bahasa Melayu' }).click();
	await expect(page).toHaveURL(/\?lang=ms$/);
	await expect(first.getByRole('textbox')).toHaveValue(/^Hai .+, ini peringatan mesra/);
	await expect(first.getByRole('textbox')).toHaveAttribute('lang', 'ms');
	// The page itself stays in English.
	await expect(page.getByRole('heading', { name: 'Overdue reminders' })).toBeVisible();
	await page.getByRole('link', { name: '简体中文' }).click();
	await expect(first.getByRole('textbox')).toHaveValue(/友情提醒/);
});
