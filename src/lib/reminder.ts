import { toDayNumber } from './dates';
import { formatRM } from './money';

/** Whole days from `dueDate` to `today` (0 on the due date itself, never negative). */
export function daysOverdue(dueDate: string, today: string): number {
	return Math.max(0, toDayNumber(today) - toDayNumber(dueDate));
}

export interface ReminderItem {
	description: string;
	dueDate: string;
	unpaidSen: number;
}

/**
 * A polite reminder the landlord can copy into WhatsApp, SMS or email. biliksewa never sends it.
 * Only what the tenant already sees in their own ledger goes in; no bank details are added.
 */
export function reminderMessage(input: {
	tenantName: string;
	landlordName: string;
	where: string;
	today: string;
	items: ReminderItem[];
}): string {
	const total = input.items.reduce((s, i) => s + i.unpaidSen, 0);
	const lines = input.items.map((i) => {
		const days = daysOverdue(i.dueDate, input.today);
		return `- ${i.description} (due ${i.dueDate}): ${formatRM(i.unpaidSen)}, ${days} ${days === 1 ? 'day' : 'days'} overdue`;
	});
	return [
		`Hi ${input.tenantName}, this is a friendly reminder from ${input.landlordName} about ${input.where}.`,
		`As of ${input.today}, ${formatRM(total)} is overdue:`,
		...lines,
		'Please pay when you can and send me the transfer reference. If you have already paid, please ignore this message. Thank you!'
	].join('\n');
}
