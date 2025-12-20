CREATE TABLE `gpu_metrics_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` varchar(32) NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`gpuUtilization` int NOT NULL,
	`gpuTemperature` int NOT NULL,
	`gpuPowerDraw` int NOT NULL,
	`gpuMemoryUsed` int NOT NULL,
	`gpuMemoryTotal` int NOT NULL,
	`cpuUtilization` int,
	`systemMemoryUsed` int,
	`systemMemoryTotal` int,
	CONSTRAINT `gpu_metrics_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inference_request_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`model` varchar(256) NOT NULL,
	`promptTokens` int NOT NULL,
	`completionTokens` int NOT NULL,
	`totalTokens` int NOT NULL,
	`latencyMs` int NOT NULL,
	`userId` int,
	`success` int NOT NULL DEFAULT 1,
	CONSTRAINT `inference_request_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`type` enum('success','info','warning','error') NOT NULL,
	`message` text NOT NULL,
	`hostId` varchar(32),
	`dismissed` int NOT NULL DEFAULT 0,
	CONSTRAINT `system_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inference_request_logs` ADD CONSTRAINT `inference_request_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;