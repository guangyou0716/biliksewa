/** Today's date in Malaysia, where the landlords are, as `YYYY-MM-DD`. */
export function todayInMalaysia(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Kuala_Lumpur',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}
