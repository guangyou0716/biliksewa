/**
 * Room sub-meter readings: a tenant submits the reading of their room's electricity meter (with an
 * optional photo), the landlord confirms or rejects it with a reason, and a confirmed reading bills the
 * kWh used since the previous confirmed reading at the property's rate. In a shared room the charge is
 * split over the tenants by the nights each stayed in that period, exactly to the sen.
 * The first confirmed reading of a room is its opening reading and bills nothing.
 */
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { splitByNights } from '../billing';
import { addDays, monthOf, overlapNights, toDayNumber } from '../dates';
import { formatKwh, formatRate, MAX_KWH_PER_DAY, MAX_RATE, meterChargeSen } from '../meter';
import type { DB } from './db/client';
import { bed, charge, meterReading, property, room, tenancy, tenant } from './db/schema';
import { RentalError } from './rentals';

export const MAX_PHOTO_BYTES = 300_000;
const MAX_REASON = 200;
/** Days a tenant gets to pay an electricity charge after the landlord confirms the reading. */
export const METER_DUE_DAYS = 7;

export type PhotoType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface Photo {
	type: PhotoType;
	bytes: Uint8Array;
}

/** Columns safe to list (everything except the photo data). */
const listColumns = {
	id: meterReading.id,
	roomId: meterReading.roomId,
	tenancyId: meterReading.tenancyId,
	readOn: meterReading.readOn,
	readingTenths: meterReading.readingTenths,
	status: meterReading.status,
	rejectReason: meterReading.rejectReason,
	hasPhoto: sql<number>`${meterReading.photoType} is not null`.mapWith(Boolean),
	decidedOn: meterReading.decidedOn,
	usedTenths: meterReading.usedTenths,
	rate: meterReading.rate,
	amountSen: meterReading.amountSen
};

// ---------- photo ----------

/** Detects JPEG, PNG or WebP from the file's first bytes (the browser-sent type is not trusted). */
export function photoType(bytes: Uint8Array): PhotoType | null {
	const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
	if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
	return null;
}

/** Validates an uploaded photo. Returns null for "no photo". */
export async function readPhoto(file: File | null): Promise<Photo | null> {
	if (!file || file.size === 0) return null;
	if (file.size > MAX_PHOTO_BYTES)
		throw new RentalError('err.photoTooLarge', { kb: MAX_PHOTO_BYTES / 1000 });
	const bytes = new Uint8Array(await file.arrayBuffer());
	const type = photoType(bytes);
	if (!type) throw new RentalError('err.photoType');
	return { type, bytes };
}

// ---------- shared checks ----------

function latestConfirmed(db: DB, roomId: number) {
	return (
		db
			.select(listColumns)
			.from(meterReading)
			.where(and(eq(meterReading.roomId, roomId), eq(meterReading.status, 'confirmed')))
			.orderBy(desc(meterReading.readOn))
			.get() ?? null
	);
}

/** Checks a new reading against the room's latest confirmed one; returns the kWh used (tenths). */
function checkAgainstPrevious(
	prev: { readOn: string; readingTenths: number } | null,
	readOn: string,
	readingTenths: number
): number | null {
	if (!prev) return null;
	if (readOn <= prev.readOn) throw new RentalError('err.readingDateOrder', { date: prev.readOn });
	if (readingTenths < prev.readingTenths)
		throw new RentalError('err.readingLower', { kwh: formatKwh(prev.readingTenths) });
	const used = readingTenths - prev.readingTenths;
	const days = toDayNumber(readOn) - toDayNumber(prev.readOn);
	if (used > days * MAX_KWH_PER_DAY * 10)
		throw new RentalError('err.readingTooHigh', {
			kwh: formatKwh(used),
			days,
			max: MAX_KWH_PER_DAY
		});
	return used;
}

function checkInput(readOn: string, readingTenths: number, today: string) {
	if (readOn > today) throw new RentalError('err.readingFuture');
	if (!Number.isSafeInteger(readingTenths) || readingTenths < 0)
		throw new RentalError('err.readingFormat');
}

function photoColumns(photo: Photo | null) {
	return photo
		? { photoType: photo.type, photo: Buffer.from(photo.bytes).toString('base64') }
		: { photoType: null, photo: null };
}

// ---------- tenant side ----------

/** The signed-in tenant's tenancy, with its room and property. Same error for missing and not theirs. */
function tenantStay(db: DB, userId: number, tenancyId: number) {
	const row = db
		.select({ tenancy, roomId: room.id, rate: property.meterRate })
		.from(tenancy)
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(and(eq(tenancy.id, tenancyId), eq(tenant.userId, userId)))
		.get();
	if (!row) throw new RentalError('err.tenancyNotFound');
	return row;
}

