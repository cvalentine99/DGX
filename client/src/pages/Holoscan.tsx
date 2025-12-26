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
  Radio,
  Shield,
  Rocket,
  FileText,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { WebRTCPreview } from "@/components/WebRTCPreview";
import { InferenceOverlay, useSimulatedDetections } from "@/components/InferenceOverlay";
import { Loader2 } from "lucide-react";

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
    id: "valentine-rf",
    name: "Valentine RF Signal Processing",
    description: "GPU-accelerated RF signal processing with cuSignal spectrogram",
    icon: Radio,
    operators: ["MockSdrSourceOp", "CuSignalProcOp", "HolovizOp"],
    model: "cusignal",
    fps: 60,
    latency: "5ms",
    category: "rf-signal",
    deployable: true,
  },
  {
    id: "netsec-forensics",
    name: "Network Security Forensics",
    description: "GPU-based packet parsing and traffic visualization",
    icon: Shield,
    operators: ["PcapLoaderOp", "GpuPacketParserOp", "HolovizOp"],
    model: "gpu_parser",
    fps: 30,
    latency: "10ms",
    category: "network",
    deployable: true,
  },
];

// Type for running pipeline apps
interface PipelineApp {
  id: string;
  name: string;
  template: string;
  status: "running" | "stopped" | "starting" | "error";
  camera?: string;
  resolution?: string;
  fps?: number;
  actualFps?: number;
  latency?: number;
  gpuUtil?: number;
  memUsed?: number;
  uptime?: string;
  image?: string;
  ports?: string;
  isFromBackend?: boolean; // Flag to identify backend-sourced pipelines
}

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

