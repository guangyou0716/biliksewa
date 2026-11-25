import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type DB } from './db/client';
import { charge, meterReading, tenant, user } from './db/schema';
import {
	confirmReading,
	landlordMeters,
	landlordPhoto,
	MAX_PHOTO_BYTES,
	photoType,
	readPhoto,
	recordReading,
	rejectReading,
	setMeterRate,
	submitReading,
	tenantMeter,
	tenantPhoto
} from './meter';
import { addBed, addProperty, addRoom, moveIn, RentalError, tenancyLedger } from './rentals';
import { seedDemo } from './seed';

const TODAY = '2026-11-25';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let db: DB;
let owner: number;
let other: number;
let propertyId: number;
let roomId: number;
let otherRoomId: number;
let aliceT: number;
let bobT: number;
let carolT: number;
let aliceUser: number;
let carolUser: number;

function account(email: string, role: 'landlord' | 'tenant') {
	return db.insert(user).values({ email, name: email, passwordHash: 'x', role }).returning().get()
		.id;
}

function linkTenant(tenancyTenantName: string, userId: number) {
	db.update(tenant).set({ userId }).where(eq(tenant.name, tenancyTenantName)).run();
}

/**
 * A property billed at RM 0.55/kWh: Room 1 is shared by Alice (from 1 Oct) and Bob (from 16 Oct),
 * Room 2 has Carol. Room 1 opened at 1000.0 kWh on 1 Oct.
 */
beforeEach(() => {
	db = createDb(':memory:');
	owner = account('owner@example.test', 'landlord');
	other = account('other@example.test', 'landlord');
	const p = addProperty(db, owner, { name: 'Rumah Ujian', area: 'Simpang Ampat' });
	propertyId = p.id;
	setMeterRate(db, owner, p.id, 5500);
	const r1 = addRoom(db, owner, p.id, 'Room 1');
	const r2 = addRoom(db, owner, p.id, 'Room 2');
	roomId = r1.id;
	otherRoomId = r2.id;
	const bed = (r: number, label: string) =>
		addBed(db, owner, r, { label, defaultRentSen: 30000 }).id;
	const stay = (bedId: number, name: string, startDate: string) =>
		moveIn(db, owner, { bedId, tenantName: name, startDate, monthlyRentSen: 30000, depositSen: 0 })
			.id;
	aliceT = stay(bed(r1.id, 'A'), 'Alice Test', '2026-10-01');
	bobT = stay(bed(r1.id, 'B'), 'Bob Test', '2026-10-16');
	carolT = stay(bed(r2.id, 'A'), 'Carol Test', '2026-10-01');
	aliceUser = account('alice@example.test', 'tenant');
	carolUser = account('carol@example.test', 'tenant');
	linkTenant('Alice Test', aliceUser);
	linkTenant('Carol Test', carolUser);
	recordReading(db, owner, roomId, { readOn: '2026-10-01', readingTenths: 10000 }, TODAY);
});

const submit = (
	over: Partial<Parameters<typeof submitReading>[3]> = {},
	userId = aliceUser,
	tenancyId = aliceT
) =>
	submitReading(
		db,
		userId,
		tenancyId,
		{ readOn: '2026-11-01', readingTenths: 13100, photo: null, ...over },
		TODAY
	);

const meterCharges = () =>
	db
		.select()
		.from(charge)
		.all()
		.filter((c) => c.meterReadingId !== null);

