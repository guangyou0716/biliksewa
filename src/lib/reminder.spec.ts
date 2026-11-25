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

	const input = {
		tenantName: 'Aina Sofea',
		landlordName: 'Demo Landlord',
		where: 'Rumah Mawar (demo), Master room, Katil A',
		today: '2026-11-26',
		items: [
			{ description: 'Rent 2026-10', dueDate: '2026-10-07', unpaidSen: 45000 },
			{ description: 'TNB electricity', dueDate: '2026-11-25', unpaidSen: 1234 }
		]
	};

	it('writes the reminder in Bahasa Melayu', () => {
		expect(reminderMessage({ ...input, locale: 'ms' })).toBe(
			[
				'Hai Aina Sofea, ini peringatan mesra daripada Demo Landlord tentang Rumah Mawar (demo), Master room, Katil A.',
				'Setakat 2026-11-26, RM 462.34 telah tertunggak:',
				'- Rent 2026-10 (tarikh akhir 2026-10-07): RM 450.00, tertunggak 50 hari',
				'- TNB electricity (tarikh akhir 2026-11-25): RM 12.34, tertunggak 1 hari',
				'Sila bayar apabila boleh dan hantarkan rujukan pindahan kepada saya. Jika sudah membayar, sila abaikan mesej ini. Terima kasih!'
			].join('\n')
		);
	});

	it('writes the reminder in Simplified Chinese', () => {
		expect(reminderMessage({ ...input, locale: 'zh' })).toBe(
			[
				'Aina Sofea 您好，这是 Demo Landlord 关于 Rumah Mawar (demo), Master room, Katil A 的友情提醒。',
				'截至 2026-11-26，逾期金额为 RM 462.34：',
				'- Rent 2026-10（到期日 2026-10-07）：RM 450.00，已逾期 50 天',
				'- TNB electricity（到期日 2026-11-25）：RM 12.34，已逾期 1 天',
				'方便时请付款，并把转账参考号发给我。如已付款，请忽略此消息。谢谢！'
			].join('\n')
		);
	});

	it('inserts names literally, even with $ patterns or braces', () => {
		const msg = reminderMessage({ ...input, tenantName: '$& {where}', locale: 'en' });
		expect(msg.split('\n')[0]).toBe(
			'Hi $& {where}, this is a friendly reminder from Demo Landlord about Rumah Mawar (demo), Master room, Katil A.'
		);
	});
});
