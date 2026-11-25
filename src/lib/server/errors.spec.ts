import { describe, expect, it } from 'vitest';
import { UserError } from './errors';
import { date, FormError, guard, money, requestLocale } from './forms';
import { RentalError } from './rentals';

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [k, v] of Object.entries(fields)) data.set(k, v);
	return data;
};

describe('UserError', () => {
	it('keeps the English text as the message and translates on demand', () => {
		const e = new RentalError('err.roomExists', { name: 'Room 1' });
		expect(e).toBeInstanceOf(UserError);
		expect(e.message).toBe('Room "Room 1" already exists');
		expect(e.localized('ms')).toBe('Bilik "Room 1" sudah wujud');
		expect(e.localized('zh')).toBe('房间“Room 1”已存在');
	});

	it('translates the field name inside field messages', () => {
		const e = new FormError('err.amount', {}, 'field.billAmount');
		expect(e.message).toBe('Bill amount: enter an amount like 450 or 450.50');
		expect(e.localized('ms')).toBe('Jumlah bil: masukkan jumlah seperti 450 atau 450.50');
		expect(e.localized('zh')).toBe('账单金额：请输入金额，例如 450 或 450.50');
	});

	it('fills numeric parameters', () => {
		const e = new RentalError('err.readingTooHigh', { kwh: '900.0 kWh', days: 3, max: 60 });
		expect(e.message).toBe(
			'That is 900.0 kWh in 3 day(s), more than 60 kWh a day. Check the reading'
		);
		expect(e.localized('zh')).toBe('3 天用电 900.0 kWh，超过每天 60 kWh。请检查读数');
	});
});

describe('form helpers', () => {
	it('throw field-labelled errors for bad amounts and dates', () => {
		expect(() => money(form({ rent: 'abc' }), 'rent', 'field.rent')).toThrow(
			'Rent: enter an amount like 450 or 450.50'
		);
		expect(() => date(form({ d: '2026-02-30' }), 'd', 'field.paidOn')).toThrow(
			'Paid on: enter a valid date'
		);
		expect(money(form({ rent: '450.50' }), 'rent', 'field.rent')).toBe(45050);
	});

	it('guard turns user errors into a 400 with the message and the submitted values', async () => {
		// Outside a request (unit tests) the language falls back to English.
		expect(requestLocale()).toBe('en');
		const result = await guard(form({ name: 'Rumah', secret: 'x' }), () => {
			throw new RentalError('err.nameAreaRequired');
		});
		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Name and area are required', values: { name: 'Rumah', secret: 'x' } }
		});
	});

	it('guard lets other errors through', async () => {
		await expect(
			guard(form({}), () => {
				throw new Error('database is locked');
			})
		).rejects.toThrow('database is locked');
		expect(await guard(form({}), () => ({ ok: true }))).toEqual({ ok: true });
	});
});
