CREATE TABLE `bed` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` integer NOT NULL,
	`label` text NOT NULL,
	`default_rent_sen` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bed_room_label_uq` ON `bed` (`room_id`,`label`);--> statement-breakpoint
CREATE TABLE `charge` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenancy_id` integer NOT NULL,
	`kind` text NOT NULL,
	`period` text NOT NULL,
	`description` text NOT NULL,
	`amount_sen` integer NOT NULL,
	`due_date` text NOT NULL,
	`utility_bill_id` integer,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancy`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`utility_bill_id`) REFERENCES `utility_bill`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `charge_tenancy_idx` ON `charge` (`tenancy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `charge_rent_once_uq` ON `charge` (`tenancy_id`,`period`) WHERE "charge"."kind" = 'rent';--> statement-breakpoint
CREATE TABLE `payment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenancy_id` integer NOT NULL,
	`amount_sen` integer NOT NULL,
	`paid_on` text NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancy`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_tenancy_idx` ON `payment` (`tenancy_id`);--> statement-breakpoint
CREATE TABLE `property` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`area` text NOT NULL,
	`rent_due_day` integer DEFAULT 7 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `property_owner_idx` ON `property` (`owner_id`);--> statement-breakpoint
CREATE TABLE `room` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`property_id` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `property`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_property_name_uq` ON `room` (`property_id`,`name`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tenancy` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bed_id` integer NOT NULL,
	`tenant_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`monthly_rent_sen` integer NOT NULL,
	`deposit_sen` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`bed_id`) REFERENCES `bed`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tenancy_bed_idx` ON `tenancy` (`bed_id`);--> statement-breakpoint
CREATE TABLE `tenant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_owner_idx` ON `tenant` (`owner_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `utility_bill` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`property_id` integer NOT NULL,
	`label` text NOT NULL,
	`amount_sen` integer NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `property`(`id`) ON UPDATE no action ON DELETE no action
);
