/*
 * Dashboard - System Overview
 * 
 * Design: Mission Control overview showing both DGX Spark hosts,
 * system health, model status, and quick access to all modules.
 * Optimized for ultrawide monitors with flexible grid layout.
 * 
 * Now with real-time GPU metrics via DCGM/nvidia-smi over SSH.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Server,
  Cpu,
  HardDrive,
  Thermometer,
  Zap,
  Activity,
  Brain,
  Database,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Rocket,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { GpuHistoryChart, GpuHistoryComparisonChart } from "@/components/GpuHistoryChart";
import { ContainerInventory } from "@/components/ContainerInventory";
import { ComfyUIPanel } from "@/components/ComfyUIPanel";
import { AlertConfigPanel } from "@/components/AlertConfigPanel";
import { BenchmarkPanel } from "@/components/BenchmarkPanel";
import { StorageMonitoringPanel } from "@/components/StorageMonitoringPanel";

// Model status is now fetched from vLLM API
// Alerts are now fetched from database via stats.getAlerts

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function MetricGauge({ 
  value, 
  max, 
  label, 
  unit, 
  icon: Icon,
  color = "nvidia-green",
  isLoading = false,
}: { 
  value: number; 
  max: number; 
  label: string; 
  unit: string;
  icon: React.ElementType;
  color?: string;
  isLoading?: boolean;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const colorClass = percentage > 80 ? "text-nvidia-warning" : `text-${color}`;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", isLoading ? "text-muted-foreground animate-pulse" : colorClass)} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className={cn("text-sm font-mono font-semibold", isLoading ? "text-muted-foreground" : colorClass)}>
          {isLoading ? "..." : `${value}${unit}`}
        </span>
      </div>
      <div className="progress-glow">
        <div 
          className={cn("progress-glow-fill transition-all duration-500", isLoading && "opacity-50")}
          style={{ 
            width: `${percentage}%`,
            background: percentage > 80 
              ? 'linear-gradient(90deg, oklch(0.75 0.18 55), oklch(0.58 0.22 25))'
              : undefined
          }}
        />
      </div>
    </div>
  );
}

interface HostMetrics {
  hostId: string;
  hostName: string;
  hostIp: string;
  timestamp: number;
  connected: boolean;
  error?: string;
  gpus: Array<{
    index: number;
    name: string;
    uuid: string;
    utilization: number;
    memoryUsed: number;
    memoryTotal: number;
    memoryUtilization: number;
    temperature: number;
    powerDraw: number;
    powerLimit: number;
    fanSpeed: number;
    clockGraphics: number;
    clockMemory: number;
    pcieGen: number;
    pcieLinkWidth: number;
  }>;
  systemMetrics: {
    cpuUtilization: number;
    memoryUsed: number;
    memoryTotal: number;
    uptime: string;
  };
}

function HostCard({ 
  metrics, 
  isLoading,
  isLive,
}: { 
  metrics: HostMetrics;
  isLoading: boolean;
  isLive: boolean;
}) {
  const gpu = metrics.gpus[0];
  const isOnline = metrics.connected && !metrics.error;
  
  // Convert memory from MB to GB for display
  // DGX Spark has 128GB unified memory (shared CPU+GPU via NVLink-C2C)
  // nvidia-smi reports 0 for GPU memory because it's unified with system RAM
  const ramUsedGB = (metrics.systemMetrics.memoryUsed / 1024).toFixed(1);
  // Use 128GB as the spec total (OS reports ~120GB due to reserved coherent memory)
  const ramTotalGB = 128;
  // GPU memory is part of unified memory pool - show portion allocated to GPU workloads
  const gpuMemUsedGB = gpu ? (gpu.memoryUsed > 0 ? (gpu.memoryUsed / 1024).toFixed(1) : "0") : "0";
  // For unified memory, GPU can access up to 128GB but typically uses a portion
  const gpuMemTotalGB = 128;
  
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-panel-glow overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isOnline ? "bg-nvidia-green/20" : "bg-muted"
              )}>
                <Server className={cn("w-5 h-5", isOnline ? "text-nvidia-green" : "text-muted-foreground")} />
              </div>
              <div>
                <CardTitle className="text-base font-display tracking-wide">{metrics.hostName}</CardTitle>
                <p className="text-xs font-mono text-muted-foreground">{metrics.hostIp}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isLive && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] border-nvidia-warning/50 text-nvidia-warning">
                      OFFLINE
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Configure SSH credentials to see live metrics</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <div className={cn(
                "hex-status",
                isOnline ? "hex-status-online" : "hex-status-offline"
              )} />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* GPU Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-3 h-3" />
            <span>1x {gpu?.name || "NVIDIA GB10 Grace Blackwell"}</span>
          </div>
          
          {/* Error State */}
          {metrics.error && (
            <div className="p-2 rounded bg-nvidia-critical/10 border border-nvidia-critical/30">
              <div className="flex items-center gap-2 text-xs text-nvidia-critical">
                <WifiOff className="w-3 h-3" />
                <span>{metrics.error}</span>
              </div>
            </div>
          )}
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <MetricGauge 
              value={gpu?.utilization || 0} 
              max={100} 
              label="GPU Util" 
              unit="%" 
              icon={Cpu}
              isLoading={isLoading}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <MetricGauge 
                    value={parseFloat(gpuMemUsedGB)} 
                    max={gpuMemTotalGB} 
                    label="GPU Mem" 
                    unit="GB" 
                    icon={HardDrive}
                    color="nvidia-teal"
                    isLoading={isLoading}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Unified memory (shared CPU+GPU via NVLink-C2C)</p>
              </TooltipContent>
            </Tooltip>
            <MetricGauge 
              value={gpu?.temperature || 0} 
              max={90} 
              label="Temp" 
              unit="°C" 
              icon={Thermometer}
              isLoading={isLoading}
            />
            <MetricGauge 
              value={gpu?.powerDraw || 0} 
              max={gpu?.powerLimit || 500} 
              label="Power" 
              unit="W" 
              icon={Zap}
              color="nvidia-teal"
              isLoading={isLoading}
            />
          </div>
          
          {/* System Resources */}
          <div className="pt-2 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">CPU Utilization</span>
              <span className={cn("font-mono", isLoading ? "text-muted-foreground" : "text-foreground")}>
                {isLoading ? "..." : `${metrics.systemMetrics.cpuUtilization}%`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Unified Memory</span>
              <span className={cn("font-mono", isLoading ? "text-muted-foreground" : "text-foreground")}>
                {isLoading ? "..." : `${ramUsedGB}/${ramTotalGB}GB`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Uptime</span>
              <span className={cn("font-mono", isLoading ? "text-muted-foreground" : "text-nvidia-green")}>
                {isLoading ? "..." : metrics.systemMetrics.uptime}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ModelStatusCard() {
  const { data: vllmHealth, isLoading } = trpc.vllm.healthCheck.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  const { data: inferenceStats } = trpc.stats.getInferenceStats.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  
  const isConnected = vllmHealth?.status === "connected";
  const modelName = vllmHealth?.models?.[0]?.split('/').pop() || "Nemotron-3-Nano-30B";
  
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-panel h-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-nvidia-teal" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">Model Status</CardTitle>
              <p className="text-xs text-muted-foreground">Active Inference Engine</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-nvidia-green font-display tracking-wide">
                {isLoading ? "Loading..." : modelName}
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium",
                isConnected ? "bg-nvidia-green/20 text-nvidia-green" : "bg-nvidia-warning/20 text-nvidia-warning"
              )}>
                {isConnected ? "RUNNING" : "OFFLINE"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">MoE Architecture • FP8 Quantized</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Parameters</span>
              <span className="font-mono font-semibold">30B</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Active Params</span>
              <span className="font-mono font-semibold text-nvidia-green">3B</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Context</span>
              <span className="font-mono font-semibold">8192</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Precision</span>
              <span className="font-mono font-semibold">FP8</span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Inference Engine</span>
              <span className="font-mono text-nvidia-teal">llama.cpp + CUDA</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tokens Processed</span>
              <span className="font-mono">{inferenceStats?.totalTokens?.toLocaleString() || "0"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avg Latency</span>
              <span className="font-mono">{inferenceStats?.avgLatency || "--"}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SystemAlertsCard() {
  const { data: alerts, isLoading } = trpc.stats.getAlerts.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  
  const getAlertIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-nvidia-green" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-nvidia-warning" />;
      case "error": return <XCircle className="w-4 h-4 text-nvidia-critical" />;
      default: return <Activity className="w-4 h-4 text-nvidia-teal" />;
    }
  };
  
  const displayAlerts = alerts && alerts.length > 0 ? alerts : [
    { id: 0, type: "success", message: "All systems operational", timeAgo: "now" }
  ];
  
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-panel h-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Activity className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">System Alerts</CardTitle>
              <p className="text-xs text-muted-foreground">Recent Activity</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-xs text-muted-foreground">Loading alerts...</div>
            ) : (
              displayAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="flex items-start gap-3 p-2 rounded bg-muted/30"
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{alert.timeAgo}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AIPerformanceCard() {
  const { data: inferenceStats } = trpc.stats.getInferenceStats.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );
  
  // Calculate throughput (tokens per second)
  const tokensPerSecond = inferenceStats?.avgLatency && inferenceStats.avgLatency > 0
    ? Math.round((inferenceStats.totalTokens / inferenceStats.totalRequests) / (inferenceStats.avgLatency / 1000))
    : 0;
  
  // DGX Spark AI Performance specs
  const peakFP4 = 1000; // 1 petaFLOP = 1000 TFLOPS
  const peakFP8 = 500;  // ~500 TFLOPS FP8
  const peakFP16 = 250; // ~250 TFLOPS FP16
  
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-panel">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">AI Performance</CardTitle>
              <p className="text-xs text-muted-foreground">DGX Spark Compute Capability</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Peak FP4 Performance */}
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-gradient-to-br from-nvidia-green/10 to-nvidia-green/5 border border-nvidia-green/20">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-nvidia-green" />
                <span className="text-xs text-muted-foreground">Peak FP4</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold text-nvidia-green">1</span>
                <span className="text-sm font-mono text-nvidia-green">petaFLOP</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Blackwell Tensor Cores</span>
            </div>
            
            {/* Peak FP8 Performance */}
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-nvidia-teal" />
                <span className="text-xs text-muted-foreground">Peak FP8</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold">500</span>
                <span className="text-sm font-mono text-muted-foreground">TFLOPS</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Transformer Engine</span>
            </div>
            
            {/* Current Throughput */}
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-nvidia-teal" />
                <span className="text-xs text-muted-foreground">Throughput</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold">{tokensPerSecond || "--"}</span>
                <span className="text-sm font-mono text-muted-foreground">tok/s</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Current inference rate</span>
            </div>
            
            {/* NVLink-C2C */}
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-nvidia-teal" />
                <span className="text-xs text-muted-foreground">NVLink-C2C</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold">900</span>
                <span className="text-sm font-mono text-muted-foreground">GB/s</span>
              </div>
              <span className="text-[10px] text-muted-foreground">CPU-GPU bandwidth</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickStatsCard() {
  const { data: inferenceStats, isLoading } = trpc.stats.getInferenceStats.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  
  const stats = [
    { 
      label: "Total Requests", 
      value: inferenceStats?.hasData ? inferenceStats.totalRequests.toLocaleString() : "0", 
      change: inferenceStats?.hasData ? "24h" : "--", 
      icon: TrendingUp 
    },
    { 
      label: "Avg Response Time", 
      value: inferenceStats?.hasData ? `${inferenceStats.avgLatency}ms` : "--", 
      change: inferenceStats?.hasData ? "live" : "--", 
      icon: Clock 
    },
    { 
      label: "Success Rate", 
      value: inferenceStats?.hasData ? `${inferenceStats.successRate}%` : "--", 
      change: inferenceStats?.hasData ? "24h" : "--", 
      icon: Database 
    },
    { 
      label: "Tokens Processed", 
      value: inferenceStats?.hasData ? inferenceStats.totalTokens.toLocaleString() : "0", 
      change: inferenceStats?.hasData ? "24h" : "--", 
      icon: Activity 
    },
  ];
  
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-panel">
        <CardHeader>
          <CardTitle className="text-base font-display tracking-wide">Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-nvidia-teal" />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-mono font-bold">{stat.value}</span>
                    <span className={cn(
                      "text-xs font-mono",
                      stat.change.startsWith("+") ? "text-nvidia-green" : "text-nvidia-teal"
                    )}>{stat.change}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // Fetch metrics from DCGM backend
  const { data: metricsData, isLoading, refetch, isFetching, dataUpdatedAt } = trpc.dcgm.getAllMetrics.useQuery(
    undefined,
    {
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: false,
    }
  );
  
  // Update last refresh time when data changes
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastRefresh(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);
  
  // Manual refresh handler
  const handleRefresh = () => {
    refetch();
  };
  
  // Default metrics for initial render
  const defaultMetrics: HostMetrics[] = [
    {
      hostId: "alpha",
      hostName: "DGX Spark Alpha",
      hostIp: "192.168.50.139",
      timestamp: Date.now(),
      connected: true,
      gpus: [{
        index: 0,
        name: "NVIDIA GB10 Grace Blackwell",
        uuid: "GPU-alpha-0",
        utilization: 78,
        memoryUsed: 46285,
        memoryTotal: 131072,
        memoryUtilization: 47,
        temperature: 62,
        powerDraw: 285,
        powerLimit: 500,
        fanSpeed: 35,
        clockGraphics: 1980,
        clockMemory: 2619,
        pcieGen: 5,
        pcieLinkWidth: 16,
      }],
      systemMetrics: {
        cpuUtilization: 34,
        memoryUsed: 91546,
        memoryTotal: 524288,
        uptime: "14d 7h 23m",
      },
    },
    {
      hostId: "beta",
      hostName: "DGX Spark Beta",
      hostIp: "192.168.50.110",
      timestamp: Date.now(),
      connected: true,
      gpus: [{
        index: 0,
        name: "NVIDIA GB10 Grace Blackwell",
        uuid: "GPU-beta-0",
        utilization: 65,
        memoryUsed: 39629,
        memoryTotal: 131072,
        memoryUtilization: 40,
        temperature: 58,
        powerDraw: 245,
        powerLimit: 500,
        fanSpeed: 32,
        clockGraphics: 1980,
        clockMemory: 2619,
        pcieGen: 5,
        pcieLinkWidth: 16,
      }],
      systemMetrics: {
        cpuUtilization: 28,
        memoryUsed: 78029,
        memoryTotal: 524288,
        uptime: "14d 7h 23m",
      },
    },
  ];
  
  const hosts = metricsData?.hosts || defaultMetrics;
  const isLive = metricsData?.isLive ?? false;
  
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wider text-foreground">
            SYSTEM OVERVIEW
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring of DGX Spark infrastructure and model status
          </p>
        </div>
        
        {/* Refresh Controls */}
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Auto-refresh every {refreshInterval / 1000}s</p>
            </TooltipContent>
          </Tooltip>
          
          {isLive ? (
            <Badge variant="outline" className="border-nvidia-green/50 text-nvidia-green gap-1">
              <Wifi className="w-3 h-3" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="border-nvidia-warning/50 text-nvidia-warning gap-1">
              <WifiOff className="w-3 h-3" />
              Offline
            </Badge>
          )}
        </div>
      </div>
      
      {/* DGX Spark Hosts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hosts.map((host) => (
          <HostCard 
            key={host.hostId} 
            metrics={host} 
            isLoading={isLoading}
            isLive={isLive}
          />
        ))}
      </div>
      
      {/* GPU History Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {hosts.map((host) => (
          <GpuHistoryChart
            key={`history-${host.hostId}`}
            hostId={host.hostId}
            hostName={host.hostName}
          />
        ))}
      </div>
      
      {/* GPU Comparison Chart */}
      <GpuHistoryComparisonChart />
      
      {/* Container Inventory */}
      <ContainerInventory />
      
      {/* ComfyUI Panel */}
      <ComfyUIPanel />
      
      {/* AI Performance */}
      <AIPerformanceCard />
      
      {/* Model Benchmark & Storage Monitoring */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BenchmarkPanel />
        <StorageMonitoringPanel />
      </div>
      
      {/* Alert Configuration */}
      <AlertConfigPanel />
      
      {/* Quick Stats */}
      <QuickStatsCard />
      
      {/* Model Status & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModelStatusCard />
        <SystemAlertsCard />
      </div>
    </motion.div>
  );
}
