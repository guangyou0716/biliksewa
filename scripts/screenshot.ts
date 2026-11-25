/** Captures README screenshots from a running server (default http://localhost:4173) with demo data. */
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({
	viewport: { width: 1280, height: 860 },
	deviceScaleFactor: 1
});
await page.goto(`${base}/login`);
await page.getByLabel('Email').fill('demo@biliksewa.test');
await page.getByLabel('Password').fill('demo-landlord');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(`${base}/`);
await page.screenshot({ path: 'docs/dashboard.png', fullPage: true });

await page.goto(`${base}/properties`);
await page.getByRole('link', { name: /Rumah Mawar/ }).click();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'docs/property-board.png', fullPage: true });

await page.goto(`${base}/billing`);
await page.getByLabel('Property').selectOption({ label: 'Rumah Mawar (demo)' });
await page.getByLabel('Bill', { exact: true }).fill('Unifi internet');
await page.getByLabel('Amount (RM)').fill('129.00');
await page.getByRole('button', { name: 'Preview split' }).click();
await page.getByRole('region', { name: /Preview/ }).waitFor();
await page.screenshot({ path: 'docs/bill-split.png', fullPage: true });

// A settled deposit (demo data: Farah moved out last month).
await page.goto(`${base}/tenancies`);
await page.getByLabel('Show moved-out').check();
await page.getByRole('link', { name: 'Farah Hani' }).click();
await page.getByRole('region', { name: /Deposit settled on/ }).waitFor();
await page.screenshot({ path: 'docs/deposit-settlement.png', fullPage: true });

const tenant = await browser.newPage({
	viewport: { width: 1280, height: 860 },
	deviceScaleFactor: 1
});
await tenant.goto(`${base}/login`);
await tenant.getByLabel('Email').fill('tenant@biliksewa.test');
await tenant.getByLabel('Password').fill('demo-tenant');
await tenant.getByRole('button', { name: 'Sign in' }).click();
await tenant.waitForURL(`${base}/portal`);
await tenant.screenshot({ path: 'docs/tenant-portal.png', fullPage: true });

await browser.close();
console.log(
	'Saved docs/dashboard.png, docs/property-board.png, docs/bill-split.png, docs/tenant-portal.png, docs/deposit-settlement.png'
);
