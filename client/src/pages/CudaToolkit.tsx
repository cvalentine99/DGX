import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Settings,
  Layers,
  Zap,
  Box,
  Server,
  HardDrive,
  Activity,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  Gauge,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import NgcCatalogBrowser from "@/components/NgcCatalogBrowser";
import { toast } from "sonner";

// Version compatibility data
interface VersionInfo {
  name: string;
  required: string;
  installed: string;
  status: "compatible" | "warning" | "incompatible" | "not_installed";
  description: string;
  icon: React.ElementType;
  color: string;
  features?: string[];
  lastUpdated?: string;
}

interface HostVersions {
  hostname: string;
  ip: string;
  versions: VersionInfo[];
}

// Simulated version data for both DGX Spark hosts
const hostVersionData: HostVersions[] = [
  {
    hostname: "DGX Spark Alpha",
    ip: "192.168.50.139",
    versions: [
      {
        name: "CUDA Toolkit",
        required: "12.x",
        installed: "12.4",
        status: "compatible",
        description: "NVIDIA CUDA Toolkit for GPU-accelerated computing",
        icon: Cpu,
        color: "text-green-400",
        features: ["nvcc compiler", "cuBLAS", "cuFFT", "cuRAND", "cuSPARSE", "NPP"],
        lastUpdated: "2024-11-15",
      },
      {
        name: "cuDNN",
        required: "8.9+",
        installed: "8.9.7",
        status: "compatible",
        description: "NVIDIA CUDA Deep Neural Network library",
        icon: Layers,
        color: "text-green-400",
        features: ["Convolution", "Pooling", "Normalization", "Activation", "RNN", "Attention"],
        lastUpdated: "2024-11-10",
      },
      {
        name: "TensorRT",
        required: "10.x",
        installed: "10.2.0",
        status: "compatible",
        description: "NVIDIA TensorRT for high-performance deep learning inference",
        icon: Zap,
        color: "text-green-400",
        features: ["INT8 Quantization", "FP16 Precision", "Dynamic Shapes", "Plugin API"],
        lastUpdated: "2024-11-12",
      },
      {
        name: "NCCL",
        required: "2.18+",
        installed: "2.19.3",
        status: "compatible",
        description: "NVIDIA Collective Communications Library for multi-GPU",
        icon: Activity,
        color: "text-green-400",
        features: ["AllReduce", "Broadcast", "AllGather", "ReduceScatter"],
        lastUpdated: "2024-11-08",
      },
      {
        name: "Driver",
        required: "535+",
        installed: "550.54.15",
        status: "compatible",
        description: "NVIDIA GPU Driver",
        icon: HardDrive,
        color: "text-green-400",
        features: ["CUDA 12.4 Support", "MIG", "vGPU", "NVLink"],
        lastUpdated: "2024-11-01",
      },
    ],
  },
  {
    hostname: "DGX Spark Beta",
    ip: "192.168.50.110",
    versions: [
      {
        name: "CUDA Toolkit",
        required: "12.x",
        installed: "12.4",
        status: "compatible",
        description: "NVIDIA CUDA Toolkit for GPU-accelerated computing",
        icon: Cpu,
        color: "text-green-400",
        features: ["nvcc compiler", "cuBLAS", "cuFFT", "cuRAND", "cuSPARSE", "NPP"],
        lastUpdated: "2024-11-15",
      },
      {
        name: "cuDNN",
        required: "8.9+",
        installed: "8.9.7",
        status: "compatible",
        description: "NVIDIA CUDA Deep Neural Network library",
        icon: Layers,
        color: "text-green-400",
        features: ["Convolution", "Pooling", "Normalization", "Activation", "RNN", "Attention"],
        lastUpdated: "2024-11-10",
      },
      {
        name: "TensorRT",
        required: "10.x",
        installed: "10.2.0",
        status: "compatible",
        description: "NVIDIA TensorRT for high-performance deep learning inference",
        icon: Zap,
        color: "text-green-400",
        features: ["INT8 Quantization", "FP16 Precision", "Dynamic Shapes", "Plugin API"],
        lastUpdated: "2024-11-12",
      },
      {
        name: "NCCL",
        required: "2.18+",
        installed: "2.19.3",
        status: "compatible",
        description: "NVIDIA Collective Communications Library for multi-GPU",
        icon: Activity,
        color: "text-green-400",
        features: ["AllReduce", "Broadcast", "AllGather", "ReduceScatter"],
        lastUpdated: "2024-11-08",
      },
      {
        name: "Driver",
        required: "535+",
        installed: "550.54.15",
        status: "compatible",
        description: "NVIDIA GPU Driver",
        icon: HardDrive,
        color: "text-green-400",
        features: ["CUDA 12.4 Support", "MIG", "vGPU", "NVLink"],
        lastUpdated: "2024-11-01",
      },
    ],
  },
];

