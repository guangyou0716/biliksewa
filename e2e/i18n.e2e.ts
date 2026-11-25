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

test('landlord pages and server-side form errors follow the chosen language', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('demo@biliksewa.test');
	await page.getByLabel('Password').fill('demo-landlord');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	await page.getByRole('button', { name: '中文 – 简体中文' }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
	await expect(page.getByRole('heading', { name: '概览', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: '生成本月账单' })).toBeVisible();
	await expect(page.getByText('已入住床位')).toBeVisible();

	await page.goto('/properties');
	await expect(page.getByRole('heading', { name: '物业', level: 1 })).toBeVisible();
	await page.getByRole('link', { name: /Teres Cempaka/ }).click();
	await expect(page.getByText(/每月 \d+ 日交租/)).toBeVisible();
	// Server-side validation comes back in Chinese, with the field name translated.
	const addBed = page.locator('form[action="?/bed"]').first();
	await addBed.getByLabel('床位编号').fill('Z');
	await addBed.getByLabel('租金（RM）').fill('abc');
	await addBed.getByRole('button', { name: /^为 .+ 添加床位$/ }).click();
	await expect(page.getByRole('alert')).toHaveText('租金：请输入金额，例如 450 或 450.50');

	await page.goto('/tenancies');
	await expect(page.getByRole('heading', { name: '租客', level: 1 })).toBeVisible();
	await expect(page.getByText('显示已退租')).toBeVisible();
	await page.getByRole('link', { name: 'Hafiz Danial' }).click();
	await expect(page.getByRole('heading', { name: '记录付款' })).toBeVisible();
	await expect(page.getByRole('region', { name: '租客门户' })).toBeVisible();

	await page.goto('/billing');
	await page.getByLabel('账单', { exact: true }).fill('Unifi');
	await page.getByLabel('金额（RM）').fill('12x');
	await page.getByRole('button', { name: '预览分摊' }).click();
	await expect(page.getByRole('alert')).toHaveText('账单金额：请输入金额，例如 450 或 450.50');

	const missing = await page.goto('/tenancies/99999');
	expect(missing?.status()).toBe(404);
	await expect(page.getByText('找不到该租约')).toBeVisible();

	// Bahasa Melayu: meters and export.
	await page.goto('/meters');
	await page.getByRole('button', { name: 'BM – Bahasa Melayu' }).click();
	await expect(page.getByRole('heading', { name: 'Bacaan meter', level: 1 })).toBeVisible();
	await expect(page.getByRole('heading', { name: /^Menunggu anda \(\d+\)$/ })).toBeVisible();
	await page.goto('/export');
	await expect(page.getByRole('heading', { name: 'Eksport ke hamparan' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Muat turun CSV caj' })).toBeVisible();
});
