ALTER TABLE `posts` ADD `author_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `job_title` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;