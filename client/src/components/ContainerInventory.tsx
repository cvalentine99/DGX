import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  RefreshCw,
  Container,
  HardDrive,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Server,
  Box,
} from "lucide-react";

interface ContainerImage {
  repository: string;
  tag: string;
  size: string;
  createdAt: string;
  fullTag: string;
}

// NGC container categories for visual grouping
const NGC_CATEGORIES: Record<string, { color: string; label: string }> = {
  "nvcr.io/nvidia/nemo": { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "NeMo" },
  "nvcr.io/nvidia/pytorch": { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "PyTorch" },
  "nvcr.io/nvidia/tensorflow": { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "TensorFlow" },
  "nvcr.io/nvidia/tensorrt": { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "TensorRT" },
  "nvcr.io/nvidia/tritonserver": { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Triton" },
  "nvcr.io/nvidia/cuda": { color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", label: "CUDA" },
  "nvcr.io/nvidia/vllm": { color: "bg-lime-500/20 text-lime-400 border-lime-500/30", label: "vLLM" },
  "nvcr.io/nvidia/dcgm": { color: "bg-pink-500/20 text-pink-400 border-pink-500/30", label: "DCGM" },
};

function getCategoryStyle(repository: string): { color: string; label: string } {
  for (const [prefix, style] of Object.entries(NGC_CATEGORIES)) {
    if (repository.startsWith(prefix)) {
      return style;
    }
  }
  // Check if it's any NGC container
  if (repository.startsWith("nvcr.io")) {
    return { color: "bg-[#76b900]/20 text-[#76b900] border-[#76b900]/30", label: "NGC" };
  }
  // Default for non-NGC containers
  return { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Other" };
}

// Simulated container data for demo when SSH is unavailable
const SIMULATED_CONTAINERS: Record<string, ContainerImage[]> = {
  alpha: [
    { repository: "nvcr.io/nvidia/vllm", tag: "25.11", size: "15.2GB", createdAt: "2024-12-15 10:30:00", fullTag: "nvcr.io/nvidia/vllm:25.11" },
    { repository: "nvcr.io/nvidia/nemo", tag: "24.09", size: "18.7GB", createdAt: "2024-12-10 14:22:00", fullTag: "nvcr.io/nvidia/nemo:24.09" },
    { repository: "nvcr.io/nvidia/pytorch", tag: "24.11-py3", size: "12.4GB", createdAt: "2024-12-08 09:15:00", fullTag: "nvcr.io/nvidia/pytorch:24.11-py3" },
    { repository: "nvcr.io/nvidia/tensorrt", tag: "24.11-py3", size: "8.9GB", createdAt: "2024-12-05 16:45:00", fullTag: "nvcr.io/nvidia/tensorrt:24.11-py3" },
    { repository: "nvcr.io/nvidia/cuda", tag: "12.4.0-devel-ubuntu22.04", size: "4.2GB", createdAt: "2024-11-28 11:00:00", fullTag: "nvcr.io/nvidia/cuda:12.4.0-devel-ubuntu22.04" },
    { repository: "nvcr.io/nvidia/dcgm-exporter", tag: "3.3.6-3.4.2-ubuntu22.04", size: "1.1GB", createdAt: "2024-11-20 08:30:00", fullTag: "nvcr.io/nvidia/dcgm-exporter:3.3.6-3.4.2-ubuntu22.04" },
  ],
  beta: [
    { repository: "nvcr.io/nvidia/vllm", tag: "25.11", size: "15.2GB", createdAt: "2024-12-16 11:45:00", fullTag: "nvcr.io/nvidia/vllm:25.11" },
    { repository: "nvcr.io/nvidia/nemo", tag: "24.09", size: "18.7GB", createdAt: "2024-12-12 13:10:00", fullTag: "nvcr.io/nvidia/nemo:24.09" },
    { repository: "nvcr.io/nvidia/tritonserver", tag: "24.11-py3", size: "14.8GB", createdAt: "2024-12-09 15:30:00", fullTag: "nvcr.io/nvidia/tritonserver:24.11-py3" },
    { repository: "nvcr.io/nvidia/pytorch", tag: "24.11-py3", size: "12.4GB", createdAt: "2024-12-07 10:20:00", fullTag: "nvcr.io/nvidia/pytorch:24.11-py3" },
    { repository: "nvcr.io/nvidia/cuda", tag: "12.4.0-runtime-ubuntu22.04", size: "2.8GB", createdAt: "2024-11-25 09:00:00", fullTag: "nvcr.io/nvidia/cuda:12.4.0-runtime-ubuntu22.04" },
  ],
};

interface HostContainersProps {
  hostId: "alpha" | "beta";
  hostName: string;
  hostIp: string;
}

function HostContainers({ hostId, hostName, hostIp }: HostContainersProps) {
  const [useSimulated, setUseSimulated] = useState(false);
  
  const { data, isLoading, error, refetch, isRefetching } = trpc.ssh.listImages.useQuery(
    { hostId },
    {
      refetchInterval: false,
      retry: 1,
    }
  );

  // Handle error state
  useEffect(() => {
    if (error) {
      setUseSimulated(true);
    }
  }, [error]);

  useEffect(() => {
    if (data && !data.success) {
      setUseSimulated(true);
    }
  }, [data]);

  const containers = useSimulated 
    ? SIMULATED_CONTAINERS[hostId] 
    : (data?.images || []);

  const ngcContainers = containers.filter(c => c.repository.startsWith("nvcr.io"));
  const otherContainers = containers.filter(c => !c.repository.startsWith("nvcr.io"));

  const totalSize = containers.reduce((acc, c) => {
    const match = c.size.match(/^([\d.]+)\s*(GB|MB|KB|B)?/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = (match[2] || "B").toUpperCase();
      const multiplier = unit === "GB" ? 1 : unit === "MB" ? 0.001 : unit === "KB" ? 0.000001 : 0.000000001;
      return acc + value * multiplier;
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#76b900]" />
            <span className="text-sm text-gray-400">{hostIp}</span>
          </div>
          {useSimulated && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs">
              SIMULATED
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Box className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">{containers.length} images</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">{totalSize.toFixed(1)} GB</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="h-8 px-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && !useSimulated && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#76b900]" />
          <span className="ml-2 text-gray-400">Connecting to {hostName}...</span>
        </div>
      )}

      {/* Error state (when not using simulated) */}
      {error && !useSimulated && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">Failed to connect: {error.message}</span>
        </div>
      )}

      {/* Container list */}
      {(!isLoading || useSimulated) && containers.length > 0 && (
        <div className="space-y-3">
          {/* NGC Containers */}
          {ngcContainers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#76b900] uppercase tracking-wider">NGC Containers</span>
                <span className="text-xs text-gray-500">({ngcContainers.length})</span>
              </div>
              <div className="grid gap-2">
                {ngcContainers.map((container, idx) => {
                  const category = getCategoryStyle(container.repository);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-black/30 border border-gray-800 rounded-lg hover:border-[#76b900]/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Container className="w-5 h-5 text-[#76b900]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-200">
                              {container.repository.replace("nvcr.io/nvidia/", "")}
                            </span>
                            <Badge variant="outline" className={`${category.color} text-xs border`}>
                              {container.tag}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {container.size}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {container.createdAt.split(" ")[0]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`${category.color} text-xs`}>
                        {category.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other Containers */}
          {otherContainers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Other Containers</span>
                <span className="text-xs text-gray-500">({otherContainers.length})</span>
              </div>
              <div className="grid gap-2">
                {otherContainers.map((container, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-black/30 border border-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Container className="w-5 h-5 text-gray-500" />
                      <div>
                        <span className="font-mono text-sm text-gray-300">{container.fullTag}</span>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {container.size}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {container.createdAt.split(" ")[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {(!isLoading || useSimulated) && containers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <Container className="w-8 h-8 mb-2" />
          <span className="text-sm">No containers found</span>
        </div>
      )}
    </div>
  );
}

export function ContainerInventory() {
  const [activeHost, setActiveHost] = useState<"alpha" | "beta">("alpha");

  return (
    <Card className="bg-black/40 border-gray-800 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#76b900]/10 rounded-lg">
              <Container className="w-5 h-5 text-[#76b900]" />
            </div>
            <div>
              <CardTitle className="text-lg font-orbitron text-white">Container Inventory</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">NGC containers deployed on DGX Spark hosts</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeHost} onValueChange={(v) => setActiveHost(v as "alpha" | "beta")}>
          <TabsList className="grid w-full grid-cols-2 bg-black/50 border border-gray-800 mb-4">
            <TabsTrigger
              value="alpha"
              className="data-[state=active]:bg-[#76b900]/20 data-[state=active]:text-[#76b900] data-[state=active]:border-[#76b900]/30"
            >
              <Server className="w-4 h-4 mr-2" />
              Spark Alpha
            </TabsTrigger>
            <TabsTrigger
              value="beta"
              className="data-[state=active]:bg-[#76b900]/20 data-[state=active]:text-[#76b900] data-[state=active]:border-[#76b900]/30"
            >
              <Server className="w-4 h-4 mr-2" />
              Spark Beta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alpha" className="mt-0">
            <HostContainers
              hostId="alpha"
              hostName="DGX Spark Alpha"
              hostIp="192.168.50.139"
            />
          </TabsContent>

          <TabsContent value="beta" className="mt-0">
            <HostContainers
              hostId="beta"
              hostName="DGX Spark Beta"
              hostIp="192.168.50.110"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ContainerInventory;
