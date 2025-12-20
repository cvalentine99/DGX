import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Usb,
  Maximize2,
  SunDim,
  Focus,
  Aperture,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  FileCode,
  Sparkles,
  Brain,
  ImageIcon,
  Mic,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { WebRTCPreviewV2 } from "@/components/WebRTCPreviewV2";

// BRIO Camera Configuration
const brioCameraConfig = {
  name: "Logitech BRIO",
  vendorId: "046d",
  productId: "085e",
  serial: "409CBA2F",
  firmware: "3.17",
  connection: "USB 3.1 Gen 1 SuperSpeed (5 Gbps)",
  powerDraw: "896mA",
  deviceNodes: [
    { path: "/dev/video0", type: "RGB Camera", interface: "IF1" },
    { path: "/dev/video1", type: "Metadata", interface: "IF1" },
    { path: "/dev/video2", type: "IR Camera", interface: "IF2" },
    { path: "/dev/video3", type: "Metadata", interface: "IF2" },
  ],
  resolutions: [
    { label: "4K UHD", width: 3840, height: 2160, fps: [30, 24, 15], formats: ["MJPEG", "H.264"] },
    { label: "QHD", width: 2560, height: 1440, fps: [30, 24, 20, 15], formats: ["MJPEG", "H.264"] },
    { label: "1080p", width: 1920, height: 1080, fps: [60, 30, 24], formats: ["MJPEG", "H.264", "YUY2"] },
    { label: "720p", width: 1280, height: 720, fps: [60, 30, 24], formats: ["MJPEG", "H.264", "YUY2"] },
    { label: "480p", width: 640, height: 480, fps: [90, 60, 30], formats: ["MJPEG", "H.264", "YUY2"] },
  ],
  fieldOfView: [
    { label: "Narrow", angle: 65, description: "Portrait/Close-up" },
    { label: "Medium", angle: 78, description: "Standard" },
    { label: "Wide", angle: 90, description: "Conference/Room" },
  ],
  audio: {
    channels: 2,
    sampleRates: [16000, 24000, 32000, 48000],
    format: "S16_LE",
  },
};

// Holoscan Pipeline Templates
const pipelineTemplates = [
  {
    id: "object-detection",
    name: "Object Detection Pipeline",
    description: "Real-time object detection using YOLO/SSD models",
    icon: Box,
    operators: ["VideoStreamInput", "FormatConverter", "InferenceOp", "PostProcessor", "HoloViz"],
    model: "yolov8n.engine",
    fps: 60,
    latency: "15ms",
  },
  {
    id: "pose-estimation",
    name: "Pose Estimation Pipeline",
    description: "Human pose detection with skeleton overlay",
    icon: Activity,
    operators: ["VideoStreamInput", "Resize", "PoseNet", "SkeletonRenderer", "HoloViz"],
    model: "posenet.engine",
    fps: 30,
    latency: "25ms",
  },
  {
    id: "segmentation",
    name: "Semantic Segmentation",
    description: "Pixel-wise scene segmentation",
    icon: Layers,
    operators: ["VideoStreamInput", "Preprocess", "SegmentationNet", "ColorMapper", "HoloViz"],
    model: "deeplabv3.engine",
    fps: 30,
    latency: "35ms",
  },
  {
    id: "face-detection",
    name: "Face Detection & Recognition",
    description: "Multi-face detection with embedding extraction",
    icon: Eye,
    operators: ["VideoStreamInput", "FaceDetector", "FaceAligner", "FaceNet", "HoloViz"],
    model: "retinaface.engine",
    fps: 60,
    latency: "12ms",
  },
  {
    id: "medical-endoscopy",
    name: "Endoscopy Tool Detection",
    description: "Surgical tool detection for endoscopic procedures",
    icon: Sparkles,
    operators: ["VideoStreamInput", "Debayer", "ToolDetector", "Annotator", "Recorder", "HoloViz"],
    model: "endoscopy_tools.engine",
    fps: 60,
    latency: "10ms",
  },
  {
    id: "ultrasound",
    name: "Ultrasound Segmentation",
    description: "Real-time ultrasound image segmentation",
    icon: Brain,
    operators: ["VideoStreamInput", "SpeckleFilter", "UNetSegment", "ContourExtract", "HoloViz"],
    model: "ultrasound_seg.engine",
    fps: 30,
    latency: "20ms",
  },
];

