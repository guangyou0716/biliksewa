declare module 'sveltekit-worker' {
	const handler: { fetch(request: Request, env: unknown): Promise<Response> };
	export default handler;
}

declare module '*.sql' {
	const text: string;
	export default text;
}

// Installed by DemoApp, read by src/lib/server/db/index.cloudflare.ts.
// eslint-disable-next-line no-var
declare var __biliksewaDb: unknown;
