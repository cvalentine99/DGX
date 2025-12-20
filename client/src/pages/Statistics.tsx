/*
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// vLLM Telemetry Data
const VLLM_METRICS = {
  ttft: 124, // Time to First Token (ms)
  tpot: 18.5, // Time per Output Token (ms)
  throughput: 1842, // Tokens per second
  kvCacheUtil: 67.3, // KV Cache utilization %
  batchSize: 8,
  queueDepth: 3,
  activeRequests: 12,
  completedRequests: 8472,
};

// System Health per Host
const HOST_HEALTH = [
  {
    id: "spark-1",
    name: "DGX Spark Alpha",
    ip: "192.168.50.139",
    gpuUtil: 78,
    gpuMem: 45.2,
    gpuMemTotal: 128,
    cpuUtil: 34,
    ramUtil: 17.5,
    temp: 62,
    power: 285,
    p2pBandwidth: 450,
  },
  {
    id: "spark-2",
    name: "DGX Spark Beta",
    ip: "192.168.50.110",
    gpuUtil: 65,
    gpuMem: 38.7,
    gpuMemTotal: 128,
    cpuUtil: 28,
    ramUtil: 14.9,
    temp: 58,
    power: 245,
    p2pBandwidth: 450,
  },
];

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

// Throughput History
const THROUGHPUT_HISTORY = [
  { time: "00:00", value: 1650 },
  { time: "04:00", value: 1420 },
  { time: "08:00", value: 1890 },
  { time: "12:00", value: 2100 },
  { time: "16:00", value: 1950 },
  { time: "20:00", value: 1780 },
  { time: "Now", value: 1842 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function VLLMTelemetryCard() {
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">vLLM Inference Telemetry</CardTitle>
              <p className="text-xs text-muted-foreground">Real-time performance metrics</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Refreshing metrics...")}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-nvidia-green" />
              <span className="text-xs text-muted-foreground">TTFT</span>
            </div>
            <div className="text-2xl font-mono font-bold text-nvidia-green">
              {VLLM_METRICS.ttft}
              <span className="text-sm text-muted-foreground ml-1">ms</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Time to First Token</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-nvidia-teal" />
              <span className="text-xs text-muted-foreground">TPOT</span>
            </div>
            <div className="text-2xl font-mono font-bold text-nvidia-teal">
              {VLLM_METRICS.tpot}
              <span className="text-sm text-muted-foreground ml-1">ms</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Time per Output Token</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-nvidia-green" />
              <span className="text-xs text-muted-foreground">Throughput</span>
            </div>
            <div className="text-2xl font-mono font-bold">
              {VLLM_METRICS.throughput.toLocaleString()}
              <span className="text-sm text-muted-foreground ml-1">tok/s</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Generation Speed</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-nvidia-teal" />
              <span className="text-xs text-muted-foreground">KV Cache</span>
            </div>
            <div className="text-2xl font-mono font-bold">
              {VLLM_METRICS.kvCacheUtil}
              <span className="text-sm text-muted-foreground ml-1">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Cache Utilization</p>
          </div>
        </div>
        
        {/* Additional Metrics */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-lg font-mono font-bold">{VLLM_METRICS.batchSize}</div>
            <div className="text-[10px] text-muted-foreground">Batch Size</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold">{VLLM_METRICS.queueDepth}</div>
            <div className="text-[10px] text-muted-foreground">Queue Depth</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-nvidia-green">{VLLM_METRICS.activeRequests}</div>
            <div className="text-[10px] text-muted-foreground">Active Requests</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold">{VLLM_METRICS.completedRequests.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">Completed</div>
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
              <p className="text-xs text-muted-foreground">128 Experts × 32 Layers (showing subset)</p>
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
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
            <Server className="w-5 h-5 text-nvidia-green" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">System Health</CardTitle>
            <p className="text-xs text-muted-foreground">DGX Spark Infrastructure</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {HOST_HEALTH.map((host) => (
            <div key={host.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="hex-status-online scale-75" />
                  <span className="text-sm font-semibold">{host.name}</span>
                  <span className="text-xs font-mono text-muted-foreground">{host.ip}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-2 rounded bg-muted/30 text-center">
                  <Cpu className="w-4 h-4 mx-auto mb-1 text-nvidia-green" />
                  <div className="text-sm font-mono font-bold">{host.gpuUtil}%</div>
                  <div className="text-[10px] text-muted-foreground">GPU</div>
                </div>
                <div className="p-2 rounded bg-muted/30 text-center">
                  <HardDrive className="w-4 h-4 mx-auto mb-1 text-nvidia-teal" />
                  <div className="text-sm font-mono font-bold">{host.gpuMem}GB</div>
                  <div className="text-[10px] text-muted-foreground">VRAM</div>
                </div>
                <div className="p-2 rounded bg-muted/30 text-center">
                  <Activity className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-mono font-bold">{host.cpuUtil}%</div>
                  <div className="text-[10px] text-muted-foreground">CPU</div>
                </div>
                <div className="p-2 rounded bg-muted/30 text-center">
                  <Layers className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-mono font-bold">{host.ramUtil}%</div>
                  <div className="text-[10px] text-muted-foreground">RAM</div>
                </div>
                <div className="p-2 rounded bg-muted/30 text-center">
                  <Thermometer className={cn("w-4 h-4 mx-auto mb-1", host.temp > 70 ? "text-nvidia-warning" : "text-muted-foreground")} />
                  <div className="text-sm font-mono font-bold">{host.temp}°C</div>
                  <div className="text-[10px] text-muted-foreground">Temp</div>
                </div>
                <div className="p-2 rounded bg-muted/30 text-center">
                  <Zap className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-mono font-bold">{host.power}W</div>
                  <div className="text-[10px] text-muted-foreground">Power</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ThroughputChartCard() {
  const maxValue = Math.max(...THROUGHPUT_HISTORY.map(d => d.value));
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-nvidia-teal" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">Throughput History</CardTitle>
            <p className="text-xs text-muted-foreground">24-hour token generation rate</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-40 flex items-end gap-2">
          {THROUGHPUT_HISTORY.map((point, index) => {
            const height = (point.value / maxValue) * 100;
            const isNow = point.time === "Now";
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className={cn(
                    "w-full rounded-t transition-all",
                    isNow ? "bg-nvidia-green glow-green" : "bg-nvidia-teal/50 hover:bg-nvidia-teal"
                  )}
                  style={{ height: `${height}%` }}
                  title={`${point.time}: ${point.value} tok/s`}
                />
                <span className="text-[10px] text-muted-foreground">{point.time}</span>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Peak:</span>
            <span className="font-mono font-bold text-nvidia-green">{maxValue.toLocaleString()} tok/s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Current:</span>
            <span className="font-mono font-bold">{THROUGHPUT_HISTORY[THROUGHPUT_HISTORY.length - 1].value.toLocaleString()} tok/s</span>
          </div>
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
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-display font-bold tracking-wider text-foreground">
          OBSERVABILITY DECK
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time monitoring, MoE routing analysis, and system health
        </p>
      </motion.div>
      
      {/* vLLM Telemetry */}
      <motion.div variants={itemVariants}>
        <VLLMTelemetryCard />
      </motion.div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <ExpertRoutingHeatmap />
        </motion.div>
        <motion.div variants={itemVariants}>
          <ThroughputChartCard />
        </motion.div>
      </div>
      
      {/* System Health */}
      <motion.div variants={itemVariants}>
        <SystemHealthCard />
      </motion.div>
    </motion.div>
  );
}
