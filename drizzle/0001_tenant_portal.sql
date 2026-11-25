CREATE TABLE `tenant_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_invite_tenant_id_unique` ON `tenant_invite` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `tenant` ADD `user_id` integer REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_user_uq` ON `tenant` (`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'landlord' NOT NULL;