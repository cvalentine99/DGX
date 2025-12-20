import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  RefreshCw,
  Activity,
  Cpu,
  HardDrive,
  Zap,
  Video,
  Camera,
  Network,
  Box,
  GitBranch,
  Layers,
  Terminal,
  Settings,
  ChevronRight,
  Circle,
  ArrowRight,
  Clock,
  Gauge,
  MemoryStick,
  Workflow,
  MonitorPlay,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

// Simulated Holoscan applications
const holoscanApps = [
  {
    id: "endoscopy-pipeline",
    name: "Endoscopy Tool Detection",
    status: "running",
    fragments: 2,
    operators: 8,
    fps: 60,
    latency: 12.5,
    gpuUtil: 45,
    memUsed: 2.8,
  },
  {
    id: "ultrasound-segmentation",
    name: "Ultrasound Segmentation",
    status: "running",
    fragments: 1,
    operators: 5,
    fps: 30,
    latency: 18.2,
    gpuUtil: 32,
    memUsed: 1.9,
  },
  {
    id: "video-analytics",
    name: "Video Analytics Pipeline",
    status: "stopped",
    fragments: 3,
    operators: 12,
    fps: 0,
    latency: 0,
    gpuUtil: 0,
    memUsed: 0,
  },
];

// Pipeline operators for visualization
const pipelineOperators = [
  { id: "source", name: "VideoStreamInput", type: "source", status: "active", x: 0, y: 1 },
  { id: "decoder", name: "VideoDecoder", type: "process", status: "active", x: 1, y: 1 },
  { id: "preprocess", name: "FormatConverter", type: "process", status: "active", x: 2, y: 0 },
  { id: "inference", name: "InferenceOp", type: "inference", status: "active", x: 3, y: 0 },
  { id: "postprocess", name: "PostProcessor", type: "process", status: "active", x: 4, y: 0 },
  { id: "visualizer", name: "HoloViz", type: "sink", status: "active", x: 5, y: 0 },
  { id: "recorder", name: "VideoRecorder", type: "sink", status: "idle", x: 5, y: 2 },
  { id: "splitter", name: "FrameSplitter", type: "process", status: "active", x: 2, y: 2 },
];

const pipelineConnections = [
  { from: "source", to: "decoder" },
  { from: "decoder", to: "preprocess" },
  { from: "decoder", to: "splitter" },
  { from: "preprocess", to: "inference" },
  { from: "inference", to: "postprocess" },
  { from: "postprocess", to: "visualizer" },
  { from: "splitter", to: "recorder" },
];

// Simulated logs
const holoscanLogs = [
  { time: "06:11:23", level: "INFO", message: "[Application] Starting Endoscopy Tool Detection pipeline..." },
  { time: "06:11:23", level: "INFO", message: "[Fragment-0] Initializing operators..." },
  { time: "06:11:24", level: "INFO", message: "[VideoStreamInput] Connected to /dev/video0" },
  { time: "06:11:24", level: "INFO", message: "[InferenceOp] Loading TensorRT engine: tool_detection.engine" },
  { time: "06:11:25", level: "INFO", message: "[InferenceOp] Engine loaded successfully (GPU: 0)" },
  { time: "06:11:25", level: "INFO", message: "[HoloViz] Display initialized: 1920x1080 @ 60Hz" },
  { time: "06:11:26", level: "INFO", message: "[Scheduler] Pipeline started with GreedyScheduler" },
  { time: "06:11:26", level: "DEBUG", message: "[DataFlowTracker] Tracking enabled for all operators" },
  { time: "06:11:30", level: "WARN", message: "[VideoRecorder] Output file not specified, recording disabled" },
  { time: "06:11:35", level: "INFO", message: "[Performance] Avg latency: 12.5ms, FPS: 60.0" },
];

