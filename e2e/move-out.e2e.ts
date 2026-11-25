import { expect, test } from '@playwright/test';

/** Month before the current Malaysian month, as `YYYY-MM` (the server bills in Malaysian time). */
function lastMonth(): string {
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(
		new Date()
	);
	let [y, m] = today.split('-').map(Number);
	m -= 1;
	if (m < 1) {
		m = 12;
		y -= 1;
	}
	return `${y}-${String(m).padStart(2, '0')}`;
}

test('a late move-out re-splits the house bill, then the deposit is settled', async ({ page }) => {
	await page.goto('/tenancies');
	await page.getByLabel('Email').fill('demo@biliksewa.test');
	await page.getByLabel('Password').fill('demo-landlord');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.getByRole('link', { name: 'Arun Raj' }).click();
	await expect(page.getByRole('heading', { name: 'Arun Raj' })).toBeVisible();

	// Recorded late: she actually left on the 20th of last month, after the water bill was split.
	await page.getByLabel('Move-out date').fill(`${lastMonth()}-20`);
	await page.getByRole('button', { name: 'Record move-out' }).click();
	await expect(page.getByRole('status')).toContainText('Move-out recorded');
	await expect(page.getByRole('status')).toContainText(/PBAPP water .* re-split by nights stayed/);
	await expect(page.getByText(/^Moved out /)).toBeVisible();

	const form = page.locator('form', { has: page.getByRole('heading', { name: 'Settle deposit' }) });
	await form.getByLabel('Deduction 1 description').fill('Cleaning');
	await form.getByLabel('Deduction 1 amount (RM)').fill('50');
	const previewRefund = await form
		.getByRole('definition')
		.filter({ hasText: 'RM' })
		.nth(1)
		.textContent();
	await form.getByLabel('Refund reference (optional)').fill('DEMO-E2E-REFUND');
	await form.getByRole('button', { name: 'Settle deposit' }).click();
	await expect(page.getByRole('status')).toContainText('Deposit settled');

	const summary = page.getByRole('region', { name: /Deposit settled on/ });
	await expect(summary.getByText('Deduction: Cleaning')).toBeVisible();
	await expect(summary.getByTestId('refund')).toHaveText(previewRefund ?? '');
	await expect(summary.getByText('(ref DEMO-E2E-REFUND)')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'From deposit' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Settle deposit' })).toHaveCount(0);
});
