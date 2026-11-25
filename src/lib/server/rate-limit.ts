/**
 * Counts failed attempts per key in a fixed time window, in memory.
 *
 * Good enough for one app process (and for the single Durable Object of the public demo). It is
 * not shared across several processes; a multi-instance deployment would need a shared store.
 */
export class AttemptLimiter {
	private readonly hits = new Map<string, { count: number; resetAt: number }>();

	constructor(
		private readonly max: number,
		private readonly windowMs: number,
		private readonly maxKeys = 10_000
	) {}

	/** Milliseconds until `key` may try again, or 0 if it is not blocked. */
	retryAfter(key: string, now = Date.now()): number {
		const hit = this.hits.get(key);
		if (!hit || hit.resetAt <= now) return 0;
		return hit.count >= this.max ? hit.resetAt - now : 0;
	}

	fail(key: string, now = Date.now()) {
		const hit = this.hits.get(key);
		if (hit && hit.resetAt > now) {
			hit.count += 1;
			return;
		}
		if (this.hits.size >= this.maxKeys) this.prune(now);
		this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
	}

	reset(key: string) {
		this.hits.delete(key);
	}

	private prune(now: number) {
		for (const [key, hit] of this.hits) if (hit.resetAt <= now) this.hits.delete(key);
		// Still full: drop the oldest entries (Map keeps insertion order) rather than grow forever.
		for (const key of this.hits.keys()) {
			if (this.hits.size < this.maxKeys) break;
			this.hits.delete(key);
		}
	}
}

const WINDOW_MS = 15 * 60 * 1000;

/** Failed sign-ins every 15 minutes: 5 per email from one client address, 20 per address. */
export const loginByEmail = new AttemptLimiter(5, WINDOW_MS);
export const loginByAddress = new AttemptLimiter(20, WINDOW_MS);
/** Invite links that do not exist or have expired, per client address. */
export const inviteByAddress = new AttemptLimiter(20, WINDOW_MS);

export function minutes(ms: number): number {
	return Math.max(1, Math.ceil(ms / 60_000));
}
