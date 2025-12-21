CREATE TABLE `container_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(128) NOT NULL,
	`description` text,
	`category` varchar(64) NOT NULL DEFAULT 'Custom',
	`icon` varchar(32) DEFAULT 'box',
	`image` varchar(512) NOT NULL,
	`defaultPort` int NOT NULL DEFAULT 8080,
	`gpuRequired` int NOT NULL DEFAULT 0,
	`command` text,
	`envVars` text,
	`volumes` text,
	`networkMode` varchar(32) DEFAULT 'bridge',
	`restartPolicy` varchar(32) DEFAULT 'no',
	`isPublic` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `container_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `container_presets` ADD CONSTRAINT `container_presets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;