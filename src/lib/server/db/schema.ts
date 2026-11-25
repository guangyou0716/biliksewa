import { sql } from 'drizzle-orm';
import {
	type AnySQLiteColumn,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

/**
 * Sign-in accounts. Landlords own properties; a tenant account is linked to exactly one tenant
 * record (see `tenant.userId`) and can only see that tenant's own ledger.
 */
export const user = sqliteTable('user', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['landlord', 'tenant'] })
		.notNull()
		.default('landlord')
});

/** Only the SHA-256 of the session token is stored, so a leaked database cannot be replayed as cookies. */
export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

export const property = sqliteTable(
	'property',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		area: text('area').notNull(),
		/** Day of month rent is due (1-28). */
		rentDueDay: integer('rent_due_day').notNull().default(7),
		/**
		 * Electricity rate for room sub-meters in sen per kWh x 100 (RM 0.55/kWh = 5500).
		 * Null = meter readings are off for this property.
		 */
		meterRate: integer('meter_rate')
	},
	(t) => [index('property_owner_idx').on(t.ownerId)]
);

export const room = sqliteTable(
	'room',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		propertyId: integer('property_id')
			.notNull()
			.references(() => property.id, { onDelete: 'cascade' }),
		name: text('name').notNull()
	},
	(t) => [uniqueIndex('room_property_name_uq').on(t.propertyId, t.name)]
);

export const bed = sqliteTable(
	'bed',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		roomId: integer('room_id')
			.notNull()
			.references(() => room.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		/** Suggested monthly rent in sen. */
		defaultRentSen: integer('default_rent_sen').notNull()
	},
	(t) => [uniqueIndex('bed_room_label_uq').on(t.roomId, t.label)]
);

export const tenant = sqliteTable(
	'tenant',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		email: text('email'),
		/** The tenant's own portal account, once they accepted an invite. */
		userId: integer('user_id').references(() => user.id, { onDelete: 'set null' })
	},
	(t) => [index('tenant_owner_idx').on(t.ownerId), uniqueIndex('tenant_user_uq').on(t.userId)]
);

/**
 * A one-time link a landlord shares with a tenant to create their portal account.
 * Like sessions, only the SHA-256 of the token is stored. One open invite per tenant.
 */
export const tenantInvite = sqliteTable('tenant_invite', {
	id: text('id').primaryKey(),
	tenantId: integer('tenant_id')
		.notNull()
		.unique()
		.references(() => tenant.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

/**
 * A tenant occupying one bed. Dates are ISO `YYYY-MM-DD`. `endDate` is the move-out day:
 * the tenant stays the nights from `startDate` up to the night before `endDate`. Null = still staying.
 */
export const tenancy = sqliteTable(
	'tenancy',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		bedId: integer('bed_id')
			.notNull()
			.references(() => bed.id),
		tenantId: integer('tenant_id')
			.notNull()
			.references(() => tenant.id),
		startDate: text('start_date').notNull(),
		endDate: text('end_date'),
		monthlyRentSen: integer('monthly_rent_sen').notNull(),
		depositSen: integer('deposit_sen').notNull().default(0)
	},
	(t) => [index('tenancy_bed_idx').on(t.bedId)]
);

/** Everything billed to a tenancy. Rent is unique per tenancy and month, which makes billing idempotent. */
export const charge = sqliteTable(
	'charge',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tenancyId: integer('tenancy_id')
			.notNull()
			.references(() => tenancy.id),
		kind: text('kind', { enum: ['rent', 'utility', 'other'] }).notNull(),
		/** Billing month `YYYY-MM`. */
		period: text('period').notNull(),
		description: text('description').notNull(),
		amountSen: integer('amount_sen').notNull(),
		dueDate: text('due_date').notNull(),
		/** Groups the shares of one split house bill. */
		utilityBillId: integer('utility_bill_id').references(() => utilityBill.id),
		/** Set on deductions (cleaning, repairs...) taken from the deposit at move-out. */
		depositSettlementId: integer('deposit_settlement_id').references(
			(): AnySQLiteColumn => depositSettlement.id
		),
		/** Set on the electricity charges billed from a confirmed room meter reading. */
		meterReadingId: integer('meter_reading_id').references((): AnySQLiteColumn => meterReading.id)
	},
	(t) => [
		index('charge_tenancy_idx').on(t.tenancyId),
		uniqueIndex('charge_rent_once_uq')
			.on(t.tenancyId, t.period)
			.where(sql`${t.kind} = 'rent'`)
	]
);

/** A house bill (electricity, water, internet...) split across tenants by nights stayed. */
export const utilityBill = sqliteTable('utility_bill', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	propertyId: integer('property_id')
		.notNull()
		.references(() => property.id),
	label: text('label').notNull(),
	amountSen: integer('amount_sen').notNull(),
	fromDate: text('from_date').notNull(),
	toDate: text('to_date').notNull()
});