describe('tenant submits a reading', () => {
	it('creates a pending reading, one per room at a time', () => {
		const r = submit();
		expect(r.status).toBe('pending');
		expect(() => submit({ readingTenths: 13200 })).toThrow(/already waiting/);
		// A housemate's pending reading blocks the room too, and the tenant is told so.
		expect(tenantMeter(db, aliceUser, aliceT).pending).toBe(true);
	});

	it('rejects a reading lower than the last confirmed one, and dates not after it', () => {
		expect(() => submit({ readingTenths: 9999 })).toThrow(/cannot be lower .*1000\.0 kWh/);
		expect(() => submit({ readOn: '2026-10-01' })).toThrow(/after the last confirmed reading/);
	});

	it('rejects an implausible jump (more than 60 kWh a day)', () => {
		// 31 days x 60 kWh = 1860 kWh allowed.
		expect(submit({ readingTenths: 10000 + 18600 }).status).toBe('pending');
		db.delete(meterReading).where(eq(meterReading.status, 'pending')).run();
		expect(() => submit({ readingTenths: 10000 + 18601 })).toThrow(/more than 60 kWh a day/);
	});

	it('rejects future dates, dates outside the stay and properties with readings off', () => {
		expect(() => submit({ readOn: '2026-11-26' })).toThrow(/future/);
		expect(() => submit({ readOn: '2026-10-10' }, carolUser, carolT)).not.toThrow();
		expect(() => submit({ readOn: '2026-09-30' }, carolUser, carolT)).toThrow(
			/before you moved in/
		);
		setMeterRate(db, owner, propertyId, null);
		expect(() => submit()).toThrow(/not turned on/);
	});

	it('only works on the tenant’s own tenancy (same error as a missing one)', () => {
		expect(() => submit({}, aliceUser, carolT)).toThrow('Tenancy not found');
		expect(() => submit({}, aliceUser, 9999)).toThrow('Tenancy not found');
		// Bob has no portal account; his landlord's account is not a tenant of the stay either.
		expect(() => submit({}, owner, bobT)).toThrow('Tenancy not found');
	});
});

