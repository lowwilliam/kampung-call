ALTER TABLE `submissions` ADD `download_allowed` integer DEFAULT false NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
