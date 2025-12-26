/*
 * Environment - Setup & Configuration Hub
 * 
 * Design: Hardware topology visualization, model artifact management,
 * driver compatibility, and containerized runtime orchestration.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Wifi,
  Cable,
  Activity,
  Zap,
  Info,
  X,
  MemoryStick,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Hardware Topology Data - actual data comes from dcgm.getHosts in production
const TOPOLOGY_DATA = {
  hosts: [
    {
      id: "alpha",
      ip: "192.168.50.110",
      name: "DGX Spark Alpha",
      gpus: [
        { id: "gpu-0", name: "NVIDIA GB10 Grace Blackwell", memory: 128, nvlink: true, pcie: "NVLink-C2C" }
      ],
      cpu: "NVIDIA Grace CPU (20-core Arm)",
      ram: "128GB Unified Memory",
      storage: "1TB NVMe SSD",
      network: "NVIDIA ConnectX",
    },
    {
      id: "beta",
      ip: "192.168.50.139",
      name: "DGX Spark Beta",
      gpus: [
        { id: "gpu-0", name: "NVIDIA GB10 Grace Blackwell", memory: 128, nvlink: true, pcie: "NVLink-C2C" }
      ],
      cpu: "NVIDIA Grace CPU (20-core Arm)",
      ram: "128GB Unified Memory",
      storage: "1TB NVMe SSD",
      network: "NVIDIA ConnectX",
    }
  ],
  interconnect: {
    type: "Ethernet",
    bandwidth: "10GbE",
    latency: "< 1ms"
  }
};

// Driver & Software Stack - fetched from actual system in production
const SOFTWARE_STACK = [
  { name: "NVIDIA Driver", version: "550.54.15", status: "compatible", required: "550.x+" },
  { name: "CUDA Toolkit", version: "12.4", status: "compatible", required: "12.x" },
  { name: "cuDNN", version: "8.9.7", status: "compatible", required: "8.9+" },
  { name: "TensorRT", version: "10.0.1", status: "compatible", required: "10.x" },
  { name: "NeMo Framework", version: "2.0.0", status: "compatible", required: "2.0+" },
  { name: "vLLM", version: "0.4.2", status: "compatible", required: "0.4+" },
];

// Model Artifacts - fetched from HuggingFace cache in production
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

// Container Images - fetched from docker images in production
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
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [networkStats, setNetworkStats] = useState({ rx: 0, tx: 0, latency: 0.8 });
  
  // Fetch live connection status
  const { data: connectionStatus, refetch } = trpc.ssh.getConnectionStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  
  // Simulate network activity
  useEffect(() => {
    const interval = setInterval(() => {
      setNetworkStats({
        rx: Math.floor(Math.random() * 500) + 100,
        tx: Math.floor(Math.random() * 300) + 50,
        latency: +(Math.random() * 0.5 + 0.3).toFixed(2)
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  const getHostStatus = (hostId: string) => {
    if (!connectionStatus) return 'offline';
    const hostKey = hostId === 'spark-1' ? 'alpha' : 'beta';
    const host = (connectionStatus as any)[hostKey];
    if (!host) return 'offline';
    const lastSuccess = host.lastSuccess ? new Date(host.lastSuccess).getTime() : 0;
    const isRecent = Date.now() - lastSuccess < 30000;
    return isRecent ? 'online' : 'offline';
  };
  
  const selectedHostData = selectedHost ? TOPOLOGY_DATA.hosts.find(h => h.id === selectedHost) : null;
  
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
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className={cn("gap-2", isAnimating && "text-nvidia-green")}
              onClick={() => setIsAnimating(!isAnimating)}
            >
              <Activity className={cn("w-4 h-4", isAnimating && "animate-pulse")} />
              {isAnimating ? 'Live' : 'Paused'}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { refetch(); toast.info("Refreshing topology..."); }}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Enhanced Visual Topology */}
        <div className="relative p-8 rounded-lg bg-gradient-to-b from-muted/30 to-background border border-border/50 mb-6 overflow-hidden">
          {/* Background Grid */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-nvidia-green" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          <div className="relative flex items-center justify-center gap-24">
            {TOPOLOGY_DATA.hosts.map((host, index) => {
              const status = getHostStatus(host.id);
              const isSelected = selectedHost === host.id;
              
              return (
                <motion.div 
                  key={host.id} 
                  className="flex flex-col items-center cursor-pointer"
                  onClick={() => setSelectedHost(isSelected ? null : host.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="relative">
                    {/* Main Host Card */}
                    <motion.div 
                      className={cn(
                        "w-40 h-48 rounded-xl bg-gradient-to-b from-muted/80 to-background border-2 flex flex-col items-center justify-center p-4 transition-all duration-300",
                        isSelected ? "border-nvidia-green shadow-lg shadow-nvidia-green/20" : "border-border/50",
                        status === 'online' ? "glow-border" : "opacity-70"
                      )}
                      animate={isSelected ? { y: -5 } : { y: 0 }}
                    >
                      {/* Status Indicator */}
                      <div className={cn(
                        "absolute top-3 right-3 w-3 h-3 rounded-full",
                        status === 'online' ? "bg-nvidia-green animate-pulse" : "bg-red-500"
                      )} />
                      
                      <Server className={cn(
                        "w-10 h-10 mb-3",
                        status === 'online' ? "text-nvidia-green" : "text-muted-foreground"
                      )} />
                      <span className="text-sm font-display font-semibold text-center">{host.name}</span>
                      <span className="text-xs font-mono text-muted-foreground mt-1">{host.ip}</span>
                      
                      {/* Quick Stats */}
                      <div className="mt-3 flex items-center gap-2 text-[10px]">
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-nvidia-green/10">
                          <Cpu className="w-3 h-3 text-nvidia-green" />
                          <span className="text-nvidia-green">20-core</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-nvidia-teal/10">
                          <MemoryStick className="w-3 h-3 text-nvidia-teal" />
                          <span className="text-nvidia-teal">128GB</span>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* GPU Module */}
                    <motion.div 
                      className={cn(
                        "absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-1",
                        status === 'online' 
                          ? "bg-nvidia-teal/20 border-nvidia-teal/50" 
                          : "bg-muted/30 border-border/50"
                      )}
                      animate={isAnimating && status === 'online' ? { 
                        boxShadow: ['0 0 0px rgba(0,204,204,0)', '0 0 10px rgba(0,204,204,0.3)', '0 0 0px rgba(0,204,204,0)']
                      } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Zap className="w-4 h-4 text-nvidia-teal" />
                      <span className="text-[8px] font-mono text-nvidia-teal">GB10</span>
                    </motion.div>
                    
                    {/* Network Interface Indicators */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center",
                        index === 0 ? "bg-blue-500/20 border border-blue-500/50" : "bg-orange-500/20 border border-orange-500/50"
                      )}>
                        {index === 0 ? (
                          <Wifi className="w-3 h-3 text-blue-400" />
                        ) : (
                          <Cable className="w-3 h-3 text-orange-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {/* Animated Interconnect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="relative w-32 h-12 flex flex-col items-center justify-center">
                {/* Connection Line */}
                <svg className="w-full h-2 overflow-visible">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#00cccc" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="4" x2="100%" y2="4" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" />
                  {/* Animated data packets */}
                  {isAnimating && (
                    <>
                      <circle r="4" fill="#3b82f6">
                        <animateMotion dur="1.5s" repeatCount="indefinite" path="M0,4 L128,4" />
                      </circle>
                      <circle r="4" fill="#00cccc">
                        <animateMotion dur="1.5s" repeatCount="indefinite" path="M128,4 L0,4" begin="0.75s" />
                      </circle>
                    </>
                  )}
                </svg>
                
                {/* Network Stats */}
                <div className="mt-2 flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-nvidia-green">↑ {networkStats.tx} MB/s</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-nvidia-teal">↓ {networkStats.rx} MB/s</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Gauge className="w-3 h-3" />
                  <span>{networkStats.latency}ms latency</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-3 right-3 flex items-center gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Wifi className="w-3 h-3 text-blue-400" />
              <span>Wireless</span>
            </div>
            <div className="flex items-center gap-1">
              <Cable className="w-3 h-3 text-orange-400" />
              <span>Ethernet</span>
            </div>
          </div>
        </div>
        
        {/* Selected Host Detail Panel */}
        <AnimatePresence>
          {selectedHostData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-4 rounded-lg bg-nvidia-green/5 border border-nvidia-green/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-nvidia-green" />
                    <span className="text-sm font-semibold">{selectedHostData.name} - Detailed Specs</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedHost(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-nvidia-green" />
                      <span className="text-xs font-semibold">Processor</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedHostData.cpu}</p>
                    <p className="text-[10px] text-nvidia-green mt-1">ARMv9 Architecture</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2 mb-2">
                      <MemoryStick className="w-4 h-4 text-nvidia-teal" />
                      <span className="text-xs font-semibold">Memory</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedHostData.ram}</p>
                    <p className="text-[10px] text-nvidia-teal mt-1">LPDDR5X • NVLink-C2C</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-nvidia-warning" />
                      <span className="text-xs font-semibold">Storage</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedHostData.storage}</p>
                    <p className="text-[10px] text-nvidia-warning mt-1">PCIe Gen5 • 7GB/s</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Network className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold">Network</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedHostData.network}</p>
                    <p className="text-[10px] text-blue-400 mt-1">10GbE • WiFi 6E</p>
                  </div>
                </div>
                
                {/* GPU Details */}
                <div className="mt-4 p-3 rounded-lg bg-nvidia-teal/10 border border-nvidia-teal/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-nvidia-teal" />
                      <div>
                        <span className="text-sm font-semibold text-nvidia-teal">{selectedHostData.gpus[0].name}</span>
                        <p className="text-[10px] text-muted-foreground">Blackwell Architecture • 5th Gen Tensor Cores</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-nvidia-teal/20 text-nvidia-teal">
                        {selectedHostData.gpus[0].memory}GB Unified
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-nvidia-green/20 text-nvidia-green">
                        1 PFLOP FP4
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Host Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {TOPOLOGY_DATA.hosts.map((host) => {
            const status = getHostStatus(host.id);
            return (
              <motion.div 
                key={host.id} 
                className={cn(
                  "p-4 rounded-lg space-y-3 cursor-pointer transition-all",
                  selectedHost === host.id ? "bg-nvidia-green/10 border border-nvidia-green/30" : "bg-muted/30 hover:bg-muted/50"
                )}
                onClick={() => setSelectedHost(selectedHost === host.id ? null : host.id)}
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className={cn("w-4 h-4", status === 'online' ? "text-nvidia-green" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold">{host.name}</span>
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full",
                    status === 'online' ? "bg-nvidia-green/20 text-nvidia-green" : "bg-red-500/20 text-red-400"
                  )}>
                    {status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{host.cpu}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{host.ram}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3 h-3 text-muted-foreground" />
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
              </motion.div>
            );
          })}
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
