import { and, asc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { allocatePayments, overdueSen, proratedRent, splitByNights } from '../billing';
import { addDays, monthOf, monthRange, overlapNights, staysOverlap } from '../dates';
import type { DB } from './db/client';
import { bed, charge, payment, property, room, tenancy, tenant, utilityBill } from './db/schema';

/** Thrown for user-facing validation problems; routes turn it into a 400 form error. */
export class RentalError extends Error {}

// ---------- ownership guards (every read/write is scoped to the signed-in landlord) ----------

function ownedProperty(db: DB, ownerId: number, propertyId: number) {
	const row = db
		.select()
		.from(property)
		.where(and(eq(property.id, propertyId), eq(property.ownerId, ownerId)))
		.get();
	if (!row) throw new RentalError('Property not found');
	return row;
}

function ownedRoom(db: DB, ownerId: number, roomId: number) {
	const row = db
		.select({ room })
		.from(room)
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(and(eq(room.id, roomId), eq(property.ownerId, ownerId)))
		.get();
	if (!row) throw new RentalError('Room not found');
	return row.room;
}

function ownedBed(db: DB, ownerId: number, bedId: number) {
	const row = db
		.select({ bed, room, property })
		.from(bed)
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(and(eq(bed.id, bedId), eq(property.ownerId, ownerId)))
		.get();
	if (!row) throw new RentalError('Bed not found');
	return row;
}

export function ownedTenancy(db: DB, ownerId: number, tenancyId: number) {
	const row = db
		.select({ tenancy, tenant, bed, room, property })
		.from(tenancy)
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(and(eq(tenancy.id, tenancyId), eq(property.ownerId, ownerId)))
		.get();
	if (!row) throw new RentalError('Tenancy not found');
	return row;
}

// ---------- properties, rooms, beds ----------

export function addProperty(db: DB, ownerId: number, input: { name: string; area: string }) {
	const name = input.name.trim();
	const area = input.area.trim();
	if (!name || !area) throw new RentalError('Name and area are required');
	return db.insert(property).values({ ownerId, name, area }).returning().get();
}

export function addRoom(db: DB, ownerId: number, propertyId: number, name: string) {
	ownedProperty(db, ownerId, propertyId);
	const trimmed = name.trim();
	if (!trimmed) throw new RentalError('Room name is required');
	const clash = db
		.select({ id: room.id })
		.from(room)
		.where(and(eq(room.propertyId, propertyId), eq(room.name, trimmed)))
		.get();
	if (clash) throw new RentalError(`Room "${trimmed}" already exists`);
	return db.insert(room).values({ propertyId, name: trimmed }).returning().get();
}

export function addBed(
	db: DB,
	ownerId: number,
	roomId: number,
	input: { label: string; defaultRentSen: number }
) {
	ownedRoom(db, ownerId, roomId);
	const label = input.label.trim();
	if (!label) throw new RentalError('Bed label is required');
	if (!(input.defaultRentSen > 0)) throw new RentalError('Rent must be more than RM 0');
	const clash = db
		.select({ id: bed.id })
		.from(bed)
		.where(and(eq(bed.roomId, roomId), eq(bed.label, label)))
		.get();
	if (clash) throw new RentalError(`Bed "${label}" already exists in this room`);
	return db
		.insert(bed)
		.values({ roomId, label, defaultRentSen: input.defaultRentSen })
		.returning()
		.get();
}

export interface BedView {
	id: number;
	label: string;
	defaultRentSen: number;
	occupant: { tenancyId: number; tenantName: string; startDate: string; rentSen: number } | null;
}

export function listProperties(db: DB, ownerId: number, today: string) {
	const props = db
		.select()
		.from(property)
		.where(eq(property.ownerId, ownerId))
		.orderBy(asc(property.name))
		.all();
	return props.map((p) => {
		const beds = propertyBoard(db, ownerId, p.id, today).rooms.flatMap((r) => r.beds);
		return {
			...p,
			beds: beds.length,
			occupied: beds.filter((b) => b.occupant).length
		};
	});
}

/** Rooms and beds of one property with whoever is staying on `today`. */
export function propertyBoard(db: DB, ownerId: number, propertyId: number, today: string) {
	const prop = ownedProperty(db, ownerId, propertyId);
	const rooms = db
		.select()
		.from(room)
		.where(eq(room.propertyId, propertyId))
		.orderBy(asc(room.name))
		.all();
	const roomIds = rooms.map((r) => r.id);
	const beds = roomIds.length
		? db.select().from(bed).where(inArray(bed.roomId, roomIds)).orderBy(asc(bed.label)).all()
		: [];
	const bedIds = beds.map((b) => b.id);
	const current = bedIds.length
		? db
				.select({ tenancy, tenantName: tenant.name })
				.from(tenancy)
				.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
				.where(
					and(
						inArray(tenancy.bedId, bedIds),
						sql`${tenancy.startDate} <= ${today}`,
						or(isNull(tenancy.endDate), gt(tenancy.endDate, today))
					)
				)
				.all()
		: [];
	const byBed = new Map(current.map((c) => [c.tenancy.bedId, c]));
	return {
		property: prop,
		rooms: rooms.map((r) => ({
			...r,
			beds: beds
				.filter((b) => b.roomId === r.id)
				.map((b): BedView => {
					const c = byBed.get(b.id);
					return {
						id: b.id,
						label: b.label,
						defaultRentSen: b.defaultRentSen,
						occupant: c
							? {
									tenancyId: c.tenancy.id,
									tenantName: c.tenantName,
									startDate: c.tenancy.startDate,
									rentSen: c.tenancy.monthlyRentSen
								}
							: null
					};
				})
		}))
	};
}

export function bedForMoveIn(db: DB, ownerId: number, bedId: number) {
	return ownedBed(db, ownerId, bedId);
}

// ---------- tenancies ----------

export function moveIn(
	db: DB,
	ownerId: number,
	input: {
		bedId: number;
		tenantName: string;
		tenantEmail?: string | null;
		startDate: string;
		monthlyRentSen: number;
		depositSen: number;
	}
) {
	ownedBed(db, ownerId, input.bedId);
	const name = input.tenantName.trim();
	if (!name) throw new RentalError('Tenant name is required');
	if (!(input.monthlyRentSen > 0)) throw new RentalError('Rent must be more than RM 0');
	if (input.depositSen < 0) throw new RentalError('Deposit cannot be negative');

	return db.transaction((tx) => {
		const existing = tx.select().from(tenancy).where(eq(tenancy.bedId, input.bedId)).all();
		const clash = existing.find((t) => staysOverlap(t.startDate, t.endDate, input.startDate, null));
		if (clash) throw new RentalError('This bed is already taken on or after that date');
		const t = tx
			.insert(tenant)
			.values({ ownerId, name, email: input.tenantEmail?.trim() || null })
			.returning()
			.get();
		return tx
			.insert(tenancy)
			.values({
				bedId: input.bedId,
				tenantId: t.id,
				startDate: input.startDate,
				monthlyRentSen: input.monthlyRentSen,
				depositSen: input.depositSen
			})
			.returning()
			.get();
	});
}

export function moveOut(db: DB, ownerId: number, tenancyId: number, endDate: string) {
	const { tenancy: t } = ownedTenancy(db, ownerId, tenancyId);
	if (t.endDate) throw new RentalError('Tenant has already moved out');
	if (endDate <= t.startDate) throw new RentalError('Move-out must be after the move-in date');
	db.transaction((tx) => {
		tx.update(tenancy).set({ endDate }).where(eq(tenancy.id, tenancyId)).run();
		// Rent already billed for the move-out month or later is re-pro-rated to the nights actually stayed.
		const rents = tx
			.select()
			.from(charge)
			.where(
				and(
					eq(charge.tenancyId, tenancyId),
					eq(charge.kind, 'rent'),
					gte(charge.period, monthOf(endDate))
				)
			)
			.all();
		for (const c of rents) {
			const amountSen = proratedRent(t.monthlyRentSen, c.period, t.startDate, endDate);
			if (amountSen === 0) tx.delete(charge).where(eq(charge.id, c.id)).run();
			else if (amountSen !== c.amountSen)
				tx.update(charge).set({ amountSen }).where(eq(charge.id, c.id)).run();
		}
	});
}

export function listTenancies(db: DB, ownerId: number, today: string) {
	const rows = db
		.select({
			tenancy,
			tenantName: tenant.name,
			bedLabel: bed.label,
			roomName: room.name,
			propertyName: property.name
		})
		.from(tenancy)
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(eq(property.ownerId, ownerId))
		.orderBy(asc(tenant.name))
		.all();
	return rows.map((r) => {
		const balance = balances(db, r.tenancy.id, today);
		return {
			id: r.tenancy.id,
			tenantName: r.tenantName,
			where: `${r.propertyName} · ${r.roomName} · ${r.bedLabel}`,
			startDate: r.tenancy.startDate,
			endDate: r.tenancy.endDate,
			active: r.tenancy.endDate === null || r.tenancy.endDate > today,
			...balance
		};
	});
}

function balances(db: DB, tenancyId: number, today: string) {
	const charges = db
		.select({ id: charge.id, amountSen: charge.amountSen, dueDate: charge.dueDate })
		.from(charge)
		.where(eq(charge.tenancyId, tenancyId))
		.all();
	const paidSen = db
		.select({ total: sql<number>`coalesce(sum(${payment.amountSen}), 0)` })
		.from(payment)
		.where(eq(payment.tenancyId, tenancyId))
		.get()!.total;
	const chargedSen = charges.reduce((s, c) => s + c.amountSen, 0);
	return {
		chargedSen,
		paidSen,
		balanceSen: chargedSen - paidSen,
		overdueSen: overdueSen(charges, paidSen, today)
	};
}

export function tenancyLedger(db: DB, ownerId: number, tenancyId: number, today: string) {
	return { ...ownedTenancy(db, ownerId, tenancyId), ...ledgerEntries(db, tenancyId, today) };
}

/**
 * Charges (with what is still unpaid on each), payments and totals of one tenancy.
 * Does no access check: callers must first prove the tenancy belongs to the signed-in user.
 */
export function ledgerEntries(db: DB, tenancyId: number, today: string) {
	const charges = db
		.select()
		.from(charge)
		.where(eq(charge.tenancyId, tenancyId))
		.orderBy(asc(charge.dueDate), asc(charge.id))
		.all();
	const payments = db
		.select()
		.from(payment)
		.where(eq(payment.tenancyId, tenancyId))
		.orderBy(asc(payment.paidOn), asc(payment.id))
		.all();
	const totals = balances(db, tenancyId, today);
	const unpaid = new Map(allocatePayments(charges, totals.paidSen).map((c) => [c.id, c.unpaidSen]));
	return {
		charges: charges.map((c) => ({ ...c, unpaidSen: unpaid.get(c.id) ?? 0 })),
		payments,
		...totals
	};
}

export function recordPayment(
	db: DB,
	ownerId: number,
	tenancyId: number,
	input: {
		amountSen: number;
		paidOn: string;
		method: 'cash' | 'bank_transfer' | 'other';
		reference?: string | null;
	}
) {
	ownedTenancy(db, ownerId, tenancyId);
	if (!(input.amountSen > 0)) throw new RentalError('Payment must be more than RM 0');
	return db
		.insert(payment)
		.values({
			tenancyId,
			amountSen: input.amountSen,
			paidOn: input.paidOn,
			method: input.method,
			reference: input.reference?.trim() || null
		})
		.returning()
		.get();
}

// ---------- billing ----------

function ownerTenancies(db: DB, ownerId: number, propertyId?: number) {
	return db
		.select({
			tenancy,
			tenantName: tenant.name,
			rentDueDay: property.rentDueDay,
			propertyId: property.id
		})
		.from(tenancy)
		.innerJoin(tenant, eq(tenancy.tenantId, tenant.id))
		.innerJoin(bed, eq(tenancy.bedId, bed.id))
		.innerJoin(room, eq(bed.roomId, room.id))
		.innerJoin(property, eq(room.propertyId, property.id))
		.where(
			propertyId === undefined
				? eq(property.ownerId, ownerId)
				: and(eq(property.ownerId, ownerId), eq(property.id, propertyId))
		)
		.all();
}

/**
 * Creates the rent charge for `period` for every tenancy that stayed at least one night in it.
 * Partial months are pro-rated. Running it again for the same month creates nothing new.
 */
export function generateRent(db: DB, ownerId: number, period: string) {
	const { start, endExclusive } = monthRange(period);
	// better-sqlite3 is synchronous, so nothing can interleave between this read and the transaction.
	const rows = ownerTenancies(db, ownerId);
	return db.transaction((tx) => {
		let created = 0;
		let skipped = 0;
		let totalSen = 0;
		for (const row of rows) {
			const t = row.tenancy;
			if (overlapNights(t.startDate, t.endDate, start, endExclusive) === 0) continue;
			const amountSen = proratedRent(t.monthlyRentSen, period, t.startDate, t.endDate);
			const due = `${period}-${String(row.rentDueDay).padStart(2, '0')}`;
			const inserted = tx
				.insert(charge)
				.values({
					tenancyId: t.id,
					kind: 'rent',
					period,
					description: `Rent ${period}`,
					amountSen,
					dueDate: due
				})
				.onConflictDoNothing()
				.returning({ id: charge.id })
				.all();
			if (inserted.length) {
				created += 1;
				totalSen += amountSen;
			} else {
				skipped += 1;
			}
		}
		return { created, skipped, totalSen };
	});
}

/** Preview of how a house bill would be split, without saving anything. */
export function previewUtilitySplit(
	db: DB,
	ownerId: number,
	input: { propertyId: number; amountSen: number; fromDate: string; toDate: string }
) {
	ownedProperty(db, ownerId, input.propertyId);
	if (input.toDate < input.fromDate) throw new RentalError('Bill period ends before it starts');
	if (!(input.amountSen > 0)) throw new RentalError('Bill amount must be more than RM 0');
	const toExclusive = addDays(input.toDate, 1);
	const rows = ownerTenancies(db, ownerId, input.propertyId);
	const stays = rows.map((r) => ({
		id: r.tenancy.id,
		nights: overlapNights(r.tenancy.startDate, r.tenancy.endDate, input.fromDate, toExclusive)
	}));
	let shares;
	try {
		shares = splitByNights(input.amountSen, stays);
	} catch (e) {
		throw new RentalError((e as Error).message);
	}
	const names = new Map(rows.map((r) => [r.tenancy.id, r.tenantName]));
	return shares.map((s) => ({ ...s, tenantName: names.get(s.id) ?? '' }));
}

export function splitUtilityBill(
	db: DB,
	ownerId: number,
	input: {
		propertyId: number;
		label: string;
		amountSen: number;
		fromDate: string;
		toDate: string;
		dueDate: string;
	}
) {
	const label = input.label.trim();
	if (!label) throw new RentalError('Bill label is required');
	const shares = previewUtilitySplit(db, ownerId, input);
	const duplicate = db
		.select({ id: utilityBill.id })
		.from(utilityBill)
		.where(
			and(
				eq(utilityBill.propertyId, input.propertyId),
				eq(utilityBill.label, label),
				eq(utilityBill.fromDate, input.fromDate),
				eq(utilityBill.toDate, input.toDate)
			)
		)
		.get();
	if (duplicate)
		throw new RentalError(`${label} for ${input.fromDate} to ${input.toDate} was already split`);
	return db.transaction((tx) => {
		const bill = tx
			.insert(utilityBill)
			.values({
				propertyId: input.propertyId,
				label,
				amountSen: input.amountSen,
				fromDate: input.fromDate,
				toDate: input.toDate
			})
			.returning()
			.get();
		for (const s of shares) {
			tx.insert(charge)
				.values({
					tenancyId: s.id,
					kind: 'utility',
					period: monthOf(input.toDate),
					description: `${label} ${input.fromDate} to ${input.toDate} (${s.nights} nights)`,
					amountSen: s.amountSen,
					dueDate: input.dueDate,
					utilityBillId: bill.id
				})
				.run();
		}
		return { bill, shares };
	});
}

// ---------- dashboard ----------

export function dashboard(db: DB, ownerId: number, today: string) {
	const period = monthOf(today);
	const props = listProperties(db, ownerId, today);
	const beds = props.reduce((s, p) => s + p.beds, 0);
	const occupied = props.reduce((s, p) => s + p.occupied, 0);
	const tenancies = listTenancies(db, ownerId, today);
	const ids = tenancies.map((t) => t.id);
	const billedSen = ids.length
		? db
				.select({ total: sql<number>`coalesce(sum(${charge.amountSen}), 0)` })
				.from(charge)
				.where(and(inArray(charge.tenancyId, ids), eq(charge.period, period)))
				.get()!.total
		: 0;
	const { start, endExclusive } = monthRange(period);
	const collectedSen = ids.length
		? db
				.select({ total: sql<number>`coalesce(sum(${payment.amountSen}), 0)` })
				.from(payment)
				.where(
					and(
						inArray(payment.tenancyId, ids),
						sql`${payment.paidOn} >= ${start}`,
						sql`${payment.paidOn} < ${endExclusive}`
					)
				)
				.get()!.total
		: 0;
	return {
		period,
		beds,
		occupied,
		vacant: beds - occupied,
		billedSen,
		collectedSen,
		outstandingSen: tenancies.reduce((s, t) => s + Math.max(t.balanceSen, 0), 0),
		overdue: tenancies.filter((t) => t.overdueSen > 0).sort((a, b) => b.overdueSen - a.overdueSen),
		properties: props
	};
}