// Simulated running applications
const initialApps = [
  {
    id: "brio-object-detection",
    name: "BRIO Object Detection",
    template: "object-detection",
    status: "running",
    camera: "/dev/video0",
    resolution: "1920x1080",
    fps: 60,
    actualFps: 58.5,
    latency: 14.2,
    gpuUtil: 35,
    memUsed: 1.8,
    uptime: "2h 15m",
  },
];

// Pipeline operators for visualization
const getOperatorsForTemplate = (templateId: string) => {
  const template = pipelineTemplates.find(t => t.id === templateId);
  if (!template) return [];
  
  return template.operators.map((name, idx) => ({
    id: `op-${idx}`,
    name,
    type: idx === 0 ? "source" : idx === template.operators.length - 1 ? "sink" : 
          name.includes("Inference") || name.includes("Net") || name.includes("Detector") ? "inference" : "process",
    status: "active",
    x: idx,
    y: 0,
    metrics: {
      throughput: Math.floor(Math.random() * 100) + 50,
      latency: Math.random() * 5 + 1,
    },
  }));
};

// Simulated logs
const generateLogs = (appName: string) => [
  { time: new Date().toLocaleTimeString(), level: "INFO", message: `[Application] ${appName} pipeline initialized` },
  { time: new Date().toLocaleTimeString(), level: "INFO", message: "[VideoStreamInput] Connected to /dev/video0 (Logitech BRIO)" },
  { time: new Date().toLocaleTimeString(), level: "INFO", message: "[VideoStreamInput] Format: MJPEG 1920x1080 @ 60fps" },
  { time: new Date().toLocaleTimeString(), level: "INFO", message: "[InferenceOp] Loading TensorRT engine..." },
  { time: new Date().toLocaleTimeString(), level: "INFO", message: "[InferenceOp] Engine loaded on GPU 0 (GB10 Grace Blackwell)" },
  { time: new Date().toLocaleTimeString(), level: "INFO", message: "[HoloViz] Display initialized: 1920x1080 @ 60Hz" },
  { time: new Date().toLocaleTimeString(), level: "INFO", message: "[Scheduler] Pipeline started with GreedyScheduler" },
  { time: new Date().toLocaleTimeString(), level: "DEBUG", message: "[DataFlowTracker] Tracking enabled for all operators" },
  { time: new Date().toLocaleTimeString(), level: "INFO", message: "[Performance] Avg latency: 14.2ms, FPS: 58.5" },
];

