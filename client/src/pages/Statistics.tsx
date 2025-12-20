/**
 * Statistics - Observability & Monitoring Deck
 * 
 * Design: MoE expert routing heatmap, vLLM inference telemetry,
 * system health monitoring, and performance analytics.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Activity,
  Cpu,
  HardDrive,
  Thermometer,
  Zap,
  Clock,
  TrendingUp,
  Server,
  Layers,
  Grid3X3,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// MoE Expert Routing (simplified 8x8 grid representing 64 of 128 experts)
const generateExpertHeatmap = () => {
  const data: number[][] = [];
  for (let layer = 0; layer < 8; layer++) {
    const row: number[] = [];
    for (let expert = 0; expert < 16; expert++) {
      // Simulate routing frequency (0-100)
      row.push(Math.floor(Math.random() * 100));
    }
    data.push(row);
  }
  return data;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function VLLMTelemetryCard() {
  const { data: inferenceStats, isLoading, refetch } = trpc.stats.getInferenceStats.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  
  const handleRefresh = () => {
    refetch();
    toast.info("Refreshing metrics...");
  };
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">Inference Telemetry</CardTitle>
              <p className="text-xs text-muted-foreground">
                {inferenceStats?.hasData ? "Live metrics from database" : "Waiting for inference requests"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-nvidia-green" />
              <span className="text-xs text-muted-foreground">Avg Latency</span>
            </div>
            <div className="text-2xl font-mono font-bold text-nvidia-green">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : inferenceStats?.avgLatency || "--"}
              <span className="text-sm text-muted-foreground ml-1">ms</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Response Time</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-nvidia-teal" />
              <span className="text-xs text-muted-foreground">Success Rate</span>
            </div>
            <div className="text-2xl font-mono font-bold text-nvidia-teal">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${inferenceStats?.successRate || 0}%`}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Request Success</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-nvidia-green" />
              <span className="text-xs text-muted-foreground">Total Tokens</span>
            </div>
            <div className="text-2xl font-mono font-bold">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (inferenceStats?.totalTokens?.toLocaleString() || "0")}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Processed (24h)</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-nvidia-teal" />
              <span className="text-xs text-muted-foreground">Requests</span>
            </div>
            <div className="text-2xl font-mono font-bold">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (inferenceStats?.totalRequests?.toLocaleString() || "0")}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Total (24h)</p>
          </div>
        </div>
        
        {/* Additional Metrics */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-lg font-mono font-bold">{inferenceStats?.totalRequests || 0}</div>
            <div className="text-[10px] text-muted-foreground">Total Requests</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold">{inferenceStats?.avgLatency || "--"}ms</div>
            <div className="text-[10px] text-muted-foreground">Avg Latency</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-nvidia-green">
              {inferenceStats?.successRate || 0}%
            </div>
            <div className="text-[10px] text-muted-foreground">Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold">
              {inferenceStats?.totalTokens?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">Total Tokens</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpertRoutingHeatmap() {
  const [heatmapData] = useState(() => generateExpertHeatmap());
  
  const getHeatColor = (value: number) => {
    if (value < 20) return "bg-muted/30";
    if (value < 40) return "bg-nvidia-teal/20";
    if (value < 60) return "bg-nvidia-teal/40";
    if (value < 80) return "bg-nvidia-green/40";
    return "bg-nvidia-green/70";
  };
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
              <Grid3X3 className="w-5 h-5 text-nvidia-teal" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">MoE Expert Routing</CardTitle>
              <p className="text-xs text-muted-foreground">128 Experts × 32 Layers (visualization)</p>
            </div>
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Layers</SelectItem>
              <SelectItem value="early">Early (1-8)</SelectItem>
              <SelectItem value="mid">Middle (9-24)</SelectItem>
              <SelectItem value="late">Late (25-32)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Heatmap Grid */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] text-muted-foreground w-16">Layer</span>
            <div className="flex-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Expert 0</span>
              <span>Expert 15</span>
            </div>
          </div>
          
          {heatmapData.map((row, layerIdx) => (
            <div key={layerIdx} className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-16 font-mono">L{layerIdx + 1}</span>
              <div className="flex-1 flex gap-0.5">
                {row.map((value, expertIdx) => (
                  <div
                    key={expertIdx}
                    className={cn(
                      "flex-1 h-6 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-nvidia-green/50",
                      getHeatColor(value)
                    )}
                    title={`Layer ${layerIdx + 1}, Expert ${expertIdx}: ${value}% routing`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground">Routing Frequency:</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-muted/30" />
              <span className="text-[10px] text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-nvidia-teal/40" />
              <span className="text-[10px] text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-nvidia-green/70" />
              <span className="text-[10px] text-muted-foreground">High</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemHealthCard() {
  const { data: dcgmData, isLoading, refetch } = trpc.dcgm.getAllMetrics.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );
  
  const hosts = dcgmData?.hosts || [];
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">System Health</CardTitle>
              <p className="text-xs text-muted-foreground">
                {dcgmData?.isLive ? "Live from DGX Spark" : "Connecting..."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-nvidia-green" />
          </div>
        ) : hosts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hosts connected
          </div>
        ) : (
          <div className="space-y-6">
            {hosts.map((host: any) => {
              const gpu = host.gpus?.[0];
              const gpuUtil = gpu?.utilization || 0;
              const gpuMem = gpu?.memoryUsed || 0;
              const cpuUtil = host.systemMetrics?.cpuUtilization || 0;
              const ramUsed = host.systemMetrics?.memoryUsed || 0;
              const ramTotal = host.systemMetrics?.memoryTotal || 120;
              const ramUtil = ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0;
              const temp = gpu?.temperature || 0;
              const power = gpu?.powerDraw || 0;
              
              return (
                <div key={host.hostId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        host.connected ? "bg-nvidia-green animate-pulse" : "bg-nvidia-warning"
                      )} />
                      <span className="text-sm font-semibold">{host.hostName}</span>
                      <span className="text-xs font-mono text-muted-foreground">{host.hostIp}</span>
                    </div>
                    {host.connected && (
                      <span className="text-[10px] text-nvidia-green">ONLINE</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <Cpu className="w-4 h-4 mx-auto mb-1 text-nvidia-green" />
                      <div className="text-sm font-mono font-bold">{gpuUtil}%</div>
                      <div className="text-[10px] text-muted-foreground">GPU</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <HardDrive className="w-4 h-4 mx-auto mb-1 text-nvidia-teal" />
                      <div className="text-sm font-mono font-bold">{gpuMem.toFixed(1)}GB</div>
                      <div className="text-[10px] text-muted-foreground">VRAM</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <Activity className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="text-sm font-mono font-bold">{cpuUtil.toFixed(0)}%</div>
                      <div className="text-[10px] text-muted-foreground">CPU</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <Layers className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="text-sm font-mono font-bold">{ramUtil}%</div>
                      <div className="text-[10px] text-muted-foreground">RAM</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <Thermometer className={cn("w-4 h-4 mx-auto mb-1", temp > 70 ? "text-nvidia-warning" : "text-muted-foreground")} />
                      <div className="text-sm font-mono font-bold">{temp}°C</div>
                      <div className="text-[10px] text-muted-foreground">Temp</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <Zap className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="text-sm font-mono font-bold">{power.toFixed(0)}W</div>
                      <div className="text-[10px] text-muted-foreground">Power</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ThroughputChart() {
  const { data: dcgmData, isLoading } = trpc.dcgm.getAllMetrics.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );
  
  // Use current metrics for display
  const hosts = dcgmData?.hosts || [];
  const currentUtil = (hosts[0] as any)?.gpus?.[0]?.utilization || 0;
  
  // Simple chart data based on current value
  const chartData: Array<{ time: string; value: number }> = [
    { time: "Now", value: currentUtil }
  ];
  
  const maxValue = 100;
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-nvidia-teal" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">GPU Utilization History</CardTitle>
            <p className="text-xs text-muted-foreground">
              {history && history.length > 0 ? `${history.length} data points` : "Collecting data..."}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-nvidia-green" />
          </div>
        ) : (
          <div className="h-32 flex items-end gap-2">
            {chartData.map((point: { time: string; value: number }, idx: number) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-nvidia-green/60 rounded-t transition-all hover:bg-nvidia-green"
                  style={{ height: `${(point.value / maxValue) * 100}%`, minHeight: '4px' }}
                  title={`${point.value}%`}
                />
                <span className="text-[10px] text-muted-foreground">{point.time}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
          <span>Peak: {Math.max(...chartData.map((d: { value: number }) => d.value))}%</span>
          <span>Avg: {Math.round(chartData.reduce((a: number, b: { value: number }) => a + b.value, 0) / chartData.length)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Statistics() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide">
            Statistics & Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live observability metrics from DGX Spark infrastructure
          </p>
        </div>
      </motion.div>
      
      {/* Tabs */}
      <Tabs defaultValue="telemetry" className="space-y-6">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="telemetry" className="gap-2">
            <Activity className="w-4 h-4" />
            Inference
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Server className="w-4 h-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="moe" className="gap-2">
            <Grid3X3 className="w-4 h-4" />
            MoE Routing
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="telemetry" className="space-y-6">
          <motion.div variants={itemVariants}>
            <VLLMTelemetryCard />
          </motion.div>
          <motion.div variants={itemVariants}>
            <ThroughputChart />
          </motion.div>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-6">
          <motion.div variants={itemVariants}>
            <SystemHealthCard />
          </motion.div>
        </TabsContent>
        
        <TabsContent value="moe" className="space-y-6">
          <motion.div variants={itemVariants}>
            <ExpertRoutingHeatmap />
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