// Compatibility matrix data
const compatibilityMatrix = [
  { cuda: "12.4", cudnn: "8.9.7", tensorrt: "10.2.0", pytorch: "2.3.0", tensorflow: "2.16.0" },
  { cuda: "12.3", cudnn: "8.9.6", tensorrt: "10.1.0", pytorch: "2.2.0", tensorflow: "2.15.0" },
  { cuda: "12.2", cudnn: "8.9.5", tensorrt: "10.0.0", pytorch: "2.1.0", tensorflow: "2.14.0" },
  { cuda: "12.1", cudnn: "8.9.4", tensorrt: "8.6.1", pytorch: "2.0.0", tensorflow: "2.13.0" },
];

// NeMo Framework requirements
const nemoRequirements = {
  name: "NVIDIA NeMo Framework",
  version: "2.0",
  requirements: [
    { component: "CUDA Toolkit", required: "12.1+", status: "compatible" },
    { component: "cuDNN", required: "8.9+", status: "compatible" },
    { component: "TensorRT", required: "10.0+", status: "compatible" },
    { component: "PyTorch", required: "2.2+", status: "compatible" },
    { component: "Python", required: "3.10+", status: "compatible" },
    { component: "Apex", required: "Latest", status: "compatible" },
    { component: "Transformer Engine", required: "1.0+", status: "compatible" },
  ],
};

function getStatusIcon(status: string) {
  switch (status) {
    case "compatible":
      return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    case "incompatible":
      return <XCircle className="w-5 h-5 text-red-400" />;
    default:
      return <AlertTriangle className="w-5 h-5 text-gray-400" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "compatible":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">COMPATIBLE</Badge>;
    case "warning":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">WARNING</Badge>;
    case "incompatible":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">INCOMPATIBLE</Badge>;
    default:
      return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">NOT INSTALLED</Badge>;
  }
}

