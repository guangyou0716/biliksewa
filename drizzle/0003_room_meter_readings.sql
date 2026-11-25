CREATE TABLE `meter_reading` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` integer NOT NULL,
	`tenancy_id` integer,
	`read_on` text NOT NULL,
	`reading_tenths` integer NOT NULL,
	`status` text NOT NULL,
	`reject_reason` text,
	`photo_type` text,
	`photo` text,
	`submitted_at` integer NOT NULL,
	`decided_on` text,
	`used_tenths` integer,
	`rate` integer,
	`amount_sen` integer,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancy`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meter_reading_room_idx` ON `meter_reading` (`room_id`,`read_on`);--> statement-breakpoint
CREATE UNIQUE INDEX `meter_reading_pending_uq` ON `meter_reading` (`room_id`) WHERE "meter_reading"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX `meter_reading_confirmed_day_uq` ON `meter_reading` (`room_id`,`read_on`) WHERE "meter_reading"."status" = 'confirmed';--> statement-breakpoint
ALTER TABLE `charge` ADD `meter_reading_id` integer REFERENCES meter_reading(id);--> statement-breakpoint
ALTER TABLE `property` ADD `meter_rate` integer;