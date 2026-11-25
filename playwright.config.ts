import { defineConfig } from '@playwright/test';

const DB = 'e2e.db';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	webServer: {
		command: `npm run build && npx tsx scripts/seed.ts && node build`,
		port: 4173,
		reuseExistingServer: false,
		env: { DATABASE_URL: DB, PORT: '4173', ORIGIN: 'http://localhost:4173' }
	}
});
