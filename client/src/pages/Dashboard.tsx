/*
 * Dashboard - System Overview
 * 
 * Design: Mission Control overview showing both DGX Spark hosts,
 * system health, model status, and quick access to all modules.
 * Optimized for ultrawide monitors with flexible grid layout.
 */

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// DGX Spark Host Data
const DGX_HOSTS = [
  {
    id: "spark-1",
    ip: "192.168.50.139",
    name: "DGX Spark Alpha",
    status: "online" as const,
    gpuModel: "NVIDIA Grace Hopper",
    gpuCount: 1,
    gpuUtil: 78,
    gpuMemUsed: 45.2,
    gpuMemTotal: 128,
    cpuUtil: 34,
    ramUsed: 89.4,
    ramTotal: 512,
    temp: 62,
    power: 285,
    powerMax: 450,
    uptime: "14d 7h 23m",
  },
  {
    id: "spark-2",
    ip: "192.168.50.110",
    name: "DGX Spark Beta",
    status: "online" as const,
    gpuModel: "NVIDIA Grace Hopper",
    gpuCount: 1,
    gpuUtil: 65,
    gpuMemUsed: 38.7,
    gpuMemTotal: 128,
    cpuUtil: 28,
    ramUsed: 76.2,
    ramTotal: 512,
    temp: 58,
    power: 245,
    powerMax: 450,
    uptime: "14d 7h 23m",
  },
];

// Model Status
const MODEL_STATUS = {
  name: "Nemotron-3-Nano-30B-A3B-BF16",
  architecture: "Mixture of Experts (MoE)",
  experts: 128,
  layers: 32,
  activeExperts: 8,
  precision: "BF16",
  status: "loaded",
  inferenceEngine: "vLLM",
  tokensProcessed: 1247832,
  avgLatency: 42.3,
};

// System Alerts
const SYSTEM_ALERTS = [
  { type: "success", message: "All systems operational", time: "2m ago" },
  { type: "info", message: "Model checkpoint saved successfully", time: "15m ago" },
  { type: "warning", message: "GPU memory usage above 80% on Spark Alpha", time: "1h ago" },
];

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
  color = "nvidia-green"
}: { 
  value: number; 
  max: number; 
  label: string; 
  unit: string;
  icon: React.ElementType;
  color?: string;
}) {
  const percentage = (value / max) * 100;
  const colorClass = percentage > 80 ? "text-nvidia-warning" : `text-${color}`;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", colorClass)} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className={cn("text-sm font-mono font-semibold", colorClass)}>
          {value}{unit}
        </span>
      </div>
      <div className="progress-glow">
        <div 
          className="progress-glow-fill"
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

function HostCard({ host }: { host: typeof DGX_HOSTS[0] }) {
  const isOnline = host.status === "online";
  
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
                <CardTitle className="text-base font-display tracking-wide">{host.name}</CardTitle>
                <p className="text-xs font-mono text-muted-foreground">{host.ip}</p>
              </div>
            </div>
            <div className={cn(
              "hex-status",
              isOnline ? "hex-status-online" : "hex-status-offline"
            )} />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* GPU Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-3 h-3" />
            <span>{host.gpuCount}x {host.gpuModel}</span>
          </div>
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <MetricGauge 
              value={host.gpuUtil} 
              max={100} 
              label="GPU Util" 
              unit="%" 
              icon={Cpu}
            />
            <MetricGauge 
              value={host.gpuMemUsed} 
              max={host.gpuMemTotal} 
              label="GPU Mem" 
              unit="GB" 
              icon={HardDrive}
              color="nvidia-teal"
            />
            <MetricGauge 
              value={host.temp} 
              max={90} 
              label="Temp" 
              unit="°C" 
              icon={Thermometer}
            />
            <MetricGauge 
              value={host.power} 
              max={host.powerMax} 
              label="Power" 
              unit="W" 
              icon={Zap}
              color="nvidia-teal"
            />
          </div>
          
          {/* System Resources */}
          <div className="pt-2 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">CPU Utilization</span>
              <span className="font-mono text-foreground">{host.cpuUtil}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">System RAM</span>
              <span className="font-mono text-foreground">{host.ramUsed}/{host.ramTotal}GB</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-mono text-nvidia-green">{host.uptime}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ModelStatusCard() {
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
                {MODEL_STATUS.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-nvidia-green/20 text-nvidia-green">
                {MODEL_STATUS.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{MODEL_STATUS.architecture}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Experts</span>
              <span className="font-mono font-semibold">{MODEL_STATUS.experts}</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Active</span>
              <span className="font-mono font-semibold text-nvidia-green">{MODEL_STATUS.activeExperts}</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Layers</span>
              <span className="font-mono font-semibold">{MODEL_STATUS.layers}</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/30">
              <span className="text-muted-foreground">Precision</span>
              <span className="font-mono font-semibold">{MODEL_STATUS.precision}</span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Inference Engine</span>
              <span className="font-mono text-nvidia-teal">{MODEL_STATUS.inferenceEngine}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tokens Processed</span>
              <span className="font-mono">{MODEL_STATUS.tokensProcessed.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avg Latency</span>
              <span className="font-mono">{MODEL_STATUS.avgLatency}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SystemAlertsCard() {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-nvidia-green" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-nvidia-warning" />;
      case "error": return <XCircle className="w-4 h-4 text-nvidia-critical" />;
      default: return <Activity className="w-4 h-4 text-nvidia-teal" />;
    }
  };
  
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
            {SYSTEM_ALERTS.map((alert, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-2 rounded bg-muted/30"
              >
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">{alert.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickStatsCard() {
  const stats = [
    { label: "Total Requests", value: "12,847", change: "+12%", icon: TrendingUp },
    { label: "Avg Response Time", value: "42ms", change: "-8%", icon: Clock },
    { label: "Cache Hit Rate", value: "94.2%", change: "+2%", icon: Database },
    { label: "Active Sessions", value: "23", change: "+5", icon: Activity },
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
      </div>
      
      {/* DGX Spark Hosts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {DGX_HOSTS.map((host) => (
          <HostCard key={host.id} host={host} />
        ))}
      </div>
      
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