export const payment = sqliteTable(
	'payment',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tenancyId: integer('tenancy_id')
			.notNull()
			.references(() => tenancy.id),
		amountSen: integer('amount_sen').notNull(),
		paidOn: text('paid_on').notNull(),
		/** `deposit` = paid out of the tenant's deposit when it was settled at move-out (no new cash). */
		method: text('method', { enum: ['cash', 'bank_transfer', 'other', 'deposit'] }).notNull(),
		reference: text('reference')
	},
	(t) => [index('payment_tenancy_idx').on(t.tenancyId)]
);

/**
 * The deposit settled once a tenant has moved out: it pays the deductions first, then any other unpaid
 * charges (recorded as one `deposit` payment), and the rest is refunded to the tenant.
 * Invariant: depositSen = appliedSen + refundSen.
 */
export const depositSettlement = sqliteTable('deposit_settlement', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	tenancyId: integer('tenancy_id')
		.notNull()
		.unique()
		.references(() => tenancy.id),
	settledOn: text('settled_on').notNull(),
	depositSen: integer('deposit_sen').notNull(),
	deductionsSen: integer('deductions_sen').notNull(),
	/** Part of the deposit used to pay the tenant's unpaid charges (including the deductions). */
	appliedSen: integer('applied_sen').notNull(),
	refundSen: integer('refund_sen').notNull(),
	refundMethod: text('refund_method', { enum: ['cash', 'bank_transfer', 'other'] }),
	refundReference: text('refund_reference'),
	paymentId: integer('payment_id').references(() => payment.id)
});

/**
 * A reading of a room's electricity sub-meter. Tenants submit readings (`pending`); the landlord confirms
 * or rejects them with a reason. Readings the landlord takes are confirmed straight away. A confirmed
 * reading bills the kWh used since the room's previous confirmed reading (stored here for the record).
 * Readings are tenths of a kWh; the photo is a small validated image stored as base64.
 */
export const meterReading = sqliteTable(
	'meter_reading',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		roomId: integer('room_id')
			.notNull()
			.references(() => room.id, { onDelete: 'cascade' }),
		/** The submitting tenant's tenancy; null when the landlord took the reading. */
		tenancyId: integer('tenancy_id').references(() => tenancy.id),
		readOn: text('read_on').notNull(),
		readingTenths: integer('reading_tenths').notNull(),
		status: text('status', { enum: ['pending', 'confirmed', 'rejected'] }).notNull(),
		rejectReason: text('reject_reason'),
		photoType: text('photo_type', { enum: ['image/jpeg', 'image/png', 'image/webp'] }),
		photo: text('photo'),
		submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }).notNull(),
		decidedOn: text('decided_on'),
		/** kWh used since the previous confirmed reading (tenths), the rate and the amount billed. */
		usedTenths: integer('used_tenths'),
		rate: integer('rate'),
		amountSen: integer('amount_sen')
	},
	(t) => [
		index('meter_reading_room_idx').on(t.roomId, t.readOn),
		// One reading waiting per room, and one confirmed reading per room and day.
		uniqueIndex('meter_reading_pending_uq')
			.on(t.roomId)
			.where(sql`${t.status} = 'pending'`),
		uniqueIndex('meter_reading_confirmed_day_uq')
			.on(t.roomId, t.readOn)
			.where(sql`${t.status} = 'confirmed'`)
	]
);
