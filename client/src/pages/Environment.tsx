/*
 * Environment - Setup & Configuration Hub
 * 
 * Design: Hardware topology visualization, model artifact management,
 * driver compatibility, and containerized runtime orchestration.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Server,
  Cpu,
  HardDrive,
  Download,
  CheckCircle2,
  AlertTriangle,
  Package,
  Container,
  Network,
  Settings,
  RefreshCw,
  ExternalLink,
  Folder,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// Hardware Topology Data
const TOPOLOGY_DATA = {
  hosts: [
    {
      id: "spark-1",
      ip: "192.168.50.139",
      name: "DGX Spark Alpha",
      gpus: [
        { id: "gpu-0", name: "NVIDIA GH200", memory: 128, nvlink: true, pcie: "Gen5 x16" }
      ],
      cpu: "NVIDIA Grace CPU (72 cores)",
      ram: "512GB LPDDR5X",
      storage: "4TB NVMe SSD",
      network: "ConnectX-7 400GbE",
    },
    {
      id: "spark-2",
      ip: "192.168.50.110",
      name: "DGX Spark Beta",
      gpus: [
        { id: "gpu-0", name: "NVIDIA GH200", memory: 128, nvlink: true, pcie: "Gen5 x16" }
      ],
      cpu: "NVIDIA Grace CPU (72 cores)",
      ram: "512GB LPDDR5X",
      storage: "4TB NVMe SSD",
      network: "ConnectX-7 400GbE",
    }
  ],
  interconnect: {
    type: "Ethernet",
    bandwidth: "10GbE",
    latency: "< 1ms"
  }
};

// Driver & Software Stack
const SOFTWARE_STACK = [
  { name: "NVIDIA Driver", version: "550.54.15", status: "compatible", required: "550.x+" },
  { name: "CUDA Toolkit", version: "12.4", status: "compatible", required: "12.x" },
  { name: "cuDNN", version: "8.9.7", status: "compatible", required: "8.9+" },
  { name: "TensorRT", version: "10.0.1", status: "compatible", required: "10.x" },
  { name: "NeMo Framework", version: "2.0.0", status: "compatible", required: "2.0+" },
  { name: "vLLM", version: "0.4.2", status: "compatible", required: "0.4+" },
];

// Model Artifacts
const MODEL_ARTIFACTS = [
  { 
    name: "Nemotron-3-Nano-30B-A3B-BF16", 
    source: "nvidia/Nemotron-3-Nano-30B-A3B-BF16",
    size: "56.2 GB",
    precision: "BF16",
    status: "downloaded",
    path: "/models/nemotron-nano-30b-bf16"
  },
  { 
    name: "Nemotron-3-Nano-30B-A3B-FP8", 
    source: "nvidia/Nemotron-3-Nano-30B-A3B-FP8",
    size: "28.1 GB",
    precision: "FP8",
    status: "available",
    path: null
  },
  { 
    name: "Nemotron-3-Nano-30B-A3B-GGUF", 
    source: "nvidia/Nemotron-3-Nano-30B-A3B-GGUF",
    size: "24.8 GB",
    precision: "Q4_K_M",
    status: "available",
    path: null
  },
];

// Container Images
const CONTAINER_IMAGES = [
  { 
    name: "nvcr.io/nvidia/nemo:24.05", 
    size: "18.4 GB",
    status: "pulled",
    description: "NeMo Framework Container"
  },
  { 
    name: "vllm/vllm-openai:latest", 
    size: "8.2 GB",
    status: "pulled",
    description: "vLLM Inference Server"
  },
  { 
    name: "nvcr.io/nvidia/tensorrt:24.05-py3", 
    size: "12.1 GB",
    status: "available",
    description: "TensorRT Optimization"
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function HardwareTopologyCard() {
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <Network className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">Hardware Topology</CardTitle>
              <p className="text-xs text-muted-foreground">DGX Spark Infrastructure</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Refreshing topology...")}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Visual Topology */}
        <div className="relative p-6 rounded-lg bg-muted/20 border border-border/50 mb-6">
          <div className="flex items-center justify-center gap-16">
            {TOPOLOGY_DATA.hosts.map((host, index) => (
              <div key={host.id} className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-32 h-40 rounded-lg bg-gradient-to-b from-muted to-background border border-border flex flex-col items-center justify-center p-3 glow-border">
                    <Server className="w-8 h-8 text-nvidia-green mb-2" />
                    <span className="text-xs font-display font-semibold text-center">{host.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{host.ip}</span>
                    <div className="hex-status-online mt-2 scale-75" />
                  </div>
                  {/* GPU Indicator */}
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-6 h-12 rounded bg-nvidia-teal/30 border border-nvidia-teal/50 flex items-center justify-center">
                    <Cpu className="w-3 h-3 text-nvidia-teal" />
                  </div>
                </div>
              </div>
            ))}
            
            {/* Interconnect Line */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-24 h-0.5 bg-gradient-to-r from-nvidia-green via-nvidia-teal to-nvidia-green" />
              <span className="text-[10px] font-mono text-muted-foreground mt-1">
                {TOPOLOGY_DATA.interconnect.bandwidth}
              </span>
            </div>
          </div>
        </div>
        
        {/* Host Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {TOPOLOGY_DATA.hosts.map((host) => (
            <div key={host.id} className="p-4 rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-nvidia-green" />
                <span className="text-sm font-semibold">{host.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{host.cpu}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{host.ram}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{host.storage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Network className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{host.network}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-nvidia-teal font-mono">{host.gpus[0].name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-nvidia-teal/20 text-nvidia-teal">
                    {host.gpus[0].memory}GB HBM3
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SoftwareStackCard() {
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-nvidia-teal" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">Software Stack</CardTitle>
            <p className="text-xs text-muted-foreground">Driver & Framework Compatibility</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {SOFTWARE_STACK.map((item, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-3">
                {item.status === "compatible" ? (
                  <CheckCircle2 className="w-4 h-4 text-nvidia-green" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-nvidia-warning" />
                )}
                <div>
                  <span className="text-sm font-medium">{item.name}</span>
                  <p className="text-[10px] text-muted-foreground">Required: {item.required}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-nvidia-green">{item.version}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  item.status === "compatible" 
                    ? "bg-nvidia-green/20 text-nvidia-green"
                    : "bg-nvidia-warning/20 text-nvidia-warning"
                )}>
                  {item.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ModelArtifactsCard() {
  const handleDownload = (model: typeof MODEL_ARTIFACTS[0]) => {
    if (model.status === "downloaded") {
      toast.info(`Model already downloaded at ${model.path}`);
    } else {
      toast.info(`Starting download: ${model.name}`, {
        description: "This feature will be available when connected to Hugging Face Hub"
      });
    }
  };

  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">Model Artifacts</CardTitle>
              <p className="text-xs text-muted-foreground">Hugging Face Hub Integration</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Feature coming soon")}>
            <ExternalLink className="w-4 h-4" />
            Browse Hub
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {MODEL_ARTIFACTS.map((model, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  model.status === "downloaded" ? "bg-nvidia-green/20" : "bg-muted"
                )}>
                  <FileCode className={cn(
                    "w-5 h-5",
                    model.status === "downloaded" ? "text-nvidia-green" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <span className="text-sm font-semibold">{model.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground">{model.source}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-nvidia-teal/20 text-nvidia-teal">
                      {model.precision}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{model.size}</span>
                  </div>
                  {model.path && (
                    <div className="flex items-center gap-1 mt-1">
                      <Folder className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-muted-foreground">{model.path}</span>
                    </div>
                  )}
                </div>
              </div>
              <Button 
                variant={model.status === "downloaded" ? "outline" : "default"}
                size="sm"
                className="gap-2"
                onClick={() => handleDownload(model)}
              >
                {model.status === "downloaded" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Downloaded
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ContainerRuntimeCard() {
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
            <Container className="w-5 h-5 text-nvidia-teal" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">Container Runtime</CardTitle>
            <p className="text-xs text-muted-foreground">Docker & NGC Images</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {CONTAINER_IMAGES.map((image, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Container className={cn(
                  "w-4 h-4",
                  image.status === "pulled" ? "text-nvidia-green" : "text-muted-foreground"
                )} />
                <div>
                  <span className="text-sm font-mono">{image.name}</span>
                  <p className="text-[10px] text-muted-foreground">{image.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{image.size}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  image.status === "pulled" 
                    ? "bg-nvidia-green/20 text-nvidia-green"
                    : "bg-muted text-muted-foreground"
                )}>
                  {image.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Environment() {
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
          ENVIRONMENT SETUP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hardware topology, software stack, and model artifact management
        </p>
      </motion.div>
      
      {/* Hardware Topology */}
      <motion.div variants={itemVariants}>
        <HardwareTopologyCard />
      </motion.div>
      
      {/* Software & Models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <SoftwareStackCard />
        </motion.div>
        <motion.div variants={itemVariants}>
          <ContainerRuntimeCard />
        </motion.div>
      </div>
      
      {/* Model Artifacts */}
      <motion.div variants={itemVariants}>
        <ModelArtifactsCard />
      </motion.div>
    </motion.div>
  );
}
