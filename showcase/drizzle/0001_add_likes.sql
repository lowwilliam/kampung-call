CREATE TABLE `likes` (
	`asset_id` text NOT NULL,
	`voter_fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`asset_id`, `voter_fingerprint`)
);
--> statement-breakpoint
PRAGMA optimize;