export default function Holoscan() {
  const [selectedApp, setSelectedApp] = useState(holoscanApps[0]);
  const [selectedOperator, setSelectedOperator] = useState<typeof pipelineOperators[0] | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
      case "active":
        return "text-nvidia-green";
      case "stopped":
        return "text-muted-foreground";
      case "idle":
        return "text-nvidia-warning";
      case "error":
        return "text-nvidia-critical";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
      case "active":
        return <CheckCircle2 className="h-4 w-4 text-nvidia-green" />;
      case "stopped":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case "idle":
        return <Circle className="h-4 w-4 text-nvidia-warning" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-nvidia-critical" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getOperatorTypeColor = (type: string) => {
    switch (type) {
      case "source":
        return "bg-blue-500/20 border-blue-500/50 text-blue-400";
      case "inference":
        return "bg-nvidia-green/20 border-nvidia-green/50 text-nvidia-green";
      case "process":
        return "bg-purple-500/20 border-purple-500/50 text-purple-400";
      case "sink":
        return "bg-orange-500/20 border-orange-500/50 text-orange-400";
      default:
        return "bg-muted border-border";
    }
  };

  const handleStartApp = (appId: string) => {
    toast.success(`Starting application: ${appId}`);
  };

  const handleStopApp = (appId: string) => {
    toast.info(`Stopping application: ${appId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-nvidia-green">
            HOLOSCAN PIPELINES
          </h1>
          <p className="text-muted-foreground mt-1">
            AI sensor processing pipeline management • SDK v3.9.0
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">Auto Refresh</Label>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-nvidia-green hover:bg-nvidia-green/90 text-black">
            <Play className="h-4 w-4 mr-2" />
            Deploy New
          </Button>
        </div>
      </div>

      {/* Main Content - Ultrawide optimized grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Applications List */}
        <div className="col-span-3">
          <Card className="cyber-panel h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Workflow className="h-5 w-5 text-nvidia-green" />
                Applications
              </CardTitle>
              <CardDescription>Running Holoscan pipelines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {holoscanApps.map((app) => (
                <motion.div
                  key={app.id}
                  whileHover={{ scale: 1.02 }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedApp.id === app.id
                      ? "border-nvidia-green bg-nvidia-green/10"
                      : "border-border hover:border-nvidia-green/50"
                  }`}
                  onClick={() => setSelectedApp(app)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{app.name}</span>
                    {getStatusIcon(app.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {app.fragments} fragments
                    </div>
                    <div className="flex items-center gap-1">
                      <Box className="h-3 w-3" />
                      {app.operators} operators
                    </div>
                    {app.status === "running" && (
                      <>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-nvidia-green" />
                          {app.fps} FPS
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-nvidia-teal" />
                          {app.latency}ms
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Visualization */}
        <div className="col-span-6">
          <Card className="cyber-panel-glow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-nvidia-green" />
                    Pipeline Graph
                  </CardTitle>
                  <CardDescription>{selectedApp.name}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedApp.status === "running" ? "default" : "secondary"}>
                    {selectedApp.status}
                  </Badge>
                  {selectedApp.status === "running" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStopApp(selectedApp.id)}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-nvidia-green hover:bg-nvidia-green/90 text-black"
                      onClick={() => handleStartApp(selectedApp.id)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Pipeline DAG Visualization */}
              <div className="relative bg-background/50 rounded-lg p-6 min-h-[300px] overflow-auto">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {pipelineConnections.map((conn, idx) => {
                    const fromOp = pipelineOperators.find((o) => o.id === conn.from);
                    const toOp = pipelineOperators.find((o) => o.id === conn.to);
                    if (!fromOp || !toOp) return null;
                    const x1 = fromOp.x * 140 + 100;
                    const y1 = fromOp.y * 80 + 40;
                    const x2 = toOp.x * 140 + 20;
                    const y2 = toOp.y * 80 + 40;
                    return (
                      <g key={idx}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="oklch(0.72 0.19 128 / 0.5)"
                          strokeWidth="2"
                          strokeDasharray={selectedApp.status === "running" ? "none" : "5,5"}
                        />
                        {selectedApp.status === "running" && (
                          <circle r="4" fill="oklch(0.72 0.19 128)">
                            <animateMotion
                              dur="1s"
                              repeatCount="indefinite"
                              path={`M${x1},${y1} L${x2},${y2}`}
                            />
                          </circle>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div className="relative">
                  {pipelineOperators.map((op) => (
                    <motion.div
                      key={op.id}
                      whileHover={{ scale: 1.05 }}
                      className={`absolute cursor-pointer p-2 rounded-lg border-2 transition-all ${getOperatorTypeColor(
                        op.type
                      )} ${selectedOperator?.id === op.id ? "ring-2 ring-nvidia-green" : ""}`}
                      style={{
                        left: op.x * 140,
                        top: op.y * 80,
                        width: 120,
                      }}
                      onClick={() => setSelectedOperator(op)}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {op.status === "active" && selectedApp.status === "running" && (
                          <span className="w-2 h-2 rounded-full bg-nvidia-green animate-pulse" />
                        )}
                        <span className="text-xs font-mono truncate">{op.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0">
                        {op.type}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500/50" />
                  <span>Source</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-500/50" />
                  <span>Process</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-nvidia-green/50" />
                  <span>Inference</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-orange-500/50" />
                  <span>Sink</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Metrics & Details */}
        <div className="col-span-3 space-y-6">
          {/* Performance Metrics */}
          <Card className="cyber-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Gauge className="h-5 w-5 text-nvidia-green" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Frame Rate</span>
                  <span className="font-mono text-nvidia-green">{selectedApp.fps} FPS</span>
                </div>
                <Progress value={selectedApp.fps / 60 * 100} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="font-mono text-nvidia-teal">{selectedApp.latency}ms</span>
                </div>
                <Progress value={100 - selectedApp.latency / 50 * 100} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">GPU Utilization</span>
                  <span className="font-mono">{selectedApp.gpuUtil}%</span>
                </div>
                <Progress value={selectedApp.gpuUtil} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">GPU Memory</span>
                  <span className="font-mono">{selectedApp.memUsed} GB</span>
                </div>
                <Progress value={selectedApp.memUsed / 8 * 100} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Operator Details */}
          {selectedOperator && (
            <Card className="cyber-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Box className="h-5 w-5 text-nvidia-teal" />
                  Operator Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Name</span>
                  <span className="font-mono text-sm">{selectedOperator.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Type</span>
                  <Badge variant="outline">{selectedOperator.type}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Status</span>
                  <span className={`text-sm ${getStatusColor(selectedOperator.status)}`}>
                    {selectedOperator.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Input Ports</span>
                  <span className="font-mono text-sm">1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Output Ports</span>
                  <span className="font-mono text-sm">1</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom Section - Logs & Sensor Preview */}
      <div className="grid grid-cols-12 gap-6">
        {/* Logs */}
        <div className="col-span-8">
          <Card className="cyber-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-nvidia-green" />
                  Application Logs
                </CardTitle>
                <Select defaultValue="all">
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="info">INFO</SelectItem>
                    <SelectItem value="warn">WARN</SelectItem>
                    <SelectItem value="error">ERROR</SelectItem>
                    <SelectItem value="debug">DEBUG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] rounded-lg bg-background/50 p-3">
                <div className="space-y-1 font-mono text-xs">
                  {holoscanLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-muted-foreground">{log.time}</span>
                      <span
                        className={
                          log.level === "ERROR"
                            ? "text-nvidia-critical"
                            : log.level === "WARN"
                            ? "text-nvidia-warning"
                            : log.level === "DEBUG"
                            ? "text-muted-foreground"
                            : "text-nvidia-green"
                        }
                      >
                        [{log.level}]
                      </span>
                      <span className="text-foreground">{log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Sensor Preview */}
        <div className="col-span-4">
          <Card className="cyber-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <MonitorPlay className="h-5 w-5 text-nvidia-green" />
                Sensor Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-background/50 rounded-lg flex items-center justify-center border border-border">
                {selectedApp.status === "running" ? (
                  <div className="text-center">
                    <Video className="h-12 w-12 text-nvidia-green mx-auto mb-2 animate-pulse" />
                    <p className="text-sm text-muted-foreground">Live Feed Active</p>
                    <p className="text-xs text-nvidia-green font-mono">1920x1080 @ 60fps</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No Active Feed</p>
                    <p className="text-xs text-muted-foreground">Start pipeline to preview</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-muted-foreground">Source: /dev/video0</span>
                <Badge variant="outline" className={selectedApp.status === "running" ? "text-nvidia-green" : ""}>
                  {selectedApp.status === "running" ? "Connected" : "Disconnected"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
