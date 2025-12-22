CREATE TABLE `datasets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(256) NOT NULL,
	`description` text,
	`type` enum('instruction','code','preference','conversation','raw') NOT NULL DEFAULT 'instruction',
	`format` enum('jsonl','parquet','csv','json','txt') NOT NULL DEFAULT 'jsonl',
	`hostId` varchar(32) NOT NULL,
	`path` varchar(512) NOT NULL,
	`samples` int DEFAULT 0,
	`sizeBytes` int DEFAULT 0,
	`qualityScore` int,
	`validationRate` int,
	`duplicateRate` int,
	`avgTokenLength` int,
	`status` enum('pending','scanning','validated','processing','ready','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`lastScannedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `datasets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`step` int NOT NULL,
	`epoch` int NOT NULL,
	`trainLoss` varchar(32),
	`evalLoss` varchar(32),
	`learningRate` varchar(32),
	`gradientNorm` varchar(32),
	`throughput` int,
	`gpuUtilization` int,
	`gpuMemoryUsed` int,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `training_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `datasets` ADD CONSTRAINT `datasets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_metrics` ADD CONSTRAINT `training_metrics_jobId_training_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `training_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_dataset_host_path` ON `datasets` (`hostId`,`path`);--> statement-breakpoint
CREATE INDEX `idx_job_step` ON `training_metrics` (`jobId`,`step`);