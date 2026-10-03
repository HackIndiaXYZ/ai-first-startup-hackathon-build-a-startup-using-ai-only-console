CREATE TABLE `pharma_ai_usage` (
	`workspace_id` text NOT NULL,
	`day` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`workspace_id`, `day`),
	FOREIGN KEY (`workspace_id`) REFERENCES `pharma_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pharma_invitations` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_by` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `pharma_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pharma_invitations_workspace` ON `pharma_invitations` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `pharma_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `pharma_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pharma_members_user` ON `pharma_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `pharma_records` (
	`workspace_id` text NOT NULL,
	`collection` text NOT NULL,
	`record_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `collection`, `record_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `pharma_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pharma_requests` (
	`workspace_id` text NOT NULL,
	`request_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `request_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `pharma_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pharma_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `pharma_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pharma_sessions_expiry` ON `pharma_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `pharma_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`metadata` text NOT NULL,
	`owner_id` text,
	`mutation` text NOT NULL,
	`updated_at` text NOT NULL
);
