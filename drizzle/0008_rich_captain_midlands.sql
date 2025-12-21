CREATE INDEX `idx_host_time` ON `gpu_metrics_history` (`hostId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_timestamp` ON `inference_request_logs` (`timestamp`);