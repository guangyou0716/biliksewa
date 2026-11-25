CREATE TABLE `deposit_settlement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenancy_id` integer NOT NULL,
	`settled_on` text NOT NULL,
	`deposit_sen` integer NOT NULL,
	`deductions_sen` integer NOT NULL,
	`applied_sen` integer NOT NULL,
	`refund_sen` integer NOT NULL,
	`refund_method` text,
	`refund_reference` text,
	`payment_id` integer,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancy`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deposit_settlement_tenancy_id_unique` ON `deposit_settlement` (`tenancy_id`);--> statement-breakpoint
ALTER TABLE `charge` ADD `deposit_settlement_id` integer REFERENCES deposit_settlement(id);