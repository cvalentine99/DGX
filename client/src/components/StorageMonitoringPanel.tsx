/*
 * StorageMonitoringPanel - NVMe SSD Storage Monitoring
 * 
 * Displays 1TB NVMe SSD usage with model storage breakdown,
 * container storage, and available space visualization.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  HardDrive,
  Database,
  Package,
  FolderOpen,
  RefreshCw,
  ChevronRight,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";

interface StorageBreakdown {
  name: string;
  size: number; // in GB
  path: string;
  type: "model" | "container" | "system" | "other";
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

function formatSize(sizeGB: number): string {
  if (sizeGB >= 1000) {
    return `${(sizeGB / 1000).toFixed(2)} TB`;
  }
  return `${sizeGB.toFixed(1)} GB`;
}

function getTypeColor(type: StorageBreakdown["type"]): string {
  switch (type) {
    case "model": return "bg-nvidia-green";
    case "container": return "bg-nvidia-teal";
    case "system": return "bg-nvidia-warning";
    case "other": return "bg-muted-foreground";
  }
}

function getTypeIcon(type: StorageBreakdown["type"]) {
  switch (type) {
    case "model": return Database;
    case "container": return Package;
    case "system": return Server;
    case "other": return FolderOpen;
  }
}

function StorageBar({
  breakdown,
  total,
}: {
  breakdown: StorageBreakdown[];
  total: number;
}) {
  const usedTotal = breakdown.reduce((acc, item) => acc + item.size, 0);
  const freeSpace = total - usedTotal;

  return (
    <div className="space-y-2">
      <div className="h-6 rounded-full overflow-hidden bg-muted/50 flex">
        {breakdown.map((item, index) => {
          const percentage = (item.size / total) * 100;
          if (percentage < 0.5) return null; // Skip tiny segments
          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-full transition-all hover:opacity-80 cursor-pointer",
                    getTypeColor(item.type)
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(item.size)} ({percentage.toFixed(1)}%)</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {freeSpace > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="h-full bg-muted/30"
                style={{ width: `${(freeSpace / total) * 100}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Free Space</p>
              <p className="text-xs text-muted-foreground">{formatSize(freeSpace)} available</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-nvidia-green" />
          <span>Models</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-nvidia-teal" />
          <span>Containers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-nvidia-warning" />
          <span>System</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted/30" />
          <span>Free</span>
        </div>
      </div>
    </div>
  );
}

function StorageItem({
  item,
  total,
}: {
  item: StorageBreakdown;
  total: number;
}) {
  const Icon = getTypeIcon(item.type);
  const percentage = (item.size / total) * 100;

  return (
    <motion.div
      variants={itemVariants}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        item.type === "model" && "bg-nvidia-green/20",
        item.type === "container" && "bg-nvidia-teal/20",
        item.type === "system" && "bg-nvidia-warning/20",
        item.type === "other" && "bg-muted"
      )}>
        <Icon className={cn(
          "w-4 h-4",
          item.type === "model" && "text-nvidia-green",
          item.type === "container" && "text-nvidia-teal",
          item.type === "system" && "text-nvidia-warning",
          item.type === "other" && "text-muted-foreground"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <span className="text-sm font-mono text-muted-foreground">
            {formatSize(item.size)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={percentage} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground w-12 text-right">
            {percentage.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate font-mono">
          {item.path}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

export function StorageMonitoringPanel() {
  const [activeHost, setActiveHost] = useState<"alpha" | "beta">("alpha");

  // Fetch storage info from backend
  const { data: storageData, isLoading, refetch } = trpc.ssh.getStorageInfo.useQuery(
    { hostId: activeHost },
    { 
      refetchInterval: 60000, // Refresh every minute
      retry: 1,
    }
  );

  // Default/fallback data based on known DGX Spark specs
  const totalStorage = 1000; // 1TB NVMe SSD
  
  const breakdown: StorageBreakdown[] = storageData?.breakdown || [
    { name: "Nemotron-3-Nano-30B", size: 31.6, path: "/models/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8", type: "model" },
    { name: "NGC Containers", size: 377, path: "/var/lib/docker", type: "container" },
    { name: "System & OS", size: 45, path: "/", type: "system" },
    { name: "Holoscan Pipelines", size: 12, path: "/opt/holoscan", type: "other" },
    { name: "Training Data", size: 8, path: "/data/training", type: "other" },
  ];

  const usedStorage = storageData?.used || breakdown.reduce((acc, item) => acc + item.size, 0);
  const availableStorage = storageData?.available || (totalStorage - usedStorage);
  const usagePercent = (usedStorage / totalStorage) * 100;

  const modelStorage = breakdown.filter(b => b.type === "model").reduce((acc, b) => acc + b.size, 0);
  const containerStorage = breakdown.filter(b => b.type === "container").reduce((acc, b) => acc + b.size, 0);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
      }}
    >
      <Card className="cyber-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-nvidia-teal" />
              </div>
              <div>
                <CardTitle className="text-lg font-display">Storage Monitoring</CardTitle>
                <CardDescription>1TB NVMe SSD usage and model storage breakdown</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Host Selection */}
          <Tabs value={activeHost} onValueChange={(v) => setActiveHost(v as "alpha" | "beta")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="alpha" className="gap-2">
                <Server className="w-4 h-4" />
                DGX Spark Alpha
              </TabsTrigger>
              <TabsTrigger value="beta" className="gap-2">
                <Server className="w-4 h-4" />
                DGX Spark Beta
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Overall Storage Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-2xl font-mono font-bold text-nvidia-green">
                {formatSize(totalStorage)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total Capacity</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className={cn(
                "text-2xl font-mono font-bold",
                usagePercent > 90 ? "text-nvidia-critical" : usagePercent > 75 ? "text-nvidia-warning" : "text-foreground"
              )}>
                {formatSize(usedStorage)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Used ({usagePercent.toFixed(1)}%)</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-2xl font-mono font-bold text-nvidia-teal">
                {formatSize(availableStorage)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Available</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-2xl font-mono font-bold">
                {formatSize(modelStorage + containerStorage)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">AI Workloads</p>
            </div>
          </div>

          {/* Storage Visualization Bar */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Storage Distribution</h4>
            <StorageBar breakdown={breakdown} total={totalStorage} />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-nvidia-green/10 border border-nvidia-green/30">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-nvidia-green" />
                <span className="text-sm font-medium">Model Storage</span>
              </div>
              <p className="text-xl font-mono font-bold mt-1">{formatSize(modelStorage)}</p>
              <p className="text-xs text-muted-foreground">
                {breakdown.filter(b => b.type === "model").length} models loaded
              </p>
            </div>
            <div className="p-3 rounded-lg bg-nvidia-teal/10 border border-nvidia-teal/30">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-nvidia-teal" />
                <span className="text-sm font-medium">Container Storage</span>
              </div>
              <p className="text-xl font-mono font-bold mt-1">{formatSize(containerStorage)}</p>
              <p className="text-xs text-muted-foreground">
                NGC container images
              </p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Storage Breakdown</h4>
              <Badge variant="outline" className="text-xs">
                {breakdown.length} items
              </Badge>
            </div>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
              }}
              className="space-y-2"
            >
              {breakdown
                .sort((a, b) => b.size - a.size)
                .map((item, index) => (
                  <StorageItem key={index} item={item} total={totalStorage} />
                ))}
            </motion.div>
          </div>

          {/* Storage Health */}
          <div className={cn(
            "p-4 rounded-lg border",
            usagePercent > 90 
              ? "bg-nvidia-critical/10 border-nvidia-critical/30" 
              : usagePercent > 75 
                ? "bg-nvidia-warning/10 border-nvidia-warning/30"
                : "bg-nvidia-green/10 border-nvidia-green/30"
          )}>
            <div className="flex items-center gap-2">
              <HardDrive className={cn(
                "w-5 h-5",
                usagePercent > 90 ? "text-nvidia-critical" : usagePercent > 75 ? "text-nvidia-warning" : "text-nvidia-green"
              )} />
              <span className="font-medium">
                {usagePercent > 90 
                  ? "Storage Critical" 
                  : usagePercent > 75 
                    ? "Storage Warning"
                    : "Storage Healthy"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {usagePercent > 90 
                ? "Consider removing unused containers or models to free up space."
                : usagePercent > 75 
                  ? "Storage usage is elevated. Monitor closely."
                  : "Sufficient storage available for additional models and containers."}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
