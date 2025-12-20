/**
 * NGC Catalog Browser Component
 * 
 * Browse and pull NVIDIA container images from NGC registry.
 * Supports NeMo, PyTorch, TensorRT, Triton, and infrastructure containers.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  Copy,
  Check,
  ExternalLink,
  Box,
  Layers,
  Clock,
  Tag,
  Filter,
  ChevronRight,
  Terminal,
  Server,
  Brain,
  Cpu,
  Database,
  Shield,
  Workflow,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// NGC Container Data
interface NgcContainer {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  description: string;
  category: string;
  tags: string[];
  latestTag: string;
  availableTags: string[];
  pullCommand: string;
  updatedAt: string;
  downloads: string;
  size: string;
  features: string[];
  icon: typeof Brain;
}

const NGC_CONTAINERS: NgcContainer[] = [
  // NeMo Framework
  {
    id: "nemo-framework",
    name: "nemo",
    displayName: "NeMo Framework",
    publisher: "NVIDIA",
    description: "NVIDIA NeMo is a scalable generative AI framework for researchers and developers working on Large Language Models, Multimodal, and Speech AI.",
    category: "nemo",
    tags: ["LLM", "Multimodal", "Speech AI", "Training"],
    latestTag: "24.09",
    availableTags: ["24.09", "24.07", "24.05", "24.03", "24.01", "23.11"],
    pullCommand: "docker pull nvcr.io/nvidia/nemo:24.09",
    updatedAt: "2024-09-15",
    downloads: "1.2M+",
    size: "15.8 GB",
    features: ["Megatron-LM", "NeMo Curator", "ASR/TTS", "Multimodal"],
    icon: Brain,
  },
  {
    id: "nemo-curator",
    name: "nemo-curator",
    displayName: "NeMo Curator",
    publisher: "NVIDIA",
    description: "NVIDIA NeMo Curator accelerates generative AI model development with GPU-powered data curation, offering scalable dataset preparation and filtering.",
    category: "nemo",
    tags: ["Data Curation", "GPU", "Scalable"],
    latestTag: "24.09",
    availableTags: ["24.09", "24.07", "24.05"],
    pullCommand: "docker pull nvcr.io/nvidia/nemo-curator:24.09",
    updatedAt: "2024-09-10",
    downloads: "450K+",
    size: "8.2 GB",
    features: ["Deduplication", "Filtering", "Quality Scoring", "Scalable"],
    icon: Database,
  },
  {
    id: "nemo-automodel",
    name: "nemo-automodel",
    displayName: "NeMo AutoModel",
    publisher: "NVIDIA",
    description: "NVIDIA NeMo AutoModel accelerates LLM and VLM training and fine-tuning with PyTorch DTensor-native distributed training.",
    category: "nemo",
    tags: ["LLM", "VLM", "Training", "Fine-tuning"],
    latestTag: "24.09",
    availableTags: ["24.09", "24.07"],
    pullCommand: "docker pull nvcr.io/nvidia/nemo-automodel:24.09",
    updatedAt: "2024-09-12",
    downloads: "280K+",
    size: "12.4 GB",
    features: ["DTensor", "Distributed Training", "LoRA", "QLoRA"],
    icon: Sparkles,
  },
  {
    id: "nemo-guardrails",
    name: "nemo-guardrails",
    displayName: "NeMo Guardrails",
    publisher: "NVIDIA",
    description: "Safety checks and moderation for LLM applications. Add programmable guardrails to LLM-based conversational systems.",
    category: "nemo",
    tags: ["Safety", "Moderation", "Guardrails"],
    latestTag: "0.10.0",
    availableTags: ["0.10.0", "0.9.0", "0.8.0"],
    pullCommand: "docker pull nvcr.io/nvidia/nemo-guardrails:0.10.0",
    updatedAt: "2024-08-20",
    downloads: "320K+",
    size: "4.1 GB",
    features: ["Content Filtering", "Topic Control", "Fact Checking", "Jailbreak Prevention"],
    icon: Shield,
  },
  // Deep Learning
  {
    id: "pytorch",
    name: "pytorch",
    displayName: "PyTorch",
    publisher: "NVIDIA",
    description: "PyTorch is a GPU accelerated tensor computational framework. Functionality can be extended with common Python libraries such as NumPy and SciPy.",
    category: "deep-learning",
    tags: ["Deep Learning", "Training", "GPU"],
    latestTag: "24.09-py3",
    availableTags: ["24.09-py3", "24.07-py3", "24.05-py3", "24.03-py3", "24.01-py3"],
    pullCommand: "docker pull nvcr.io/nvidia/pytorch:24.09-py3",
    updatedAt: "2024-09-20",
    downloads: "5.8M+",
    size: "9.2 GB",
    features: ["CUDA 12.4", "cuDNN 8.9", "NCCL 2.19", "Apex"],
    icon: Brain,
  },
  {
    id: "tensorflow",
    name: "tensorflow",
    displayName: "TensorFlow",
    publisher: "Google",
    description: "TensorFlow is an open source platform for machine learning. It provides comprehensive tools and libraries in a flexible architecture.",
    category: "deep-learning",
    tags: ["Deep Learning", "Training", "GPU"],
    latestTag: "24.09-tf2-py3",
    availableTags: ["24.09-tf2-py3", "24.07-tf2-py3", "24.05-tf2-py3"],
    pullCommand: "docker pull nvcr.io/nvidia/tensorflow:24.09-tf2-py3",
    updatedAt: "2024-09-18",
    downloads: "3.2M+",
    size: "8.7 GB",
    features: ["TF 2.x", "Keras", "TensorBoard", "XLA"],
    icon: Brain,
  },
  // Inference
  {
    id: "tensorrt",
    name: "tensorrt",
    displayName: "TensorRT",
    publisher: "NVIDIA",
    description: "NVIDIA TensorRT is a C++ library that facilitates high-performance inference on NVIDIA GPUs. Takes a trained network and produces an optimized runtime engine.",
    category: "inference",
    tags: ["Inference", "Optimization", "GPU"],
    latestTag: "24.09-py3",
    availableTags: ["24.09-py3", "24.07-py3", "24.05-py3", "24.03-py3"],
    pullCommand: "docker pull nvcr.io/nvidia/tensorrt:24.09-py3",
    updatedAt: "2024-09-22",
    downloads: "2.1M+",
    size: "6.8 GB",
    features: ["INT8 Quantization", "FP16 Precision", "Dynamic Shapes", "Plugin API"],
    icon: Cpu,
  },
  {
    id: "tritonserver",
    name: "tritonserver",
    displayName: "Triton Inference Server",
    publisher: "NVIDIA",
    description: "Triton Inference Server is open source software that lets teams deploy trained AI models from any framework on any GPU or CPU infrastructure.",
    category: "inference",
    tags: ["Inference", "Serving", "Multi-Framework"],
    latestTag: "24.09-py3",
    availableTags: ["24.09-py3", "24.07-py3", "24.05-py3", "24.03-py3"],
    pullCommand: "docker pull nvcr.io/nvidia/tritonserver:24.09-py3",
    updatedAt: "2024-09-21",
    downloads: "1.8M+",
    size: "11.2 GB",
    features: ["Multi-Model", "Dynamic Batching", "Model Ensemble", "gRPC/HTTP"],
    icon: Server,
  },
  {
    id: "tensorrt-llm",
    name: "tensorrt-llm",
    displayName: "TensorRT-LLM",
    publisher: "NVIDIA",
    description: "TensorRT-LLM provides users with an easy-to-use Python API to define Large Language Models and build optimized TensorRT engines for inference.",
    category: "inference",
    tags: ["LLM", "Inference", "Optimization"],
    latestTag: "0.12.0",
    availableTags: ["0.12.0", "0.11.0", "0.10.0", "0.9.0"],
    pullCommand: "docker pull nvcr.io/nvidia/tensorrt-llm:0.12.0",
    updatedAt: "2024-09-15",
    downloads: "890K+",
    size: "14.5 GB",
    features: ["In-flight Batching", "Paged KV Cache", "Quantization", "Multi-GPU"],
    icon: Sparkles,
  },
  // Infrastructure
  {
    id: "cuda",
    name: "cuda",
    displayName: "CUDA",
    publisher: "NVIDIA",
    description: "Container registry for CUDA images. Base images for GPU-accelerated applications with CUDA toolkit pre-installed.",
    category: "infrastructure",
    tags: ["CUDA", "Base Image", "GPU"],
    latestTag: "12.4.1-devel-ubuntu22.04",
    availableTags: ["12.4.1-devel-ubuntu22.04", "12.4.1-runtime-ubuntu22.04", "12.3.2-devel-ubuntu22.04"],
    pullCommand: "docker pull nvcr.io/nvidia/cuda:12.4.1-devel-ubuntu22.04",
    updatedAt: "2024-09-05",
    downloads: "8.5M+",
    size: "4.2 GB",
    features: ["CUDA 12.4", "cuDNN", "NVCC", "Ubuntu 22.04"],
    icon: Cpu,
  },
  {
    id: "gpu-operator",
    name: "gpu-operator",
    displayName: "NVIDIA GPU Operator",
    publisher: "NVIDIA",
    description: "Deploy and Manage NVIDIA GPU resources in Kubernetes. Automates the management of all NVIDIA software components needed to provision GPU.",
    category: "infrastructure",
    tags: ["Kubernetes", "GPU", "Operator"],
    latestTag: "v24.6.0",
    availableTags: ["v24.6.0", "v24.3.0", "v23.9.0"],
    pullCommand: "docker pull nvcr.io/nvidia/gpu-operator:v24.6.0",
    updatedAt: "2024-09-10",
    downloads: "1.5M+",
    size: "2.8 GB",
    features: ["Auto Driver Install", "MIG Support", "vGPU", "DCGM"],
    icon: Workflow,
  },
  {
    id: "dcgm-exporter",
    name: "dcgm-exporter",
    displayName: "DCGM Exporter",
    publisher: "NVIDIA",
    description: "Monitor GPUs in Kubernetes using NVIDIA DCGM. This is an exporter for a Prometheus monitoring solution in Kubernetes.",
    category: "infrastructure",
    tags: ["Monitoring", "Prometheus", "Kubernetes"],
    latestTag: "3.3.6-3.4.2-ubuntu22.04",
    availableTags: ["3.3.6-3.4.2-ubuntu22.04", "3.3.5-3.4.1-ubuntu22.04"],
    pullCommand: "docker pull nvcr.io/nvidia/k8s/dcgm-exporter:3.3.6-3.4.2-ubuntu22.04",
    updatedAt: "2024-08-28",
    downloads: "2.3M+",
    size: "1.2 GB",
    features: ["Prometheus Metrics", "GPU Telemetry", "Health Checks", "Grafana"],
    icon: Layers,
  },
];

const CATEGORIES = [
  { id: "all", label: "All Containers", icon: Box },
  { id: "nemo", label: "NeMo Framework", icon: Brain },
  { id: "deep-learning", label: "Deep Learning", icon: Sparkles },
  { id: "inference", label: "Inference", icon: Cpu },
  { id: "infrastructure", label: "Infrastructure", icon: Server },
];

interface NgcCatalogBrowserProps {
  onPullContainer?: (container: NgcContainer, tag: string) => void;
}

export default function NgcCatalogBrowser({ onPullContainer }: NgcCatalogBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedContainer, setSelectedContainer] = useState<NgcContainer | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Filter containers based on search and category
  const filteredContainers = useMemo(() => {
    return NGC_CONTAINERS.filter((container) => {
      const matchesSearch =
        searchQuery === "" ||
        container.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === "all" || container.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Handle container selection
  const handleSelectContainer = (container: NgcContainer) => {
    setSelectedContainer(container);
    setSelectedTag(container.latestTag);
  };

  // Generate pull command for selected tag
  const getPullCommand = (container: NgcContainer, tag: string) => {
    const baseName = container.pullCommand.split(":")[0];
    return `${baseName}:${tag}`;
  };

  // Copy command to clipboard
  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    toast.success("Pull command copied to clipboard");
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Handle pull action
  const handlePull = () => {
    if (selectedContainer && selectedTag) {
      const command = getPullCommand(selectedContainer, selectedTag);
      if (onPullContainer) {
        onPullContainer(selectedContainer, selectedTag);
      }
      toast.success(`Pull command ready: ${command}`, {
        description: "Execute this command on your DGX Spark host",
      });
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* Container List */}
      <div className="col-span-5 flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search containers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border/50"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "gap-1.5",
                selectedCategory === category.id && "bg-primary text-primary-foreground"
              )}
            >
              <category.icon className="w-3.5 h-3.5" />
              {category.label}
            </Button>
          ))}
        </div>

        {/* Container List */}
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-2">
            {filteredContainers.map((container) => (
              <motion.div
                key={container.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all",
                  selectedContainer?.id === container.id
                    ? "bg-primary/10 border-primary/50"
                    : "bg-card/30 border-border/50 hover:border-primary/30"
                )}
                onClick={() => handleSelectContainer(container)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <container.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {container.displayName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {container.latestTag}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {container.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {container.downloads}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {container.updatedAt}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Container Details */}
      <div className="col-span-7 flex flex-col">
        <AnimatePresence mode="wait">
          {selectedContainer ? (
            <motion.div
              key={selectedContainer.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-4"
            >
              {/* Header */}
              <div className="cyber-panel p-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <selectedContainer.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-foreground font-orbitron">
                        {selectedContainer.displayName}
                      </h3>
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        {selectedContainer.publisher}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedContainer.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedContainer.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="cyber-panel p-3 text-center">
                  <Download className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-lg font-bold text-foreground">
                    {selectedContainer.downloads}
                  </div>
                  <div className="text-xs text-muted-foreground">Downloads</div>
                </div>
                <div className="cyber-panel p-3 text-center">
                  <Layers className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-lg font-bold text-foreground">
                    {selectedContainer.size}
                  </div>
                  <div className="text-xs text-muted-foreground">Image Size</div>
                </div>
                <div className="cyber-panel p-3 text-center">
                  <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-lg font-bold text-foreground">
                    {selectedContainer.updatedAt}
                  </div>
                  <div className="text-xs text-muted-foreground">Last Updated</div>
                </div>
              </div>

              {/* Features */}
              <div className="cyber-panel p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Key Features
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedContainer.features.map((feature) => (
                    <Badge
                      key={feature}
                      className="bg-accent/50 text-accent-foreground border-accent"
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tag Selection */}
              <div className="cyber-panel p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  Select Version
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedContainer.availableTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTag === tag ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTag(tag)}
                      className={cn(
                        selectedTag === tag && "bg-primary text-primary-foreground"
                      )}
                    >
                      {tag}
                      {tag === selectedContainer.latestTag && (
                        <Badge className="ml-1.5 text-[10px] px-1 py-0 bg-green-500/20 text-green-400 border-green-500/30">
                          latest
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Pull Command */}
              <div className="cyber-panel p-4 mt-auto">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  Pull Command
                </h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-md bg-background/50 border border-border/50 text-sm font-mono text-foreground overflow-x-auto">
                    {getPullCommand(selectedContainer, selectedTag)}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      handleCopyCommand(getPullCommand(selectedContainer, selectedTag))
                    }
                  >
                    {copiedCommand === getPullCommand(selectedContainer, selectedTag) ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={handlePull}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Pull to DGX Spark
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open(
                        `https://catalog.ngc.nvidia.com/orgs/nvidia/containers/${selectedContainer.name}`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on NGC
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center text-muted-foreground">
                <Box className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a container</p>
                <p className="text-sm">
                  Choose a container from the list to view details and pull commands
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
