CREATE TABLE `comment_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comment_id` integer NOT NULL,
	`voter_key` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_votes_comment_voter_unique` ON `comment_votes` (`comment_id`,`voter_key`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`user_id` integer,
	`author_name` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