export default function Holoscan() {
  const [apps, setApps] = useState(initialApps);
  const [selectedApp, setSelectedApp] = useState(apps[0] || null);
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [cameraConnected, setCameraConnected] = useState(true);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [logs, setLogs] = useState(generateLogs("BRIO Object Detection"));
  
  // Camera configuration state
  const [cameraConfig, setCameraConfig] = useState({
    device: "/dev/video0",
    resolution: "1920x1080",
    fps: 60,
    format: "MJPEG",
    fov: 78,
    brightness: 50,
    contrast: 50,
    saturation: 50,
    sharpness: 50,
    autoExposure: true,
    autoFocus: true,
    audioEnabled: false,
    sampleRate: 48000,
  });

  // New pipeline deployment state
  const [newPipeline, setNewPipeline] = useState({
    template: "",
    name: "",
    camera: "/dev/video0",
    resolution: "1920x1080",
    fps: 60,
    format: "MJPEG",
  });

  const operators = selectedApp ? getOperatorsForTemplate(selectedApp.template) : [];
  const connections = operators.slice(0, -1).map((op, idx) => ({
    from: op.id,
    to: operators[idx + 1]?.id,
  }));

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
    setApps(apps.map(app => 
      app.id === appId ? { ...app, status: "running" } : app
    ));
    toast.success(`Starting pipeline: ${appId}`);
  };

  const handleStopApp = (appId: string) => {
    setApps(apps.map(app => 
      app.id === appId ? { ...app, status: "stopped", actualFps: 0, gpuUtil: 0 } : app
    ));
    toast.info(`Stopping pipeline: ${appId}`);
  };

  const handleDeployPipeline = () => {
    if (!newPipeline.template || !newPipeline.name) {
      toast.error("Please select a template and provide a name");
      return;
    }
    
    const template = pipelineTemplates.find(t => t.id === newPipeline.template);
    const newApp = {
      id: `${newPipeline.template}-${Date.now()}`,
      name: newPipeline.name,
      template: newPipeline.template,
      status: "running" as const,
      camera: newPipeline.camera,
      resolution: newPipeline.resolution,
      fps: newPipeline.fps,
      actualFps: newPipeline.fps * 0.97,
      latency: parseFloat(template?.latency || "15"),
      gpuUtil: Math.floor(Math.random() * 30) + 20,
      memUsed: Math.random() * 2 + 1,
      uptime: "0m",
    };
    
    setApps([...apps, newApp]);
    setSelectedApp(newApp);
    setShowDeployDialog(false);
    setNewPipeline({ template: "", name: "", camera: "/dev/video0", resolution: "1920x1080", fps: 60, format: "MJPEG" });
    toast.success(`Deployed pipeline: ${newPipeline.name}`);
  };

  const handleDeleteApp = (appId: string) => {
    setApps(apps.filter(app => app.id !== appId));
    if (selectedApp?.id === appId) {
      setSelectedApp(apps[0] || null);
    }
    toast.info("Pipeline removed");
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
            AI sensor processing pipeline management • SDK v3.9.0 • GB10 Grace Blackwell
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
          <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
            <DialogTrigger asChild>
              <Button className="bg-nvidia-green hover:bg-nvidia-green/90 text-black">
                <Plus className="h-4 w-4 mr-2" />
                Deploy Pipeline
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-nvidia-green">Deploy New Pipeline</DialogTitle>
                <DialogDescription>
                  Select a pipeline template and configure the video source
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Template Selection */}
                <div className="space-y-3">
                  <Label>Pipeline Template</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {pipelineTemplates.map((template) => (
                      <motion.div
                        key={template.id}
                        whileHover={{ scale: 1.02 }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          newPipeline.template === template.id
                            ? "border-nvidia-green bg-nvidia-green/10"
                            : "border-border hover:border-nvidia-green/50"
                        }`}
                        onClick={() => setNewPipeline({ ...newPipeline, template: template.id, name: template.name })}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <template.icon className="h-4 w-4 text-nvidia-green" />
                          <span className="font-medium text-sm">{template.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{template.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-nvidia-green">{template.fps} FPS</span>
                          <span className="text-nvidia-teal">{template.latency}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Pipeline Name */}
                <div className="space-y-2">
                  <Label>Pipeline Name</Label>
                  <input
                    type="text"
                    value={newPipeline.name}
                    onChange={(e) => setNewPipeline({ ...newPipeline, name: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                    placeholder="My Pipeline"
                  />
                </div>

                {/* Video Source */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Video Source</Label>
                    <Select
                      value={newPipeline.camera}
                      onValueChange={(v) => setNewPipeline({ ...newPipeline, camera: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brioCameraConfig.deviceNodes.filter(d => d.type.includes("Camera")).map((node) => (
                          <SelectItem key={node.path} value={node.path}>
                            {node.path} ({node.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <Select
                      value={newPipeline.resolution}
                      onValueChange={(v) => setNewPipeline({ ...newPipeline, resolution: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brioCameraConfig.resolutions.map((res) => (
                          <SelectItem key={res.label} value={`${res.width}x${res.height}`}>
                            {res.label} ({res.width}x{res.height})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frame Rate</Label>
                    <Select
                      value={newPipeline.fps.toString()}
                      onValueChange={(v) => setNewPipeline({ ...newPipeline, fps: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">90 FPS</SelectItem>
                        <SelectItem value="60">60 FPS</SelectItem>
                        <SelectItem value="30">30 FPS</SelectItem>
                        <SelectItem value="24">24 FPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={newPipeline.format}
                      onValueChange={(v) => setNewPipeline({ ...newPipeline, format: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MJPEG">MJPEG</SelectItem>
                        <SelectItem value="H.264">H.264</SelectItem>
                        <SelectItem value="YUY2">YUY2 (Raw)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  className="w-full bg-nvidia-green hover:bg-nvidia-green/90 text-black"
                  onClick={handleDeployPipeline}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Deploy Pipeline
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Camera Status Banner */}
      <Card className={`cyber-panel ${cameraConnected ? 'border-nvidia-green/50' : 'border-nvidia-critical/50'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${cameraConnected ? 'bg-nvidia-green/20' : 'bg-nvidia-critical/20'}`}>
                <Camera className={`h-6 w-6 ${cameraConnected ? 'text-nvidia-green' : 'text-nvidia-critical'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-semibold">{brioCameraConfig.name}</h3>
                  <Badge variant={cameraConnected ? "default" : "destructive"}>
                    {cameraConnected ? "Connected" : "Disconnected"}
                  </Badge>
                  <Badge variant="outline" className="text-nvidia-teal">4K UHD</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {brioCameraConfig.connection} • Serial: {brioCameraConfig.serial} • FW {brioCameraConfig.firmware}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-nvidia-green font-mono text-lg">/dev/video0</div>
                <div className="text-muted-foreground text-xs">RGB Camera</div>
              </div>
              <div className="text-center">
                <div className="text-nvidia-teal font-mono text-lg">/dev/video2</div>
                <div className="text-muted-foreground text-xs">IR Camera</div>
              </div>
              <div className="text-center">
                <div className="text-purple-400 font-mono text-lg">{brioCameraConfig.powerDraw}</div>
                <div className="text-muted-foreground text-xs">Power Draw</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Ultrawide optimized grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Applications List */}
        <div className="col-span-3">
          <Card className="cyber-panel h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Workflow className="h-5 w-5 text-nvidia-green" />
                Active Pipelines
              </CardTitle>
              <CardDescription>Running Holoscan applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {apps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Workflow className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No pipelines deployed</p>
                  <p className="text-xs">Click "Deploy Pipeline" to start</p>
                </div>
              ) : (
                apps.map((app) => (
                  <motion.div
                    key={app.id}
                    whileHover={{ scale: 1.02 }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedApp?.id === app.id
                        ? "border-nvidia-green bg-nvidia-green/10"
                        : "border-border hover:border-nvidia-green/50"
                    }`}
                    onClick={() => setSelectedApp(app)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm truncate">{app.name}</span>
                      {getStatusIcon(app.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {app.camera.split('/').pop()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" />
                        {app.resolution}
                      </div>
                      {app.status === "running" && (
                        <>
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-nvidia-green" />
                            {app.actualFps.toFixed(1)} FPS
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-nvidia-teal" />
                            {app.latency}ms
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">{app.uptime}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-nvidia-critical"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteApp(app.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
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
                  <CardDescription>{selectedApp?.name || "Select a pipeline"}</CardDescription>
                </div>
                {selectedApp && (
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
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedApp ? (
                <>
                  {/* Pipeline DAG Visualization */}
                  <div className="relative bg-background/50 rounded-lg p-6 min-h-[280px] overflow-auto">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {connections.map((conn, idx) => {
                        const fromOp = operators.find((o) => o.id === conn.from);
                        const toOp = operators.find((o) => o.id === conn.to);
                        if (!fromOp || !toOp) return null;
                        const x1 = fromOp.x * 150 + 110;
                        const y1 = 60;
                        const x2 = toOp.x * 150 + 10;
                        const y2 = 60;
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
                                  dur="0.8s"
                                  repeatCount="indefinite"
                                  path={`M${x1},${y1} L${x2},${y2}`}
                                />
                              </circle>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    <div className="relative flex items-center gap-4">
                      {operators.map((op) => (
                        <motion.div
                          key={op.id}
                          whileHover={{ scale: 1.05 }}
                          className={`cursor-pointer p-3 rounded-lg border-2 transition-all min-w-[120px] ${getOperatorTypeColor(
                            op.type
                          )} ${selectedOperator?.id === op.id ? "ring-2 ring-nvidia-green" : ""}`}
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
                          {selectedApp.status === "running" && (
                            <div className="mt-2 text-[10px] text-muted-foreground">
                              <div>{op.metrics.throughput} msg/s</div>
                              <div>{op.metrics.latency.toFixed(1)}ms</div>
                            </div>
                          )}
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
                </>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  <div className="text-center">
                    <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a pipeline to view its graph</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Metrics & Camera Config */}
        <div className="col-span-3 space-y-6">
          {/* Performance Metrics */}
          {selectedApp && (
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
                    <span className="font-mono text-nvidia-green">{selectedApp.actualFps.toFixed(1)} / {selectedApp.fps} FPS</span>
                  </div>
                  <Progress value={(selectedApp.actualFps / selectedApp.fps) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Latency</span>
                    <span className="font-mono text-nvidia-teal">{selectedApp.latency}ms</span>
                  </div>
                  <Progress value={100 - (selectedApp.latency / 50) * 100} className="h-2" />
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
                    <span className="font-mono">{selectedApp.memUsed.toFixed(1)} GB</span>
                  </div>
                  <Progress value={(selectedApp.memUsed / 8) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Camera Configuration */}
          <Card className="cyber-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Settings className="h-5 w-5 text-nvidia-teal" />
                Camera Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Field of View</Label>
                <div className="flex gap-2">
                  {brioCameraConfig.fieldOfView.map((fov) => (
                    <Button
                      key={fov.angle}
                      size="sm"
                      variant={cameraConfig.fov === fov.angle ? "default" : "outline"}
                      className={cameraConfig.fov === fov.angle ? "bg-nvidia-green text-black" : ""}
                      onClick={() => setCameraConfig({ ...cameraConfig, fov: fov.angle })}
                    >
                      {fov.angle}°
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Brightness</Label>
                  <span className="text-xs text-muted-foreground">{cameraConfig.brightness}%</span>
                </div>
                <Slider
                  value={[cameraConfig.brightness]}
                  onValueChange={([v]) => setCameraConfig({ ...cameraConfig, brightness: v })}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Contrast</Label>
                  <span className="text-xs text-muted-foreground">{cameraConfig.contrast}%</span>
                </div>
                <Slider
                  value={[cameraConfig.contrast]}
                  onValueChange={([v]) => setCameraConfig({ ...cameraConfig, contrast: v })}
                  max={100}
                  step={1}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Auto Exposure</Label>
                <Switch
                  checked={cameraConfig.autoExposure}
                  onCheckedChange={(v) => setCameraConfig({ ...cameraConfig, autoExposure: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Auto Focus</Label>
                <Switch
                  checked={cameraConfig.autoFocus}
                  onCheckedChange={(v) => setCameraConfig({ ...cameraConfig, autoFocus: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Mic className="h-3 w-3" />
                  Audio Capture
                </Label>
                <Switch
                  checked={cameraConfig.audioEnabled}
                  onCheckedChange={(v) => setCameraConfig({ ...cameraConfig, audioEnabled: v })}
                />
              </div>
            </CardContent>
          </Card>
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
                  Pipeline Logs
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
                  {logs.map((log, idx) => (
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

        {/* Sensor Preview - WebRTC Live Stream */}
        <div className="col-span-4">
          <WebRTCPreviewV2
            hostId="alpha"
            camera={cameraConfig.device}
            resolution={cameraConfig.resolution}
            fps={cameraConfig.fps}
            format={cameraConfig.format}
            onStreamStart={() => toast.success("Camera stream started")}
            onStreamStop={() => toast.info("Camera stream stopped")}
          />
        </div>
      </div>
    </div>
  );
}
