/**
 * Only allow redirects back into this app after sign-in.
 * Rejects absolute and protocol-relative targets; browsers treat "/\host" like "//host".
 */
export function safeNext(next: string | null): string {
	return next && /^\/(?![/\\])/.test(next) ? next : '/';
}
