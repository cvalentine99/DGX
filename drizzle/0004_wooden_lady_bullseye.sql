ALTER TABLE `system_settings` ADD `splunkHost` varchar(256);--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkPort` int;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkToken` varchar(256);--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkIndex` varchar(128);--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkSourceType` varchar(128);--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkSsl` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkEnabled` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkForwardMetrics` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkForwardAlerts` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkForwardContainers` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkForwardInference` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `splunkInterval` int DEFAULT 60;