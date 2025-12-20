CREATE TABLE `container_pull_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` varchar(32) NOT NULL,
	`hostName` varchar(128) NOT NULL,
	`hostIp` varchar(45) NOT NULL,
	`imageTag` varchar(512) NOT NULL,
	`action` enum('pull','update','remove') NOT NULL,
	`status` enum('started','completed','failed') NOT NULL,
	`userId` int,
	`userName` varchar(256),
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `container_pull_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `container_pull_history` ADD CONSTRAINT `container_pull_history_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;