describe('landlord confirms or rejects', () => {
	it('bills the kWh since the last reading, split by nights in a shared room, exact to the sen', () => {
		const r = submit({ readingTenths: 11955 });
		const result = confirmReading(db, owner, r.id, TODAY);
		// 195.5 kWh x RM 0.55 = RM 107.525 -> 10753 sen; Alice 31 nights, Bob 16 nights (1 Oct to 1 Nov).
		expect(result.amountSen).toBe(10753);
		expect(result.usedTenths).toBe(1955);
		const charges = meterCharges();
		expect(charges.reduce((s, c) => s + c.amountSen, 0)).toBe(10753);
		const byTenancy = new Map(charges.map((c) => [c.tenancyId, c]));
		expect(byTenancy.get(aliceT)!.amountSen).toBe(7092);
		expect(byTenancy.get(bobT)!.amountSen).toBe(3661);
		expect(byTenancy.get(aliceT)!.description).toBe(
			'Electricity Room 1 2026-10-01 to 2026-11-01: 195.5 kWh at RM 0.55/kWh (31 nights)'
		);
		expect(byTenancy.get(aliceT)!.dueDate).toBe('2026-12-02');
		expect(byTenancy.get(carolT)).toBeUndefined();
		// The charge is on the tenant's ledger like any other.
		expect(tenancyLedger(db, owner, aliceT, TODAY).chargedSen).toBe(7092);
		expect(() => confirmReading(db, owner, r.id, TODAY)).toThrow(/already decided/);
	});

	it('bills a single occupant the whole amount', () => {
		recordReading(db, owner, otherRoomId, { readOn: '2026-10-01', readingTenths: 500 }, TODAY);
		const r = submit({ readOn: '2026-10-31', readingTenths: 2600 }, carolUser, carolT);
		expect(confirmReading(db, owner, r.id, TODAY).shares).toEqual([
			{ id: carolT, nights: 30, amountSen: 11550 }
		]);
		expect(meterCharges()[0].description).not.toMatch(/nights/);
	});

	it('treats the first confirmed reading of a room as the opening reading (nothing billed)', () => {
		const r = submit({ readOn: '2026-10-05', readingTenths: 400 }, carolUser, carolT);
		expect(confirmReading(db, owner, r.id, TODAY)).toEqual({
			amountSen: 0,
			usedTenths: null,
			shares: []
		});
		expect(meterCharges()).toHaveLength(0);
	});

	it('re-checks against readings confirmed after the tenant sent theirs', () => {
		const r = submit({ readOn: '2026-11-01', readingTenths: 12000 });
		db.delete(meterReading).where(eq(meterReading.id, r.id)).run();
		const late = submit({ readOn: '2026-10-20', readingTenths: 11000 });
		db.update(meterReading).set({ status: 'rejected' }).where(eq(meterReading.id, late.id)).run();
		recordReading(db, owner, roomId, { readOn: '2026-10-25', readingTenths: 11500 }, TODAY);
		db.update(meterReading).set({ status: 'pending' }).where(eq(meterReading.id, late.id)).run();
		expect(() => confirmReading(db, owner, late.id, TODAY)).toThrow(/after the last confirmed/);
	});

	it('needs a rate to bill and leaves nothing behind when it fails', () => {
		const r = submit();
		setMeterRate(db, owner, propertyId, null);
		expect(() => confirmReading(db, owner, r.id, TODAY)).toThrow(/Set the electricity rate/);
		expect(db.select().from(meterReading).where(eq(meterReading.id, r.id)).get()!.status).toBe(
			'pending'
		);
		expect(meterCharges()).toHaveLength(0);
	});

	it('rejects with a reason the tenant can see, and the tenant may send again', () => {
		const r = submit();
		expect(() => rejectReading(db, owner, r.id, '   ', TODAY)).toThrow(/reason/);
		expect(() => rejectReading(db, owner, r.id, 'x'.repeat(201), TODAY)).toThrow(/under 200/);
		rejectReading(db, owner, r.id, 'Photo is blurry', TODAY);
		const view = tenantMeter(db, aliceUser, aliceT);
		expect(view.readings[0]).toMatchObject({ status: 'rejected', rejectReason: 'Photo is blurry' });
		expect(view.pending).toBe(false);
		expect(() => rejectReading(db, owner, r.id, 'again', TODAY)).toThrow(/already decided/);
		expect(submit().status).toBe('pending');
	});

	it('another landlord cannot see, confirm, reject or record anything', () => {
		const r = submit();
		expect(() => confirmReading(db, other, r.id, TODAY)).toThrow('Reading not found');
		expect(() => rejectReading(db, other, r.id, 'no', TODAY)).toThrow('Reading not found');
		expect(() =>
			recordReading(db, other, roomId, { readOn: '2026-11-02', readingTenths: 1 }, TODAY)
		).toThrow('Room not found');
		expect(() => setMeterRate(db, other, propertyId, 6000)).toThrow('Property not found');
		expect(landlordMeters(db, other)).toEqual({ properties: [], pending: [], decided: [] });
	});
});

describe('landlord records a reading', () => {
	it('is confirmed and billed at once, and validated like a tenant reading', () => {
		expect(() =>
			recordReading(db, owner, roomId, { readOn: '2026-11-01', readingTenths: 9000 }, TODAY)
		).toThrow(/cannot be lower/);
		const r = recordReading(
			db,
			owner,
			roomId,
			{ readOn: '2026-11-01', readingTenths: 12100 },
			TODAY
		);
		expect(r.amountSen).toBe(11550);
		// The failed attempt left no row behind.
		expect(
			db
				.select()
				.from(meterReading)
				.all()
				.map((m) => m.status)
		).toEqual(['confirmed', 'confirmed']);
	});

	it('cannot jump the queue while a tenant reading waits', () => {
		submit();
		expect(() =>
			recordReading(db, owner, roomId, { readOn: '2026-11-02', readingTenths: 13200 }, TODAY)
		).toThrow(/waiting for this room/);
	});
});

