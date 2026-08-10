CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_submission_created` ON `audit_events` (`submission_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`reporter_name` text DEFAULT 'Anonymous' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_reports_submission_status` ON `reports` (`submission_id`,`status`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_hash` text NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`contributor_name` text NOT NULL,
	`linkedin_url` text,
	`display_linkedin` integer DEFAULT false NOT NULL,
	`description` text NOT NULL,
	`singapore_connection` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text,
	`rights_attested` integer DEFAULT false NOT NULL,
	`category` text DEFAULT 'Street Life & Nature' NOT NULL,
	`file_key` text NOT NULL,
	`public_file_key` text,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`triangle_count` integer DEFAULT 0 NOT NULL,
	`material_count` integer DEFAULT 0 NOT NULL,
	`animation_count` integer DEFAULT 0 NOT NULL,
	`mesh_count` integer DEFAULT 0 NOT NULL,
	`validation_status` text NOT NULL,
	`validation_checks` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`submitter_fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`deletion_due_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_receipt_hash_unique` ON `submissions` (`receipt_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_slug_unique` ON `submissions` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_submissions_status_published` ON `submissions` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_submissions_fingerprint_created` ON `submissions` (`submitter_fingerprint`,`created_at`);