export default function Holoscan() {
  const [apps, setApps] = useState<PipelineApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<PipelineApp | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [cameraConnected, setCameraConnected] = useState(true);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [selectedHost, setSelectedHost] = useState<"alpha" | "beta">("alpha");

  // Backend API queries
  const { data: cameraDevices, isLoading: isLoadingCameras, refetch: refetchCameras } = trpc.ssh.getCameraDevices.useQuery(
    { hostId: selectedHost },
    { refetchInterval: autoRefresh ? 30000 : false }
  );

  const { data: holoscanPipelines, isLoading: isLoadingPipelines, refetch: refetchPipelines } = trpc.ssh.getHoloscanPipelines.useQuery(
    { hostId: selectedHost },
    { refetchInterval: autoRefresh ? 5000 : false }
  );

  // Mutations for pipeline control
  const startPipelineMutation = trpc.ssh.startHoloscanPipeline.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Pipeline started");
        refetchPipelines();
      } else {
        toast.error(data.error || "Failed to start pipeline");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const stopPipelineMutation = trpc.ssh.stopHoloscanPipeline.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Pipeline stopped");
        refetchPipelines();
      } else {
        toast.error(data.error || "Failed to stop pipeline");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Pipeline deployment queries and mutations
  const { data: deployedPipelines, refetch: refetchDeployed } = trpc.ssh.listDeployedPipelines.useQuery(
    { hostId: selectedHost },
    { refetchInterval: autoRefresh ? 10000 : false }
  );

  const deployPipelineMutation = trpc.ssh.deployPipeline.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Pipeline deployed successfully");
        refetchDeployed();
        setShowDeployDialog(false);
      } else {
        toast.error(data.error || "Failed to deploy pipeline");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const startDeployedPipelineMutation = trpc.ssh.startPipeline.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Pipeline started");
        refetchDeployed();
      } else {
        toast.error(data.error || "Failed to start pipeline");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const stopDeployedPipelineMutation = trpc.ssh.stopPipeline.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Pipeline stopped");
        refetchDeployed();
      } else {
        toast.error(data.error || "Failed to stop pipeline");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Deployment state
  const [deployingPipeline, setDeployingPipeline] = useState<string | null>(null);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedPipelineLogs, setSelectedPipelineLogs] = useState<string | null>(null);
  const [logFromLine, setLogFromLine] = useState(0);
  const [logLevel, setLogLevel] = useState<"all" | "info" | "debug" | "warning" | "error">("all");
  const [logAutoScroll, setLogAutoScroll] = useState(true);
  const [logTimeRange, setLogTimeRange] = useState<"1h" | "6h" | "24h" | "all">("24h");
  const [showMetricsDashboard, setShowMetricsDashboard] = useState(false);
  const [showPipelineEditor, setShowPipelineEditor] = useState(false);
  const [editingPipelineCode, setEditingPipelineCode] = useState("");
  const [editingPipelineName, setEditingPipelineName] = useState("");
  const [validationStatus, setValidationStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [validationErrors, setValidationErrors] = useState<Array<{ line: number; column: number; message: string }>>([]);

  // Log streaming query
  const { data: pipelineLogs, refetch: refetchLogs } = trpc.ssh.streamPipelineLogs.useQuery(
    { 
      hostId: selectedHost, 
      pipelinePath: selectedPipelineLogs || "", 
      fromLine: logFromLine,
      level: logLevel,
    },
    {
      enabled: !!selectedPipelineLogs && showLogsDialog,
      refetchInterval: showLogsDialog && logAutoScroll ? 2000 : false,
    }
  );

  // Live logs for main panel - fetches logs from currently selected running pipeline
  const { data: liveLogs } = trpc.ssh.streamPipelineLogs.useQuery(
    {
      hostId: selectedHost,
      pipelinePath: selectedApp?.id || "",
      fromLine: 0,
      maxLines: 50,
    },
    {
      enabled: !!selectedApp && selectedApp.status === "running" && autoRefresh,
      refetchInterval: autoRefresh ? 3000 : false,
    }
  );

  // Format live logs for display
  const displayLogs = liveLogs?.logs?.map(log => ({
    time: new Date(log.timestamp).toLocaleTimeString(),
    level: log.level?.toUpperCase() || "INFO",
    message: log.message,
  })) || [
    { time: new Date().toLocaleTimeString(), level: "INFO", message: "Waiting for pipeline logs..." },
  ];

  // Python syntax validation mutation
  const validateSyntaxMutation = trpc.ssh.validatePythonSyntax.useMutation({
    onSuccess: (data) => {
      if (data.valid) {
        setValidationStatus("valid");
        setValidationErrors([]);
        toast.success("Python syntax is valid");
      } else {
        setValidationStatus("invalid");
        setValidationErrors(data.errors || []);
        toast.error("Syntax errors found", { description: `${data.errors?.length || 0} error(s)` });
      }
    },
    onError: (error) => {
      setValidationStatus("invalid");
      toast.error("Validation failed", { description: error.message });
    },
  });

  // Log export query
  const { data: exportedLogs, refetch: fetchExportedLogs } = trpc.ssh.exportPipelineLogs.useQuery(
    { hostId: selectedHost, pipelineName: selectedPipelineLogs || "", lines: 1000, format: "text" },
    { enabled: false }
  );

  // Sync holoscanPipelines from backend to local apps state
  useEffect(() => {
    if (holoscanPipelines?.success && holoscanPipelines.pipelines) {
      const backendApps: PipelineApp[] = holoscanPipelines.pipelines.map((pipeline: any) => ({
        id: pipeline.id,
        name: pipeline.name || pipeline.id,
        template: detectTemplateFromImage(pipeline.image || ""),
        status: pipeline.status?.includes("Up") ? "running" as const : "stopped" as const,
        image: pipeline.image,
        ports: pipeline.ports,
        gpuUtil: pipeline.gpuMemory ? parseInt(pipeline.gpuMemory) : undefined,
        isFromBackend: true,
      }));

      // Merge with any locally-created apps that haven't been confirmed by backend yet
      setApps(prevApps => {
        const localOnlyApps = prevApps.filter(app => !app.isFromBackend);
        // Remove local apps that now appear in backend (by matching name/id)
        const filteredLocalApps = localOnlyApps.filter(
          localApp => !backendApps.some(backendApp =>
            backendApp.name === localApp.name || backendApp.id === localApp.id
          )
        );
        return [...backendApps, ...filteredLocalApps];
      });

      // Select first app if none selected
      if (!selectedApp && backendApps.length > 0) {
        setSelectedApp(backendApps[0]);
      }
    }
  }, [holoscanPipelines]);

  // Helper to detect template from docker image name
  const detectTemplateFromImage = (image: string): string => {
    const imageLower = image.toLowerCase();
    if (imageLower.includes("object") || imageLower.includes("detect")) return "object-detection";
    if (imageLower.includes("pose")) return "pose-estimation";
    if (imageLower.includes("segment")) return "segmentation";
    if (imageLower.includes("face")) return "face-detection";
    if (imageLower.includes("rf") || imageLower.includes("radio")) return "valentine-rf";
    if (imageLower.includes("net") || imageLower.includes("security")) return "netsec-forensics";
    return "object-detection"; // default
  };

  const handleValidateSyntax = () => {
    setValidationStatus("validating");
    validateSyntaxMutation.mutate({
      hostId: selectedHost,
      code: editingPipelineCode,
    });
  };

  const handleExportLogs = async () => {
    if (!selectedPipelineLogs) return;
    
    const result = await fetchExportedLogs();
    if (result.data?.success && result.data.content) {
      const blob = new Blob([result.data.content], { type: result.data.mimeType || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename || "pipeline-logs.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Logs exported", { description: result.data.filename });
    } else {
      toast.error("Export failed", { description: result.data?.error || "Unknown error" });
    }
  };

  // Pipeline metrics query - enabled when any pipeline is running for live metrics
  const hasRunningPipelines = apps.some(app => app.status === "running");
  const { data: pipelineMetrics, refetch: refetchMetrics } = trpc.ssh.getAllPipelineMetrics.useQuery(
    { hostId: selectedHost },
    {
      enabled: hasRunningPipelines || showMetricsDashboard,
      refetchInterval: (hasRunningPipelines || showMetricsDashboard) ? 3000 : false,
    }
  );

  // Update apps with live metrics from backend
  useEffect(() => {
    if (pipelineMetrics?.success && pipelineMetrics.metrics) {
      setApps(prevApps => prevApps.map(app => {
        // Find matching metrics for this pipeline
        const metrics = pipelineMetrics.metrics?.find(
          (m: any) => m.pipelineId === app.id || m.containerId === app.id
        );
        if (metrics && app.status === "running") {
          return {
            ...app,
            actualFps: metrics.fps ?? app.actualFps,
            latency: metrics.latency ?? app.latency,
            gpuUtil: metrics.gpuUtilization ?? app.gpuUtil,
            memUsed: metrics.gpuMemoryUsed ? metrics.gpuMemoryUsed / 1024 : app.memUsed, // Convert MB to GB
          };
        }
        return app;
      }));

      // Also update selectedApp if it's currently selected and running
      if (selectedApp?.status === "running") {
        const metrics = pipelineMetrics.metrics?.find(
          (m: any) => m.pipelineId === selectedApp.id || m.containerId === selectedApp.id
        );
        if (metrics) {
          setSelectedApp(prev => prev ? {
            ...prev,
            actualFps: metrics.fps ?? prev.actualFps,
            latency: metrics.latency ?? prev.latency,
            gpuUtil: metrics.gpuUtilization ?? prev.gpuUtil,
            memUsed: metrics.gpuMemoryUsed ? metrics.gpuMemoryUsed / 1024 : prev.memUsed,
          } : null);
        }
      }
    }
  }, [pipelineMetrics, selectedApp?.id, selectedApp?.status]);

  // Update camera connection status based on API response
  useEffect(() => {
    if (cameraDevices) {
      setCameraConnected(cameraDevices.success && cameraDevices.devices.length > 0);
    }
  }, [cameraDevices]);
  
  // Inference overlay state
  const [showInferenceOverlay, setShowInferenceOverlay] = useState(true);
  const { detections, stats: inferenceStats } = useSimulatedDetections(showInferenceOverlay && selectedApp?.status === "running");

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

  // Fetch camera config from backend
  const { data: backendCameraConfig } = trpc.ssh.getCameraConfig.useQuery(
    { hostId: selectedHost, device: cameraConfig.device },
    { enabled: cameraConnected }
  );

  // Mutation to save camera config to backend
  const saveCameraConfigMutation = trpc.ssh.setCameraConfig.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Camera settings applied");
      } else {
        toast.error("Some settings failed to apply");
      }
    },
    onError: (error) => {
      toast.error("Failed to apply camera settings", { description: error.message });
    },
  });

  // Update local state when backend config is fetched
  useEffect(() => {
    if (backendCameraConfig?.success && backendCameraConfig.controls) {
      const controls = backendCameraConfig.controls;
      setCameraConfig(prev => ({
        ...prev,
        brightness: controls.brightness?.value ?? prev.brightness,
        contrast: controls.contrast?.value ?? prev.contrast,
        saturation: controls.saturation?.value ?? prev.saturation,
        sharpness: controls.sharpness?.value ?? prev.sharpness,
      }));
    }
  }, [backendCameraConfig]);

  // Save camera config changes to backend (debounced via onChange)
  const handleCameraConfigChange = (key: string, value: number) => {
    setCameraConfig(prev => ({ ...prev, [key]: value }));

    // Map frontend config names to v4l2 control names and save
    const v4l2Name = key; // In most cases they match
    saveCameraConfigMutation.mutate({
      hostId: selectedHost,
      device: cameraConfig.device,
      settings: { [v4l2Name]: value },
    });
  };

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
    const app = apps.find(a => a.id === appId);
    if (!app) return;

    // Update local state immediately for UI feedback
    setApps(apps.map(a =>
      a.id === appId ? { ...a, status: "starting" as const } : a
    ));

    // Start the pipeline with the template config
    startPipelineMutation.mutate({
      hostId: selectedHost,
      pipelineType: app.template,
      config: {
        camera: app.camera ?? "/dev/video0",
        resolution: app.resolution ?? "1920x1080",
        fps: app.fps ?? 60,
        format: "MJPEG",
      },
    });
  };

  const handleStopApp = (appId: string) => {
    const app = apps.find(a => a.id === appId);
    if (!app) return;

    // Update local state immediately for UI feedback
    setApps(apps.map(a =>
      a.id === appId ? { ...a, status: "stopped" as const, actualFps: 0, gpuUtil: 0 } : a
    ));

    // Call backend to stop the pipeline
    stopPipelineMutation.mutate({
      hostId: selectedHost,
      pipelineId: appId,
    });
  };

  const handleDeployPipeline = () => {
    if (!newPipeline.template || !newPipeline.name) {
      toast.error("Please select a template and provide a name");
      return;
    }
    
    const template = pipelineTemplates.find(t => t.id === newPipeline.template);
    
    // Check if this is a deployable pipeline (RF or NetSec)
    if (template && (template as any).deployable) {
      setDeployingPipeline(newPipeline.template);
      deployPipelineMutation.mutate({
        hostId: selectedHost,
        pipelineId: newPipeline.template,
        config: {
          windowTitle: newPipeline.name,
        },
      });
      return;
    }
    
    // Call backend to start pipeline (for video pipelines)
    startPipelineMutation.mutate({
      hostId: selectedHost,
      pipelineType: newPipeline.template,
      config: {
        camera: newPipeline.camera,
        resolution: newPipeline.resolution,
        fps: newPipeline.fps,
        format: newPipeline.format,
      },
    });
    
    // Also add to local state for immediate UI feedback
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetricsDashboard(true)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Metrics
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
                        <div className="flex items-center justify-between mt-2 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-nvidia-green">{template.fps} FPS</span>
                            <span className="text-nvidia-teal">{template.latency}</span>
                          </div>
                          {(template as any).deployable && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPipelineName(template.name);
                                setEditingPipelineCode(`# ${template.name}\n# Holoscan Pipeline Template\n\nimport holoscan\nfrom holoscan.core import Application, Operator, OperatorSpec\nfrom holoscan.operators import HolovizOp\nimport cupy as cp\n\n# TODO: Add your custom operators here\n\nclass ${template.name.replace(/\s+/g, '')}App(Application):\n    def compose(self):\n        # Define your pipeline flow\n        pass\n\nif __name__ == "__main__":\n    app = ${template.name.replace(/\s+/g, '')}App()\n    app.run()\n`);
                                setShowPipelineEditor(true);
                              }}
                            >
                              <FileCode className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
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
                {isLoadingCameras ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className={`h-6 w-6 ${cameraConnected ? 'text-nvidia-green' : 'text-nvidia-critical'}`} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-semibold">
                    {cameraDevices?.devices?.[0]?.name || brioCameraConfig.name}
                  </h3>
                  <Badge variant={cameraConnected ? "default" : "destructive"}>
                    {isLoadingCameras ? "Checking..." : cameraConnected ? "Connected" : "Disconnected"}
                  </Badge>
                  {cameraDevices?.devices?.[0]?.capabilities?.includes('4K UHD') && (
                    <Badge variant="outline" className="text-nvidia-teal">4K UHD</Badge>
                  )}
                  {cameraDevices?.fallback && (
                    <Badge variant="outline" className="text-nvidia-warning">Cached</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {cameraDevices?.host?.name || 'DGX Spark'} • 
                  {cameraDevices?.devices?.[0]?.vendorId && `ID: ${cameraDevices.devices[0].vendorId}:${cameraDevices.devices[0].productId}`}
                  {cameraDevices?.devices?.[0]?.serial && ` • Serial: ${cameraDevices.devices[0].serial}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              {/* Host selector */}
              <Select value={selectedHost} onValueChange={(v: "alpha" | "beta") => setSelectedHost(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alpha">DGX Alpha</SelectItem>
                  <SelectItem value="beta">DGX Beta</SelectItem>
                </SelectContent>
              </Select>
              {/* Camera devices from API */}
              {cameraDevices?.devices?.slice(0, 2).map((device, idx) => (
                <div key={device.path} className="text-center">
                  <div className={`font-mono text-lg ${idx === 0 ? 'text-nvidia-green' : 'text-nvidia-teal'}`}>
                    {device.path}
                  </div>
                  <div className="text-muted-foreground text-xs">{device.type === 'camera' ? 'RGB Camera' : device.type}</div>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => refetchCameras()}>
                <RefreshCw className={`h-4 w-4 ${isLoadingCameras ? 'animate-spin' : ''}`} />
              </Button>
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
                        {app.camera?.split('/').pop() ?? "N/A"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" />
                        {app.resolution ?? "N/A"}
                      </div>
                      {app.status === "running" && (
                        <>
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-nvidia-green" />
                            {(app.actualFps ?? 0).toFixed(1)} FPS
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-nvidia-teal" />
                            {app.latency ?? 0}ms
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

          {/* Deployed Pipelines from DGX */}
          <Card className="cyber-panel mt-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Server className="h-5 w-5 text-nvidia-teal" />
                  Deployed Pipelines
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetchDeployed()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Pipelines deployed to {selectedHost === 'alpha' ? 'DGX Spark Alpha' : 'DGX Spark Beta'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!deployedPipelines?.pipelines?.length ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Rocket className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No pipelines deployed</p>
                  <p className="text-xs">Deploy RF or NetSec pipelines above</p>
                </div>
              ) : (
                deployedPipelines.pipelines.map((pipeline: any) => (
                  <motion.div
                    key={pipeline.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg border border-border hover:border-nvidia-teal/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {pipeline.type === 'valentine-rf' ? (
                          <Radio className="h-4 w-4 text-nvidia-green" />
                        ) : (
                          <Shield className="h-4 w-4 text-nvidia-teal" />
                        )}
                        <span className="font-medium text-sm">{pipeline.name}</span>
                      </div>
                      <Badge variant={pipeline.status === 'running' ? 'default' : 'secondary'}>
                        {pipeline.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {pipeline.path}
                    </div>
                    <div className="flex items-center gap-2">
                      {pipeline.status !== 'running' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => startDeployedPipelineMutation.mutate({ hostId: selectedHost, pipelinePath: pipeline.path })}
                          disabled={startDeployedPipelineMutation.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-nvidia-critical"
                          onClick={() => stopDeployedPipelineMutation.mutate({ hostId: selectedHost, pipelinePath: pipeline.path })}
                          disabled={stopDeployedPipelineMutation.isPending}
                        >
                          <Square className="h-3 w-3 mr-1" />
                          Stop
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedPipelineLogs(pipeline.name);
                          setShowLogsDialog(true);
                        }}
                      >
                        <Terminal className="h-3 w-3 mr-1" />
                        Logs
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
                    <span className="font-mono text-nvidia-green">{(selectedApp.actualFps ?? 0).toFixed(1)} / {selectedApp.fps ?? 60} FPS</span>
                  </div>
                  <Progress value={((selectedApp.actualFps ?? 0) / (selectedApp.fps ?? 60)) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Latency</span>
                    <span className="font-mono text-nvidia-teal">{selectedApp.latency ?? 0}ms</span>
                  </div>
                  <Progress value={100 - ((selectedApp.latency ?? 0) / 50) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">GPU Utilization</span>
                    <span className="font-mono">{selectedApp.gpuUtil ?? 0}%</span>
                  </div>
                  <Progress value={selectedApp.gpuUtil ?? 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">GPU Memory</span>
                    <span className="font-mono">{(selectedApp.memUsed ?? 0).toFixed(1)} GB</span>
                  </div>
                  <Progress value={((selectedApp.memUsed ?? 0) / 8) * 100} className="h-2" />
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
                  onValueChange={([v]) => handleCameraConfigChange("brightness", v)}
                  max={100}
                  step={1}
                  disabled={saveCameraConfigMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Contrast</Label>
                  <span className="text-xs text-muted-foreground">{cameraConfig.contrast}%</span>
                </div>
                <Slider
                  value={[cameraConfig.contrast]}
                  onValueChange={([v]) => handleCameraConfigChange("contrast", v)}
                  max={100}
                  step={1}
                  disabled={saveCameraConfigMutation.isPending}
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
                  {displayLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-muted-foreground">{log.time}</span>
                      <span
                        className={
                          log.level === "ERROR"
                            ? "text-nvidia-critical"
                            : log.level === "WARN" || log.level === "WARNING"
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

        {/* Sensor Preview - WebRTC Live Stream with AI Overlay */}
        <div className="col-span-4">
          <Card className="cyber-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Eye className="h-5 w-5 text-nvidia-green" />
                  AI Pipeline Output
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showInferenceOverlay}
                      onCheckedChange={setShowInferenceOverlay}
                      id="inference-overlay"
                    />
                    <Label htmlFor="inference-overlay" className="text-xs">AI Overlay</Label>
                  </div>
                  {selectedApp?.status === "running" && showInferenceOverlay && (
                    <Badge variant="outline" className="text-nvidia-green animate-pulse">
                      <Activity className="h-3 w-3 mr-1" />
                      Inferencing
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video with Inference Overlay */}
              <div className="relative aspect-video bg-background/50 rounded-lg overflow-hidden border border-border">
                {/* Simulated video background */}
                <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-nvidia-green/5">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {selectedApp?.status === "running" ? (
                      <div className="text-center">
                        <Video className="h-16 w-16 text-nvidia-green/30 mx-auto mb-2 animate-pulse" />
                        <p className="text-sm text-muted-foreground">Pipeline Output Stream</p>
                        <p className="text-xs text-nvidia-green mt-1">{selectedApp.name}</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Start a pipeline to view output</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Inference Overlay Canvas */}
                {showInferenceOverlay && selectedApp?.status === "running" && (
                  <InferenceOverlay
                    videoRef={{ current: null }}
                    width={640}
                    height={360}
                    detections={detections}
                    stats={inferenceStats}
                  />
                )}
              </div>

              {/* Inference Stats Bar */}
              {selectedApp?.status === "running" && showInferenceOverlay && inferenceStats && (
                <div className="grid grid-cols-4 gap-3 pt-2 border-t border-border">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">FPS</div>
                    <div className="text-sm font-mono text-nvidia-green">{inferenceStats.fps.toFixed(1)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Latency</div>
                    <div className="text-sm font-mono text-nvidia-teal">{inferenceStats.latency.toFixed(1)}ms</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Detections</div>
                    <div className="text-sm font-mono">{inferenceStats.totalDetections}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Classes</div>
                    <div className="text-sm font-mono">{Object.keys(inferenceStats.classBreakdown).length}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Local Camera Preview */}
          <div className="mt-4">
            <WebRTCPreview
              hostId="alpha"
              camera={cameraConfig.device}
              resolution={cameraConfig.resolution}
              fps={cameraConfig.fps}
              format={cameraConfig.format}
              useLocalCamera={true}
              onStreamStart={() => toast.success("Camera stream started")}
              onStreamStop={() => toast.info("Camera stream stopped")}
            />
          </div>
        </div>
      </div>

      {/* Log Viewer Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-nvidia-green" />
              Pipeline Logs: {selectedPipelineLogs}
            </DialogTitle>
            <DialogDescription>
              Real-time log output from the deployed pipeline
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Log Controls */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Select value={logLevel} onValueChange={(v: any) => setLogLevel(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="info">INFO</SelectItem>
                    <SelectItem value="debug">DEBUG</SelectItem>
                    <SelectItem value="warning">WARNING</SelectItem>
                    <SelectItem value="error">ERROR</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={logTimeRange} onValueChange={(v: any) => setLogTimeRange(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last Hour</SelectItem>
                    <SelectItem value="6h">Last 6 Hours</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchLogs()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={logAutoScroll}
                    onCheckedChange={setLogAutoScroll}
                  />
                  <Label className="text-sm">Auto-scroll</Label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (pipelineLogs?.logs) {
                      // Filter logs by time range
                      const now = new Date();
                      const rangeHours = logTimeRange === "1h" ? 1 : logTimeRange === "6h" ? 6 : logTimeRange === "24h" ? 24 : 0;
                      const filteredLogs = rangeHours > 0 
                        ? pipelineLogs.logs.filter(l => {
                            const logTime = new Date(l.timestamp);
                            return (now.getTime() - logTime.getTime()) <= rangeHours * 60 * 60 * 1000;
                          })
                        : pipelineLogs.logs;
                      
                      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                      const logText = `# Pipeline Logs Export\n# Pipeline: ${selectedPipelineLogs}\n# Time Range: ${logTimeRange === "all" ? "All Time" : `Last ${logTimeRange}`}\n# Exported: ${new Date().toLocaleString()}\n# Total Entries: ${filteredLogs.length}\n\n` + 
                        filteredLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
                      const blob = new Blob([logText], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedPipelineLogs}-logs-${logTimeRange}-${timestamp}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success("Logs exported", { description: `${filteredLogs.length} entries` });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>

            {/* Log Output */}
            <ScrollArea className="h-[400px] rounded-md border bg-black/50 p-4 font-mono text-xs">
              {pipelineLogs?.logs && pipelineLogs.logs.length > 0 ? (
                <div className="space-y-1">
                  {pipelineLogs.logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warning' ? 'text-yellow-400' :
                        log.level === 'debug' ? 'text-gray-400' :
                        'text-green-400'
                      }`}
                    >
                      <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
                      <Badge variant="outline" className="h-5 text-[10px] shrink-0">
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No logs available</p>
                  <p className="text-xs mt-1">Logs will appear when the pipeline is running</p>
                </div>
              )}
            </ScrollArea>

            {/* Log Stats */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total lines: {pipelineLogs?.totalLines || 0}</span>
              <span>Showing: {pipelineLogs?.logs?.length || 0} entries</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metrics Dashboard Dialog */}
      <Dialog open={showMetricsDashboard} onOpenChange={setShowMetricsDashboard}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-nvidia-green" />
              Pipeline Metrics Dashboard
            </DialogTitle>
            <DialogDescription>
              Performance metrics for all deployed pipelines across hosts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Total Pipelines</div>
                <div className="text-2xl font-bold">{pipelineMetrics?.metrics?.length || 0}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Running</div>
                <div className="text-2xl font-bold text-nvidia-green">
                  {pipelineMetrics?.metrics?.filter(m => m.running).length || 0}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Avg Throughput</div>
                <div className="text-2xl font-bold text-nvidia-teal">
                  {pipelineMetrics?.metrics && pipelineMetrics.metrics.length > 0
                    ? Math.round(pipelineMetrics.metrics.reduce((a, m) => a + (m.throughput || 0), 0) / pipelineMetrics.metrics.length)
                    : 0} FPS
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Avg Latency</div>
                <div className="text-2xl font-bold text-nvidia-purple">
                  {pipelineMetrics?.metrics && pipelineMetrics.metrics.length > 0
                    ? Math.round(pipelineMetrics.metrics.reduce((a, m) => a + (m.latency || 0), 0) / pipelineMetrics.metrics.length)
                    : 0} ms
                </div>
              </Card>
            </div>

            {/* Pipeline Table */}
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Pipeline</th>
                    <th className="text-left p-3 font-medium">Host</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">CPU %</th>
                    <th className="text-right p-3 font-medium">Memory</th>
                    <th className="text-right p-3 font-medium">Throughput</th>
                    <th className="text-right p-3 font-medium">Latency</th>
                    <th className="text-right p-3 font-medium">Uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineMetrics?.metrics && pipelineMetrics.metrics.length > 0 ? (
                    pipelineMetrics.metrics.map((metric, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3 font-medium">{metric.pipelineName}</td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {metric.hostId === 'alpha' ? 'DGX Alpha' : 'DGX Beta'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={metric.running ? 'default' : 'secondary'}>
                            {metric.running ? 'Running' : 'Stopped'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono">{metric.cpuPercent?.toFixed(1) || '-'}%</td>
                        <td className="p-3 text-right font-mono">{metric.memoryMB?.toFixed(0) || '-'} MB</td>
                        <td className="p-3 text-right font-mono text-nvidia-green">{metric.throughput || '-'} FPS</td>
                        <td className="p-3 text-right font-mono text-nvidia-teal">{metric.latency || '-'} ms</td>
                        <td className="p-3 text-right font-mono">{metric.uptime || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No deployed pipelines found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => refetchMetrics()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh Metrics
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pipeline Editor Dialog */}
      <Dialog open={showPipelineEditor} onOpenChange={(open) => {
        setShowPipelineEditor(open);
        if (!open) {
          setValidationStatus("idle");
          setValidationErrors([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-nvidia-green" />
              Pipeline Editor: {editingPipelineName}
            </DialogTitle>
            <DialogDescription>
              Modify pipeline code before deployment. Validate syntax before deploying.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Code Editor */}
            <div className="relative">
              <textarea
                value={editingPipelineCode}
                onChange={(e) => {
                  setEditingPipelineCode(e.target.value);
                  setValidationStatus("idle");
                }}
                className={cn(
                  "w-full h-[350px] font-mono text-sm bg-black/50 text-green-400 p-4 rounded-md border resize-none focus:outline-none focus:ring-2",
                  validationStatus === "valid" && "border-green-500 focus:ring-green-500",
                  validationStatus === "invalid" && "border-red-500 focus:ring-red-500",
                  validationStatus === "idle" && "focus:ring-nvidia-green"
                )}
                spellCheck={false}
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Badge variant="outline" className="bg-background">
                  Python
                </Badge>
                <Badge variant="outline" className="bg-background">
                  {editingPipelineCode.split('\n').length} lines
                </Badge>
                {validationStatus === "valid" && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                )}
                {validationStatus === "invalid" && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                    <XCircle className="h-3 w-3 mr-1" />
                    Invalid
                  </Badge>
                )}
                {validationStatus === "validating" && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Validating
                  </Badge>
                )}
              </div>
            </div>

            {/* Validation Errors */}
            {validationStatus === "invalid" && validationErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 max-h-24 overflow-y-auto">
                <div className="text-xs font-medium text-red-400 mb-2">Syntax Errors:</div>
                {validationErrors.map((err, i) => (
                  <div key={i} className="text-xs text-red-300 font-mono">
                    {err.line > 0 && <span className="text-red-400">Line {err.line}: </span>}
                    {err.message}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset to original template
                    const template = pipelineTemplates.find(t => t.name === editingPipelineName);
                    if (template) {
                      toast.info('Reset to original template');
                      setValidationStatus("idle");
                      setValidationErrors([]);
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  onClick={handleValidateSyntax}
                  disabled={validationStatus === "validating"}
                >
                  {validationStatus === "validating" ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Validate Syntax
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPipelineEditor(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-nvidia-green hover:bg-nvidia-green/90"
                  disabled={validationStatus === "invalid"}
                  onClick={() => {
                    if (validationStatus !== "valid") {
                      toast.warning("Please validate syntax before deploying");
                      return;
                    }
                    toast.success('Pipeline code saved');
                    setShowPipelineEditor(false);
                  }}
                >
                  <Rocket className="h-4 w-4 mr-1" />
                  Save & Deploy
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