export function submitReading(
	db: DB,
	userId: number,
	tenancyId: number,
	input: { readOn: string; readingTenths: number; photo: Photo | null },
	today: string,
	now = Date.now()
) {
	const stay = tenantStay(db, userId, tenancyId);
	if (stay.rate === null) throw new RentalError('err.metersOff');
	checkInput(input.readOn, input.readingTenths, today);
	if (input.readOn < stay.tenancy.startDate) throw new RentalError('err.readingBeforeMoveIn');
	if (stay.tenancy.endDate && input.readOn > stay.tenancy.endDate)
		throw new RentalError('err.readingAfterMoveOut');
	return db.transaction((tx) => {
		checkAgainstPrevious(latestConfirmed(tx, stay.roomId), input.readOn, input.readingTenths);
		const waiting = tx
			.select({ id: meterReading.id })
			.from(meterReading)
			.where(and(eq(meterReading.roomId, stay.roomId), eq(meterReading.status, 'pending')))
			.get();
		if (waiting) throw new RentalError('err.readingPending');
		return tx
			.insert(meterReading)
			.values({
				roomId: stay.roomId,
				tenancyId,
				readOn: input.readOn,
				readingTenths: input.readingTenths,
				status: 'pending',
				submittedAt: new Date(now),
				...photoColumns(input.photo)
			})
			.returning(listColumns)
			.get();
	});
}

/**
 * Meter readings the tenant may see for one of their stays: their own submissions (with reject reasons)
 * and the room's confirmed readings during the stay. Housemates' names and rejected readings are hidden.
 */
export function tenantMeter(db: DB, userId: number, tenancyId: number) {
	const stay = tenantStay(db, userId, tenancyId);
	const t = stay.tenancy;
	const during = and(
		sql`${meterReading.readOn} >= ${t.startDate}`,
		t.endDate ? sql`${meterReading.readOn} <= ${t.endDate}` : undefined
	);
	const readings = db
		.select(listColumns)
		.from(meterReading)
		.where(
			and(
				eq(meterReading.roomId, stay.roomId),
				or(eq(meterReading.tenancyId, tenancyId), and(eq(meterReading.status, 'confirmed'), during))
			)
		)
		.orderBy(desc(meterReading.readOn), desc(meterReading.id))
		.all();
	// The tenant's own share of each billed reading (housemates' shares are not shown).
	const shares = new Map(
		readings.length
			? db
					.select({ readingId: charge.meterReadingId, amountSen: charge.amountSen })
					.from(charge)
					.where(
						and(
							eq(charge.tenancyId, tenancyId),
							inArray(
								charge.meterReadingId,
								readings.map((r) => r.id)
							)
						)
					)
					.all()
					.map((c) => [c.readingId, c.amountSen])
			: []
	);
	const visible = readings.map((r) => ({
		id: r.id,
		readOn: r.readOn,
		readingTenths: r.readingTenths,
		status: r.status,
		rejectReason: r.rejectReason,
		hasPhoto: r.hasPhoto,
		usedTenths: r.usedTenths,
		mine: r.tenancyId === tenancyId,
		/** The room's total stays hidden: a tenant only sees what they were charged. */
		shareSen: shares.get(r.id) ?? null
	}));
	const last = latestConfirmed(db, stay.roomId);
	return {
		enabled: stay.rate !== null,
		rate: stay.rate,
		lastConfirmed: last && { readOn: last.readOn, readingTenths: last.readingTenths },
		/** Any reading waiting in this room (a housemate's too), since a room has one at a time. */
		pending: !!db
			.select({ id: meterReading.id })
			.from(meterReading)
			.where(and(eq(meterReading.roomId, stay.roomId), eq(meterReading.status, 'pending')))
			.get(),
		readings: visible
	};
}

/** A reading photo the signed-in tenant submitted themselves, or null. */
export function tenantPhoto(db: DB, userId: number, readingId: number) {
	const row = db
		.select({ photoType: meterReading.photoType, photo: meterReading.photo })
		.from(meterReading)
		.innerJoin(tenancy, eq(meterReading.tenancyId, tenancy.id))
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.where(and(eq(meterReading.id, readingId), eq(tenant.userId, userId)))
		.get();
	return decodePhoto(row);
}

// ---------- landlord side ----------

function ownedRoomWithRate(db: DB, ownerId: number, roomId: number) {
	const row = db
		.select({ roomId: room.id, roomName: room.name, rate: property.meterRate })
		.from(room)
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(and(eq(room.id, roomId), eq(property.ownerId, ownerId)))
		.get();
	if (!row) throw new RentalError('err.roomNotFound');
	return row;
}

