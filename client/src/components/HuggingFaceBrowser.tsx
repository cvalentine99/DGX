import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Download,
  ExternalLink,
  Cpu,
  HardDrive,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  Brain,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Curated list of popular HuggingFace models for LLM/AI workloads
const HF_MODELS = [
  {
    id: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
    name: "Nemotron-3-Nano-30B",
    publisher: "NVIDIA",
    description: "30B parameter MoE model with 3B active parameters. Optimized for reasoning and instruction following.",
    tags: ["MoE", "Reasoning", "BF16", "30B"],
    downloads: "125K+",
    likes: 892,
    size: "60 GB",
    lastUpdated: "2024-12-01",
    category: "nvidia",
    gated: false,
  },
  {
    id: "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF",
    name: "Llama-3.1-Nemotron-70B",
    publisher: "NVIDIA",
    description: "NVIDIA's fine-tuned version of Llama 3.1 70B optimized for helpfulness and instruction following.",
    tags: ["Llama", "70B", "Instruct", "HF"],
    downloads: "450K+",
    likes: 2341,
    size: "140 GB",
    lastUpdated: "2024-11-15",
    category: "nvidia",
    gated: true,
  },
  {
    id: "nvidia/Mistral-NeMo-12B-Instruct",
    name: "Mistral-NeMo-12B",
    publisher: "NVIDIA",
    description: "12B parameter model jointly developed by NVIDIA and Mistral AI for enterprise applications.",
    tags: ["Mistral", "12B", "Instruct", "Enterprise"],
    downloads: "890K+",
    likes: 3456,
    size: "24 GB",
    lastUpdated: "2024-10-20",
    category: "nvidia",
    gated: false,
  },
  {
    id: "meta-llama/Llama-3.3-70B-Instruct",
    name: "Llama 3.3 70B Instruct",
    publisher: "Meta",
    description: "Meta's latest Llama 3.3 70B instruction-tuned model with improved reasoning capabilities.",
    tags: ["Llama", "70B", "Instruct", "Latest"],
    downloads: "2.1M+",
    likes: 8923,
    size: "140 GB",
    lastUpdated: "2024-12-06",
    category: "llama",
    gated: true,
  },
  {
    id: "meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B Instruct",
    publisher: "Meta",
    description: "Efficient 8B parameter model ideal for deployment on consumer hardware.",
    tags: ["Llama", "8B", "Instruct", "Efficient"],
    downloads: "5.2M+",
    likes: 12456,
    size: "16 GB",
    lastUpdated: "2024-07-23",
    category: "llama",
    gated: true,
  },
  {
    id: "mistralai/Mistral-Large-Instruct-2411",
    name: "Mistral Large Instruct",
    publisher: "Mistral AI",
    description: "Mistral's flagship large model with 123B parameters for complex reasoning tasks.",
    tags: ["Mistral", "123B", "Large", "Reasoning"],
    downloads: "320K+",
    likes: 1892,
    size: "246 GB",
    lastUpdated: "2024-11-20",
    category: "mistral",
    gated: false,
  },
  {
    id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    name: "Mixtral 8x7B Instruct",
    publisher: "Mistral AI",
    description: "Sparse Mixture of Experts model with 8 experts, each 7B parameters.",
    tags: ["MoE", "8x7B", "Sparse", "Efficient"],
    downloads: "1.8M+",
    likes: 7234,
    size: "93 GB",
    lastUpdated: "2024-01-08",
    category: "mistral",
    gated: false,
  },
  {
    id: "Qwen/Qwen2.5-72B-Instruct",
    name: "Qwen 2.5 72B Instruct",
    publisher: "Alibaba",
    description: "Alibaba's latest 72B model with strong multilingual and coding capabilities.",
    tags: ["Qwen", "72B", "Multilingual", "Coding"],
    downloads: "890K+",
    likes: 4567,
    size: "144 GB",
    lastUpdated: "2024-09-19",
    category: "qwen",
    gated: false,
  },
  {
    id: "Qwen/Qwen2.5-Coder-32B-Instruct",
    name: "Qwen 2.5 Coder 32B",
    publisher: "Alibaba",
    description: "Specialized coding model with 32B parameters, excels at code generation and debugging.",
    tags: ["Qwen", "32B", "Coder", "Programming"],
    downloads: "450K+",
    likes: 2891,
    size: "64 GB",
    lastUpdated: "2024-11-12",
    category: "qwen",
    gated: false,
  },
  {
    id: "deepseek-ai/DeepSeek-V3",
    name: "DeepSeek V3",
    publisher: "DeepSeek",
    description: "DeepSeek's latest flagship model with strong reasoning and math capabilities.",
    tags: ["DeepSeek", "Reasoning", "Math", "Latest"],
    downloads: "1.2M+",
    likes: 5678,
    size: "128 GB",
    lastUpdated: "2024-12-15",
    category: "deepseek",
    gated: false,
  },
  {
    id: "google/gemma-2-27b-it",
    name: "Gemma 2 27B IT",
    publisher: "Google",
    description: "Google's instruction-tuned Gemma 2 model with 27B parameters.",
    tags: ["Gemma", "27B", "Google", "Instruct"],
    downloads: "780K+",
    likes: 3421,
    size: "54 GB",
    lastUpdated: "2024-06-27",
    category: "google",
    gated: true,
  },
  {
    id: "microsoft/Phi-3.5-MoE-instruct",
    name: "Phi-3.5 MoE Instruct",
    publisher: "Microsoft",
    description: "Microsoft's efficient MoE model optimized for edge deployment.",
    tags: ["Phi", "MoE", "Efficient", "Edge"],
    downloads: "560K+",
    likes: 2134,
    size: "42 GB",
    lastUpdated: "2024-08-20",
    category: "microsoft",
    gated: false,
  },
];

