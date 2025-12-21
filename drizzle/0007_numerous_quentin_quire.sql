CREATE TABLE `training_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(256) NOT NULL,
	`description` text,
	`isPublic` boolean DEFAULT false,
	`baseModel` varchar(256) NOT NULL,
	`trainingType` enum('lora','qlora','full_sft','full_finetune') NOT NULL,
	`datasetPath` varchar(512),
	`epochs` int NOT NULL DEFAULT 3,
	`batchSize` int NOT NULL DEFAULT 4,
	`learningRate` varchar(32) NOT NULL DEFAULT '2e-5',
	`warmupSteps` int DEFAULT 100,
	`loraRank` int DEFAULT 16,
	`loraAlpha` int DEFAULT 32,
	`gpuCount` int NOT NULL DEFAULT 1,
	`preferredHost` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `training_templates` ADD CONSTRAINT `training_templates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;