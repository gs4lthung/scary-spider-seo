CREATE TABLE `password_reset_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_hash_unique` ON `password_reset_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_id_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `login_email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_changed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_email_unique` ON `users` (`login_email`);