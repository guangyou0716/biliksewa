import { describe, expect, it } from 'vitest';
import { daysOverdue, reminderMessage } from './reminder';

describe('daysOverdue', () => {
	it('counts whole calendar days, across months and years', () => {
		expect(daysOverdue('2026-11-07', '2026-11-07')).toBe(0);
		expect(daysOverdue('2026-11-07', '2026-11-08')).toBe(1);
		expect(daysOverdue('2026-10-07', '2026-11-26')).toBe(50);
		expect(daysOverdue('2025-12-31', '2026-01-01')).toBe(1);
		expect(daysOverdue('2026-12-01', '2026-11-26')).toBe(0);
	});
});

describe('reminderMessage', () => {
	it('lists every overdue charge with its days overdue and the total', () => {
		const msg = reminderMessage({
			tenantName: 'Aina Sofea',
			landlordName: 'Demo Landlord',
			where: 'Rumah Mawar (demo), Master room, Bed A',
			today: '2026-11-26',
			items: [
				{ description: 'Rent 2026-10', dueDate: '2026-10-07', unpaidSen: 45000 },
				{ description: 'TNB electricity', dueDate: '2026-11-25', unpaidSen: 1234 }
			]
		});
		expect(msg).toBe(
			[
				'Hi Aina Sofea, this is a friendly reminder from Demo Landlord about Rumah Mawar (demo), Master room, Bed A.',
				'As of 2026-11-26, RM 462.34 is overdue:',
				'- Rent 2026-10 (due 2026-10-07): RM 450.00, 50 days overdue',
				'- TNB electricity (due 2026-11-25): RM 12.34, 1 day overdue',
				'Please pay when you can and send me the transfer reference. If you have already paid, please ignore this message. Thank you!'
			].join('\n')
		);
	});
});