function ownedReading(db: DB, ownerId: number, readingId: number) {
	const row = db
		.select({ reading: listColumns, roomName: room.name, rate: property.meterRate })
		.from(meterReading)
		.innerJoin(room, eq(meterReading.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(and(eq(meterReading.id, readingId), eq(property.ownerId, ownerId)))
		.get();
	if (!row) throw new RentalError('err.readingNotFound');
	return row;
}

/** Sets the property's electricity rate (sen per kWh x 100); null turns meter readings off. */
export function setMeterRate(db: DB, ownerId: number, propertyId: number, rate: number | null) {
	if (rate !== null && (!Number.isSafeInteger(rate) || rate <= 0 || rate > MAX_RATE))
		throw new RentalError('err.rateRange');
	const updated = db
		.update(property)
		.set({ meterRate: rate })
		.where(and(eq(property.id, propertyId), eq(property.ownerId, ownerId)))
		.returning({ id: property.id })
		.all();
	if (!updated.length) throw new RentalError('err.propertyNotFound');
}

/**
 * Bills a reading being confirmed: the kWh since the previous confirmed reading at `rate`, split over
 * the tenants who stayed in the room in that period by nights. Must run inside a transaction.
 */
function bill(
	tx: DB,
	r: { id: number; roomId: number; readOn: string; readingTenths: number },
	roomName: string,
	rate: number | null,
	today: string
) {
	const prev = latestConfirmed(tx, r.roomId);
	const used = checkAgainstPrevious(prev, r.readOn, r.readingTenths);
	const decided = { status: 'confirmed' as const, decidedOn: today, rejectReason: null };
	if (prev === null || used === null) {
		// Opening reading: nothing to bill yet.
		tx.update(meterReading).set(decided).where(eq(meterReading.id, r.id)).run();
		return { amountSen: 0, usedTenths: null, shares: [] };
	}
	if (rate === null) throw new RentalError('err.setRateFirst');
	const amountSen = meterChargeSen(used, rate);
	tx.update(meterReading)
		.set({ ...decided, usedTenths: used, rate, amountSen })
		.where(eq(meterReading.id, r.id))
		.run();
	const stays = tx
		.select({ tenancy })
		.from(tenancy)
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.where(eq(bed.roomId, r.roomId))
		.all()
		.map(({ tenancy: t }) => ({
			id: t.id,
			nights: overlapNights(t.startDate, t.endDate, prev.readOn, r.readOn)
		}));
	// Nobody stayed in the period (an empty room): the landlord bears it, nobody is charged.
	if (amountSen === 0 || stays.every((s) => s.nights === 0))
		return { amountSen, usedTenths: used, shares: [] };
	const shares = splitByNights(amountSen, stays);
	for (const s of shares) {
		tx.insert(charge)
			.values({
				tenancyId: s.id,
				kind: 'utility',
				period: monthOf(r.readOn),
				description: `Electricity ${roomName} ${prev.readOn} to ${r.readOn}: ${formatKwh(used)} at ${formatRate(rate)}${shares.length > 1 ? ` (${s.nights} nights)` : ''}`,
				amountSen: s.amountSen,
				dueDate: addDays(today, METER_DUE_DAYS),
				meterReadingId: r.id
			})
			.run();
	}
	return { amountSen, usedTenths: used, shares };
}

export function confirmReading(
	db: DB,
	ownerId: number,
	readingId: number,
	today: string
): { amountSen: number; usedTenths: number | null; shares: { id: number; amountSen: number }[] } {
	const { reading, roomName } = ownedReading(db, ownerId, readingId);
	return db.transaction((tx) => {
		const current = ownedReading(tx, ownerId, readingId);
		if (current.reading.status !== 'pending') throw new RentalError('err.readingDecided');
		return bill(tx, reading, roomName, current.rate, today);
	});
}

export function rejectReading(
	db: DB,
	ownerId: number,
	readingId: number,
	reason: string,
	today: string
) {
	const { reading } = ownedReading(db, ownerId, readingId);
	const why = reason.trim();
	if (!why) throw new RentalError('err.rejectReason');
	if (why.length > MAX_REASON) throw new RentalError('err.reasonLong', { max: MAX_REASON });
	if (reading.status !== 'pending') throw new RentalError('err.readingDecided');
	db.update(meterReading)
		.set({ status: 'rejected', rejectReason: why, decidedOn: today })
		.where(and(eq(meterReading.id, readingId), eq(meterReading.status, 'pending')))
		.run();
}

/** A reading the landlord took themselves (e.g. at move-in): confirmed and billed straight away. */
export function recordReading(
	db: DB,
	ownerId: number,
	roomId: number,
	input: { readOn: string; readingTenths: number },
	today: string,
	now = Date.now()
) {
	const r = ownedRoomWithRate(db, ownerId, roomId);
	checkInput(input.readOn, input.readingTenths, today);
	return db.transaction((tx) => {
		if (
			tx
				.select({ id: meterReading.id })
				.from(meterReading)
				.where(and(eq(meterReading.roomId, roomId), eq(meterReading.status, 'pending')))
				.get()
		)
			throw new RentalError('err.confirmPendingFirst');
		// Validated (and billed) before the row exists, so a rejected input leaves nothing behind.
		const used = checkAgainstPrevious(
			latestConfirmed(tx, roomId),
			input.readOn,
			input.readingTenths
		);
		if (used !== null && r.rate === null) throw new RentalError('err.setRateFirst');
		const row = tx
			.insert(meterReading)
			.values({
				roomId,
				tenancyId: null,
				readOn: input.readOn,
				readingTenths: input.readingTenths,
				status: 'pending',
				submittedAt: new Date(now)
			})
			.returning({ id: meterReading.id })
			.get();
		return bill(
			tx,
			{ id: row.id, roomId, readOn: input.readOn, readingTenths: input.readingTenths },
			r.roomName,
			r.rate,
			today
		);
	});
}

/** Everything the landlord's meter page shows: rates, rooms, waiting readings and recent decisions. */
export function landlordMeters(db: DB, ownerId: number, recent = 20) {
	const props = db
		.select({ id: property.id, name: property.name, rate: property.meterRate })
		.from(property)
		.where(eq(property.ownerId, ownerId))
		.orderBy(property.name)
		.all();
	const rooms = props.length
		? db
				.select({ id: room.id, name: room.name, propertyId: room.propertyId })
				.from(room)
				.where(
					inArray(
						room.propertyId,
						props.map((p) => p.id)
					)
				)
				.orderBy(room.name)
				.all()
		: [];
	const roomIds = rooms.map((r) => r.id);
	const rows = roomIds.length
		? db
				.select({ reading: listColumns, tenantName: tenant.name })
				.from(meterReading)
				.leftJoin(tenancy, eq(meterReading.tenancyId, tenancy.id))
				.leftJoin(tenant, eq(tenancy.tenantId, tenant.id))
				.where(inArray(meterReading.roomId, roomIds))
				.orderBy(desc(meterReading.readOn), desc(meterReading.id))
				.all()
		: [];
	const roomInfo = new Map(rooms.map((r) => [r.id, r]));
	const propInfo = new Map(props.map((p) => [p.id, p]));
	const lastByRoom = new Map<number, (typeof rows)[number]['reading']>();
	for (const r of rows)
		if (r.reading.status === 'confirmed' && !lastByRoom.has(r.reading.roomId))
			lastByRoom.set(r.reading.roomId, r.reading);
	const view = (r: (typeof rows)[number]) => {
		const rm = roomInfo.get(r.reading.roomId)!;
		return {
			...r.reading,
			tenantName: r.tenantName,
			roomName: rm.name,
			propertyName: propInfo.get(rm.propertyId)!.name
		};
	};
	return {
		properties: props.map((p) => ({
			...p,
			rooms: rooms
				.filter((r) => r.propertyId === p.id)
				.map((r) => ({ ...r, last: lastByRoom.get(r.id) ?? null }))
		})),
		pending: rows
			.filter((r) => r.reading.status === 'pending')
			.map((r) => {
				const last = lastByRoom.get(r.reading.roomId) ?? null;
				const rate = propInfo.get(roomInfo.get(r.reading.roomId)!.propertyId)!.rate;
				const usedTenths = last ? r.reading.readingTenths - last.readingTenths : null;
				return {
					...view(r),
					last,
					usedTenths,
					estimateSen:
						usedTenths !== null && usedTenths >= 0 && rate !== null
							? meterChargeSen(usedTenths, rate)
							: null
				};
			}),
		decided: rows
			.filter((r) => r.reading.status !== 'pending')
			.slice(0, recent)
			.map(view)
	};
}

/** A reading photo from one of the landlord's rooms, or null. */
export function landlordPhoto(db: DB, ownerId: number, readingId: number) {
	const row = db
		.select({ photoType: meterReading.photoType, photo: meterReading.photo })
		.from(meterReading)
		.innerJoin(room, eq(meterReading.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(and(eq(meterReading.id, readingId), eq(property.ownerId, ownerId)))
		.get();
	return decodePhoto(row);
}

function decodePhoto(row: { photoType: string | null; photo: string | null } | undefined) {
	if (!row?.photoType || !row.photo) return null;
	return { type: row.photoType, bytes: new Uint8Array(Buffer.from(row.photo, 'base64')) };
}

/** Response headers for serving a stored photo: never rendered as anything but an image. */
export function photoHeaders(type: string): Record<string, string> {
	return {
		'Content-Type': type,
		'Cache-Control': 'private, no-store',
		'Content-Security-Policy': "default-src 'none'; sandbox",
		'X-Content-Type-Options': 'nosniff'
	};
}