describe('role isolation', () => {
	it('a tenant sees their own submissions and the room’s confirmed readings during the stay only', () => {
		// Bob's (made up) submission is rejected: Alice never sees it, nor its reason.
		db.insert(meterReading)
			.values({
				roomId,
				tenancyId: bobT,
				readOn: '2026-10-20',
				readingTenths: 10500,
				status: 'rejected',
				rejectReason: 'Bob private reason',
				submittedAt: new Date()
			})
			.run();
		recordReading(db, owner, otherRoomId, { readOn: '2026-10-02', readingTenths: 100 }, TODAY);
		const r = submit();
		confirmReading(db, owner, r.id, TODAY);
		const view = tenantMeter(db, aliceUser, aliceT);
		expect(view.readings.map((x) => [x.readOn, x.status, x.mine])).toEqual([
			['2026-11-01', 'confirmed', true],
			['2026-10-01', 'confirmed', false]
		]);
		expect(JSON.stringify(view)).not.toContain('Bob');
		// Only Alice's own share of the RM 170.50 room total (310 kWh) is shown, not the total.
		expect(view.readings[0]).toMatchObject({ shareSen: 11246, usedTenths: 3100 });
		expect(view.readings[0]).not.toHaveProperty('amountSen');
		expect(view.readings[1].shareSen).toBeNull();
		expect(view.lastConfirmed).toEqual({ readOn: '2026-11-01', readingTenths: 13100 });
		// Carol (another room) sees none of Room 1.
		expect(tenantMeter(db, carolUser, carolT).readings.map((x) => x.readOn)).toEqual([
			'2026-10-02'
		]);
		expect(() => tenantMeter(db, carolUser, aliceT)).toThrow('Tenancy not found');
	});
});

describe('photos', () => {
	it('detects JPEG, PNG and WebP by their bytes', () => {
		expect(photoType(PNG)).toBe('image/png');
		expect(photoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
		expect(photoType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
		expect(photoType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
	});

	it('validates uploads by size and content, not by the declared type', async () => {
		expect(await readPhoto(null)).toBeNull();
		expect(await readPhoto(new File([], 'empty.png'))).toBeNull();
		await expect(
			readPhoto(new File(['<html>'], 'x.png', { type: 'image/png' }))
		).rejects.toBeInstanceOf(RentalError);
		await expect(
			readPhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'big.jpg'))
		).rejects.toThrow(/too large/);
		expect((await readPhoto(new File([PNG], 'm.bin')))?.type).toBe('image/png');
	});

	it('only the submitting tenant and the property’s landlord can open a photo', () => {
		const r = submit({ photo: { type: 'image/png', bytes: PNG } });
		expect(tenantPhoto(db, aliceUser, r.id)).toEqual({ type: 'image/png', bytes: PNG });
		expect(landlordPhoto(db, owner, r.id)?.bytes).toEqual(PNG);
		expect(tenantPhoto(db, carolUser, r.id)).toBeNull();
		expect(landlordPhoto(db, other, r.id)).toBeNull();
		// Listings never carry the photo data.
		expect(JSON.stringify(landlordMeters(db, owner))).not.toContain('iVBOR');
		expect(landlordMeters(db, owner).pending[0]).toMatchObject({
			hasPhoto: true,
			estimateSen: 17050
		});
	});
});

describe('demo data', () => {
	it('seeds billed meter readings and one waiting for the landlord', async () => {
		db = createDb(':memory:');
		const { ownerId, tenancies } = await seedDemo(db, TODAY);
		const m = landlordMeters(db, ownerId);
		expect(m.pending).toHaveLength(1);
		expect(m.pending[0]).toMatchObject({
			tenantName: 'Aina Sofea',
			roomName: 'Master room',
			usedTenths: 1955,
			estimateSen: 10753,
			hasPhoto: true
		});
		expect(m.properties.map((p) => p.rate)).toEqual([5500, null]);
		const tan = tenancyLedger(db, ownerId, tenancies['Tan Wei Jie'], TODAY);
		expect(tan.charges.find((c) => c.meterReadingId !== null)?.amountSen).toBe(10043);
		// The waiting reading is confirmed like any other.
		expect(confirmReading(db, ownerId, m.pending[0].id, TODAY).amountSen).toBe(10753);
	});
});