export default function CudaToolkit() {
  const [selectedHost, setSelectedHost] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Version information refreshed");
    }, 1500);
  };

  const currentHost = hostVersionData[selectedHost];
  const compatibleCount = currentHost.versions.filter(v => v.status === "compatible").length;
  const totalCount = currentHost.versions.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-orbitron text-foreground">
              CUDA TOOLKIT
            </h1>
            <p className="text-muted-foreground mt-1">
              GPU software stack version management and compatibility checking
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Host Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hostVersionData.map((host, index) => (
            <motion.div
              key={host.ip}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`cursor-pointer transition-all ${
                  selectedHost === index
                    ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                    : "bg-card/50 border-border hover:bg-card/80"
                }`}
                onClick={() => setSelectedHost(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedHost === index ? "bg-primary/20" : "bg-white/5"
                      }`}>
                        <Server className={`w-5 h-5 ${selectedHost === index ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{host.hostname}</h3>
                        <p className="text-sm text-muted-foreground font-mono">{host.ip}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Compatibility</p>
                        <p className="text-lg font-bold text-green-400">
                          {host.versions.filter(v => v.status === "compatible").length}/{host.versions.length}
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="versions" className="space-y-4">
          <TabsList className="bg-card/50 border border-border">
            <TabsTrigger value="versions" className="gap-2">
              <Box className="w-4 h-4" />
              Installed Versions
            </TabsTrigger>
            <TabsTrigger value="compatibility" className="gap-2">
              <Shield className="w-4 h-4" />
              Compatibility Matrix
            </TabsTrigger>
            <TabsTrigger value="nemo" className="gap-2">
              <Gauge className="w-4 h-4" />
              NeMo Requirements
            </TabsTrigger>
            <TabsTrigger value="ngc" className="gap-2">
              <Download className="w-4 h-4" />
              NGC Catalog
            </TabsTrigger>
          </TabsList>

          {/* Installed Versions Tab */}
          <TabsContent value="versions" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/50 border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Status</p>
                      <p className="text-2xl font-bold text-green-400">All Compatible</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                  <Progress value={(compatibleCount / totalCount) * 100} className="mt-3 h-2" />
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">CUDA Compute</p>
                      <p className="text-2xl font-bold">SM 9.0</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Cpu className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Grace Hopper Architecture</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Last Checked</p>
                      <p className="text-2xl font-bold">Just Now</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{currentHost.hostname}</p>
                </CardContent>
              </Card>
            </div>

            {/* Version Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentHost.versions.map((version, index) => {
                const Icon = version.icon;
                return (
                  <motion.div
                    key={version.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-card/50 border-border hover:bg-card/80 transition-all">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{version.name}</CardTitle>
                              <CardDescription className="text-xs">
                                Required: {version.required}
                              </CardDescription>
                            </div>
                          </div>
                          {getStatusBadge(version.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                          <span className="text-sm text-muted-foreground">Installed Version</span>
                          <span className="text-xl font-bold font-mono text-primary">
                            {version.installed}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          {version.description}
                        </p>

                        {version.features && (
                          <div className="flex flex-wrap gap-1">
                            {version.features.slice(0, 4).map(feature => (
                              <Badge key={feature} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                            {version.features.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{version.features.length - 4} more
                              </Badge>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5">
                          <span>Last updated: {version.lastUpdated}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View documentation</TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Compatibility Matrix Tab */}
          <TabsContent value="compatibility" className="space-y-4">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Version Compatibility Matrix
                </CardTitle>
                <CardDescription>
                  Tested combinations of CUDA stack components for deep learning frameworks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-3 font-medium text-muted-foreground">CUDA</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">cuDNN</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">TensorRT</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">PyTorch</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">TensorFlow</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compatibilityMatrix.map((row, index) => (
                        <tr
                          key={index}
                          className={`border-b border-white/5 ${
                            index === 0 ? "bg-green-500/5" : ""
                          }`}
                        >
                          <td className="p-3 font-mono">{row.cuda}</td>
                          <td className="p-3 font-mono">{row.cudnn}</td>
                          <td className="p-3 font-mono">{row.tensorrt}</td>
                          <td className="p-3 font-mono">{row.pytorch}</td>
                          <td className="p-3 font-mono">{row.tensorflow}</td>
                          <td className="p-3">
                            {index === 0 ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                INSTALLED
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Available
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Paths */}
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-primary" />
                  Recommended Upgrade Paths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <p className="font-medium">Current Stack (Recommended)</p>
                      <p className="text-sm text-muted-foreground">
                        CUDA 12.4 + cuDNN 8.9.7 + TensorRT 10.2.0
                      </p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">Active</Badge>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <Download className="w-5 h-5 text-blue-400" />
                    <div className="flex-1">
                      <p className="font-medium">Next LTS Release</p>
                      <p className="text-sm text-muted-foreground">
                        CUDA 12.6 + cuDNN 9.0 + TensorRT 10.3.0 (Coming Q1 2025)
                      </p>
                    </div>
                    <Badge variant="outline" className="text-blue-400">Preview</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NeMo Requirements Tab */}
          <TabsContent value="nemo" className="space-y-4">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-primary" />
                      {nemoRequirements.name} v{nemoRequirements.version}
                    </CardTitle>
                    <CardDescription>
                      Software requirements for NeMo training and inference
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    All Requirements Met
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nemoRequirements.requirements.map((req, index) => (
                    <motion.div
                      key={req.component}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(req.status)}
                        <div>
                          <p className="font-medium">{req.component}</p>
                          <p className="text-xs text-muted-foreground">Required: {req.required}</p>
                        </div>
                      </div>
                      {getStatusBadge(req.status)}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* NeMo Container Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">NeMo Container</CardTitle>
                  <CardDescription>Pre-built Docker container with all dependencies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5 font-mono text-sm">
                    nvcr.io/nvidia/nemo:24.11
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Download className="w-3 h-3" />
                      Pull Image
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1">
                      <ExternalLink className="w-3 h-3" />
                      NGC Catalog
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Nemotron Model Requirements</CardTitle>
                  <CardDescription>For NVIDIA-Nemotron-3-Nano-30B-A3B-BF16</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GPU Memory</span>
                      <span className="font-mono">48GB+ (BF16)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">vLLM Version</span>
                      <span className="font-mono">0.6.0+</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Transformers</span>
                      <span className="font-mono">4.44.0+</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Flash Attention</span>
                      <span className="font-mono">2.0+</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* NGC Catalog Browser Tab */}
          <TabsContent value="ngc" className="min-h-[600px]">
            <NgcCatalogBrowser
              onPullContainer={(container, tag) => {
                toast.success(`Ready to pull ${container.displayName}:${tag}`, {
                  description: `Execute on ${currentHost.hostname} (${currentHost.ip})`,
                });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
