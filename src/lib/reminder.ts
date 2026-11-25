import { toDayNumber } from './dates';
import { formatRM } from './money';
import { dayCount, DEFAULT_LOCALE, translator, type Locale } from './i18n';

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
 * Written in `locale` (the landlord picks the tenant's language); charge descriptions stay as stored.
 */
export function reminderMessage(input: {
	tenantName: string;
	landlordName: string;
	where: string;
	today: string;
	items: ReminderItem[];
	locale?: Locale;
}): string {
	const t = translator(input.locale ?? DEFAULT_LOCALE);
	const total = input.items.reduce((s, i) => s + i.unpaidSen, 0);
	const lines = input.items.map((i) =>
		t('reminder.item', {
			description: i.description,
			due: i.dueDate,
			amount: formatRM(i.unpaidSen),
			days: dayCount(t, daysOverdue(i.dueDate, input.today))
		})
	);
	return [
		t('reminder.greeting', {
			tenant: input.tenantName,
			landlord: input.landlordName,
			where: input.where
		}),
		t('reminder.asOf', { today: input.today, total: formatRM(total) }),
		...lines,
		t('reminder.closing')
	].join('\n');
}
