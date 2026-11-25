import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import nodeAdapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

// `npm run demo:build` sets this to build the public Cloudflare demo (see wrangler.demo.jsonc).
const demo = process.env.BILIKSEWA_TARGET === 'cloudflare-demo';

export default defineConfig({
	define: { 'import.meta.env.VITE_PUBLIC_DEMO': JSON.stringify(demo ? '1' : '') },
	resolve: demo
		? {
				alias: {
					// The demo's Durable Object installs the database; see worker/demo.ts.
					'#lib/server/db/index.ts': fileURLToPath(
						new URL('./src/lib/server/db/index.cloudflare.ts', import.meta.url)
					)
				}
			}
		: undefined,
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: demo ? cloudflareAdapter({ config: 'wrangler.demo.jsonc' }) : nodeAdapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