const CATEGORIES = [
  { id: "all", name: "All Models", icon: Brain },
  { id: "nvidia", name: "NVIDIA", icon: Sparkles },
  { id: "llama", name: "Llama", icon: Zap },
  { id: "mistral", name: "Mistral", icon: Sparkles },
  { id: "qwen", name: "Qwen", icon: Brain },
  { id: "deepseek", name: "DeepSeek", icon: Brain },
  { id: "google", name: "Google", icon: Sparkles },
  { id: "microsoft", name: "Microsoft", icon: Zap },
];

// DGX Spark hosts
const DGX_HOSTS = [
  { id: "alpha", name: "DGX Spark Alpha", ip: "192.168.50.139" },
  { id: "beta", name: "DGX Spark Beta", ip: "192.168.50.110" },
];

interface DownloadProgress {
  modelId: string;
  status: "connecting" | "downloading" | "completed" | "failed";
  progress: string[];
  error?: string;
}

export function HuggingFaceBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedModel, setSelectedModel] = useState<typeof HF_MODELS[0] | null>(null);
  const [selectedHost, setSelectedHost] = useState(DGX_HOSTS[0]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Filter models based on search and category
  const filteredModels = HF_MODELS.filter((model) => {
    const matchesSearch =
      searchQuery === "" ||
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.publisher.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "all" || model.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(true);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const handleDownload = async (model: typeof HF_MODELS[0]) => {
    setDownloadProgress({
      modelId: model.id,
      status: "connecting",
      progress: [`Initiating download of ${model.name} to ${selectedHost.name}...`],
    });

    // Simulate download progress (in real implementation, this would use SSH)
    const progressSteps = [
      "Connecting to HuggingFace Hub...",
      "Authenticating with HuggingFace token...",
      "Fetching model metadata...",
      `Model size: ${model.size}`,
      "Starting download...",
      "Downloading config.json...",
      "Downloading tokenizer.json...",
      "Downloading model weights (this may take a while)...",
    ];

    for (let i = 0; i < progressSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setDownloadProgress((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: "downloading",
          progress: [...prev.progress, progressSteps[i]],
        };
      });
    }

    // Simulate completion or failure
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setDownloadProgress((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: "completed",
        progress: [...prev.progress, `Successfully downloaded ${model.name} to ${selectedHost.name}`],
      };
    });

    toast.success(`Model ${model.name} downloaded successfully`);
  };

  const downloadCommand = selectedModel
    ? `huggingface-cli download ${selectedModel.id} --local-dir /models/${selectedModel.id.split("/")[1]}`
    : "";

  return (
    <div className="grid grid-cols-12 gap-4 h-[600px]">
      {/* Model List */}
      <div className="col-span-5 flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/30 border-[#3b82f6]/30"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className={
                selectedCategory === category.id
                  ? "bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-black"
                  : "border-[#3b82f6]/30 hover:border-[#3b82f6] hover:bg-[#3b82f6]/10"
              }
            >
              <category.icon className="h-3 w-3 mr-1" />
              {category.name}
            </Button>
          ))}
        </div>

        {/* Model List */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-2">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                onClick={() => setSelectedModel(model)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedModel?.id === model.id
                    ? "border-[#3b82f6] bg-[#3b82f6]/10"
                    : "border-[#3b82f6]/20 hover:border-[#3b82f6]/50 bg-black/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white truncate">{model.name}</h4>
                      <Badge variant="outline" className="text-xs border-[#3b82f6]/50 text-[#3b82f6]">
                        {model.publisher}
                      </Badge>
                      {model.gated && (
                        <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-500">
                          Gated
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {model.downloads}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {model.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {model.size}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Model Details */}
      <div className="col-span-7 border border-[#3b82f6]/30 rounded-lg bg-black/20 p-4 flex flex-col">
        {selectedModel ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-[#3b82f6]">{selectedModel.name}</h3>
                  <Badge className="bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/50">
                    {selectedModel.publisher}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{selectedModel.description}</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedModel.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-[#3b82f6]/10 text-[#3b82f6]">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-black/30 rounded-lg border border-[#3b82f6]/20">
                <Download className="h-5 w-5 mx-auto mb-1 text-[#3b82f6]" />
                <div className="text-lg font-bold text-white">{selectedModel.downloads}</div>
                <div className="text-xs text-muted-foreground">Downloads</div>
              </div>
              <div className="text-center p-3 bg-black/30 rounded-lg border border-[#3b82f6]/20">
                <Star className="h-5 w-5 mx-auto mb-1 text-[#3b82f6]" />
                <div className="text-lg font-bold text-white">{selectedModel.likes}</div>
                <div className="text-xs text-muted-foreground">Likes</div>
              </div>
              <div className="text-center p-3 bg-black/30 rounded-lg border border-[#3b82f6]/20">
                <HardDrive className="h-5 w-5 mx-auto mb-1 text-[#3b82f6]" />
                <div className="text-lg font-bold text-white">{selectedModel.size}</div>
                <div className="text-xs text-muted-foreground">Size</div>
              </div>
              <div className="text-center p-3 bg-black/30 rounded-lg border border-[#3b82f6]/20">
                <Clock className="h-5 w-5 mx-auto mb-1 text-[#3b82f6]" />
                <div className="text-lg font-bold text-white">{selectedModel.lastUpdated.split("-").slice(1).join("/")}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
            </div>

            {/* Download Command */}
            <div className="mb-4">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Download Command
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/50 border border-[#3b82f6]/30 rounded px-3 py-2 text-sm font-mono text-[#3b82f6] overflow-x-auto">
                  {downloadCommand}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyCommand(downloadCommand)}
                  className="border-[#3b82f6]/30 hover:border-[#3b82f6] hover:bg-[#3b82f6]/10"
                >
                  {copiedCommand ? (
                    <Check className="h-4 w-4 text-[#3b82f6]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Host Selection */}
            <div className="mb-4">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Target Host
              </label>
              <Select
                value={selectedHost.id}
                onValueChange={(value) => {
                  const host = DGX_HOSTS.find((h) => h.id === value);
                  if (host) setSelectedHost(host);
                }}
              >
                <SelectTrigger className="bg-black/30 border-[#3b82f6]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DGX_HOSTS.map((host) => (
                    <SelectItem key={host.id} value={host.id}>
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-[#3b82f6]" />
                        <span>{host.name}</span>
                        <span className="text-muted-foreground">({host.ip})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-auto">
              <Button
                onClick={() => handleDownload(selectedModel)}
                className="flex-1 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-black"
              >
                <Download className="h-4 w-4 mr-2" />
                Download to {selectedHost.name}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`https://huggingface.co/${selectedModel.id}`, "_blank")}
                className="border-[#3b82f6]/30 hover:border-[#3b82f6] hover:bg-[#3b82f6]/10"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on HF
              </Button>
            </div>

            {selectedModel.gated && (
              <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                <Star className="h-3 w-3" />
                This is a gated model. You must accept the license on HuggingFace before downloading.
              </p>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a model to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Download Progress Dialog */}
      <Dialog open={downloadProgress !== null} onOpenChange={() => setDownloadProgress(null)}>
        <DialogContent className="bg-[#0a0a0a] border-[#3b82f6]/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#3b82f6]">
              <Download className="h-5 w-5" />
              Downloading Model
            </DialogTitle>
          </DialogHeader>

          {downloadProgress && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedModel?.name} → {selectedHost.name}
                </span>
                <Badge
                  variant="outline"
                  className={
                    downloadProgress.status === "completed"
                      ? "border-blue-500 text-blue-500"
                      : downloadProgress.status === "failed"
                      ? "border-red-500 text-red-500"
                      : "border-[#3b82f6] text-[#3b82f6]"
                  }
                >
                  {downloadProgress.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {downloadProgress.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                  {downloadProgress.status === "downloading" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {downloadProgress.status}
                </Badge>
              </div>

              {downloadProgress.status === "downloading" && (
                <Progress value={65} className="h-2" />
              )}

              <ScrollArea className="h-48 bg-black/50 rounded border border-[#3b82f6]/20 p-3">
                <div className="font-mono text-xs space-y-1">
                  {downloadProgress.progress.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes("Error")
                          ? "text-red-400"
                          : line.includes("Successfully")
                          ? "text-blue-400"
                          : "text-muted-foreground"
                      }
                    >
                      [{String(i + 1).padStart(2, "0")}] {line}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                {downloadProgress.status === "failed" && (
                  <Button
                    variant="outline"
                    onClick={() => selectedModel && handleDownload(selectedModel)}
                    className="border-[#3b82f6]/30"
                  >
                    Retry
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setDownloadProgress(null)}
                  className="border-[#3b82f6]/30"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
