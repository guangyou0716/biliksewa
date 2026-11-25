import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Landlord accounts. Tenants get their own portal in a later increment. */
export const user = sqliteTable('user', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull()
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
		rentDueDay: integer('rent_due_day').notNull().default(7)
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
		email: text('email')
	},
	(t) => [index('tenant_owner_idx').on(t.ownerId)]
);

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
		utilityBillId: integer('utility_bill_id').references(() => utilityBill.id)
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
		method: text('method', { enum: ['cash', 'bank_transfer', 'other'] }).notNull(),
		reference: text('reference')
	},
	(t) => [index('payment_tenancy_idx').on(t.tenancyId)]
);
