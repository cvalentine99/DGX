import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  RefreshCw,
  Container,
  HardDrive,
  Clock,
  AlertCircle,
  Loader2,
  Server,
  Box,
  Trash2,
  Download,
  History,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Terminal,
} from "lucide-react";
import { ContainerLogsModal } from "./ContainerLogsModal";

interface ContainerImage {
  repository: string;
  tag: string;
  size: string;
  createdAt: string;
  fullTag: string;
}

// NGC container categories for visual grouping
const NGC_CATEGORIES: Record<string, { color: string; label: string }> = {
  "nvcr.io/nvidia/nemo": { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "NeMo" },
  "nvcr.io/nvidia/pytorch": { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "PyTorch" },
  "nvcr.io/nvidia/tensorflow": { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "TensorFlow" },
  "nvcr.io/nvidia/tensorrt": { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "TensorRT" },
  "nvcr.io/nvidia/tritonserver": { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Triton" },
  "nvcr.io/nvidia/cuda": { color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", label: "CUDA" },
  "nvcr.io/nvidia/vllm": { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "vLLM" },
  "nvcr.io/nvidia/dcgm": { color: "bg-pink-500/20 text-pink-400 border-pink-500/30", label: "DCGM" },
};

function getCategoryStyle(repository: string): { color: string; label: string } {
  for (const [prefix, style] of Object.entries(NGC_CATEGORIES)) {
    if (repository.startsWith(prefix)) {
      return style;
    }
  }
  if (repository.startsWith("nvcr.io")) {
    return { color: "bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30", label: "NGC" };
  }
  return { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Other" };
}

interface HostContainersProps {
  hostId: "alpha" | "beta";
  hostName: string;
  hostIp: string;
  onActionComplete: () => void;
}

function HostContainers({ hostId, hostName, hostIp, onActionComplete }: HostContainersProps) {
  const [confirmDialog, setConfirmDialog] = useState<{ type: "remove" | "update"; container: ContainerImage } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [logsModal, setLogsModal] = useState<{ container: ContainerImage } | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, error, refetch, isRefetching } = trpc.ssh.listImages.useQuery(
    { hostId },
    { refetchInterval: 30000, retry: 2 }
  );

  const removeImageMutation = trpc.ssh.removeImage.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Removed ${confirmDialog?.container.fullTag}`);
        refetch();
        onActionComplete();
      } else {
        toast.error(result.error || "Failed to remove image");
      }
      setActionInProgress(null);
      setConfirmDialog(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setActionInProgress(null);
      setConfirmDialog(null);
    },
  });

  const updateImageMutation = trpc.ssh.updateImage.useMutation({
    onSuccess: (result) => {
      toast.info(`Update started for ${confirmDialog?.container.fullTag}. Check progress in NGC Catalog.`);
      setActionInProgress(null);
      setConfirmDialog(null);
      onActionComplete();
    },
    onError: (error) => {
      toast.error(error.message);
      setActionInProgress(null);
      setConfirmDialog(null);
    },
  });

  const recordActionMutation = trpc.containerHistory.recordAction.useMutation();

  const containers = data?.images || [];
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

  const handleRemove = async () => {
    if (!confirmDialog || confirmDialog.type !== "remove") return;
    setActionInProgress(confirmDialog.container.fullTag);

    // Record the action
    await recordActionMutation.mutateAsync({
      hostId,
      imageTag: confirmDialog.container.fullTag,
      action: "remove",
    });

    removeImageMutation.mutate({ hostId, imageTag: confirmDialog.container.fullTag });
  };

  const handleUpdate = async () => {
    if (!confirmDialog || confirmDialog.type !== "update") return;
    setActionInProgress(confirmDialog.container.fullTag);

    // Record the action
    await recordActionMutation.mutateAsync({
      hostId,
      imageTag: confirmDialog.container.fullTag,
      action: "update",
    });

    updateImageMutation.mutate({ hostId, imageTag: confirmDialog.container.fullTag });
  };

  const renderContainerRow = (container: ContainerImage, idx: number) => {
    const category = getCategoryStyle(container.repository);
    const isProcessing = actionInProgress === container.fullTag;
    
    return (
      <div
        key={idx}
        className="flex items-center justify-between p-3 bg-black/30 border border-gray-800 rounded-lg hover:border-[#3b82f6]/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Container className="w-5 h-5 text-[#3b82f6]" />
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
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${category.color} text-xs mr-2`}>
            {category.label}
          </Badge>
          
          {/* Action buttons - visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[#3b82f6] hover:text-[#8ed900] hover:bg-[#3b82f6]/10"
              onClick={() => setLogsModal({ container })}
              title="View Logs"
            >
              <Terminal className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
              onClick={() => setConfirmDialog({ type: "update", container })}
              disabled={isProcessing}
              title="Update Image"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => setConfirmDialog({ type: "remove", container })}
              disabled={isProcessing}
              title="Remove Image"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-sm text-gray-400">{hostIp}</span>
          </div>
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
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
          <span className="ml-2 text-gray-400">Connecting to {hostName}...</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">Failed to connect: {error.message}</span>
        </div>
      )}

      {/* Container list */}
      {!isLoading && !error && containers.length > 0 && (
        <div className="space-y-3">
          {ngcContainers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#3b82f6] uppercase tracking-wider">NGC Containers</span>
                <span className="text-xs text-gray-500">({ngcContainers.length})</span>
              </div>
              <div className="grid gap-2">
                {ngcContainers.map((container, idx) => renderContainerRow(container, idx))}
              </div>
            </div>
          )}

          {otherContainers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Other Containers</span>
                <span className="text-xs text-gray-500">({otherContainers.length})</span>
              </div>
              <div className="grid gap-2">
                {otherContainers.map((container, idx) => renderContainerRow(container, idx))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && containers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <Container className="w-8 h-8 mb-2" />
          <span className="text-sm">No containers found</span>
        </div>
      )}

      {/* Logs Modal */}
      {logsModal && (
        <ContainerLogsModal
          isOpen={!!logsModal}
          onClose={() => setLogsModal(null)}
          hostId={hostId}
          containerId={logsModal.container.fullTag.split(":")[0].split("/").pop() || logsModal.container.fullTag}
          containerName={logsModal.container.repository.replace("nvcr.io/nvidia/", "")}
          containerImage={logsModal.container.fullTag}
        />
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirmDialog?.type === "remove" ? "Remove Container Image" : "Update Container Image"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {confirmDialog?.type === "remove" ? (
                <>
                  Are you sure you want to remove <span className="font-mono text-red-400">{confirmDialog?.container.fullTag}</span> from {hostName}?
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Pull the latest version of <span className="font-mono text-blue-400">{confirmDialog?.container.fullTag}</span> on {hostName}?
                  This will download any updates from NGC.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            {confirmDialog?.type === "remove" ? (
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={!!actionInProgress}
              >
                {actionInProgress ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Remove
              </Button>
            ) : (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleUpdate}
                disabled={!!actionInProgress}
              >
                {actionInProgress ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Update
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PullHistory() {
  const { data, isLoading, error } = trpc.containerHistory.getHistory.useQuery(
    { limit: 20 },
    { refetchInterval: 30000 }
  );

  const history = data?.history || [];

  const getActionIcon = (action: string) => {
    switch (action) {
      case "pull": return <Download className="w-4 h-4 text-blue-400" />;
      case "update": return <ArrowUpCircle className="w-4 h-4 text-blue-400" />;
      case "remove": return <Trash2 className="w-4 h-4 text-red-400" />;
      default: return <Container className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "started":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs"><Loader2 className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>;
      default:
        return null;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-sm text-gray-400">Recent Activity</span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
        </div>
      )}

      {!isLoading && history.length > 0 && (
        <div className="space-y-2">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 bg-black/30 border border-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getActionIcon(entry.action)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-200">
                      {entry.imageTag.replace("nvcr.io/nvidia/", "")}
                    </span>
                    <Badge variant="outline" className="text-xs bg-gray-800/50 text-gray-400 border-gray-700">
                      {entry.hostName.replace("DGX Spark ", "")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{entry.userName}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(entry.startedAt)}</span>
                    {entry.errorMessage && (
                      <>
                        <span>•</span>
                        <span className="text-red-400">{entry.errorMessage}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {getStatusBadge(entry.status)}
            </div>
          ))}
        </div>
      )}

      {!isLoading && history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <History className="w-8 h-8 mb-2" />
          <span className="text-sm">No pull history yet</span>
        </div>
      )}
    </div>
  );
}

export function ContainerInventory() {
  const [activeTab, setActiveTab] = useState<"alpha" | "beta" | "history">("alpha");
  const utils = trpc.useUtils();

  const handleActionComplete = () => {
    // Refresh history when an action completes
    utils.containerHistory.getHistory.invalidate();
  };

  return (
    <Card className="bg-black/40 border-gray-800 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3b82f6]/10 rounded-lg">
              <Container className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div>
              <CardTitle className="text-lg font-orbitron text-white">Container Inventory</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">NGC containers deployed on DGX Spark hosts</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "alpha" | "beta" | "history")}>
          <TabsList className="grid w-full grid-cols-3 bg-black/50 border border-gray-800 mb-4">
            <TabsTrigger
              value="alpha"
              className="data-[state=active]:bg-[#3b82f6]/20 data-[state=active]:text-[#3b82f6] data-[state=active]:border-[#3b82f6]/30"
            >
              <Server className="w-4 h-4 mr-2" />
              Spark Alpha
            </TabsTrigger>
            <TabsTrigger
              value="beta"
              className="data-[state=active]:bg-[#3b82f6]/20 data-[state=active]:text-[#3b82f6] data-[state=active]:border-[#3b82f6]/30"
            >
              <Server className="w-4 h-4 mr-2" />
              Spark Beta
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-[#3b82f6]/20 data-[state=active]:text-[#3b82f6] data-[state=active]:border-[#3b82f6]/30"
            >
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alpha" className="mt-0">
            <HostContainers
              hostId="alpha"
              hostName="DGX Spark Alpha"
              hostIp="192.168.50.139"
              onActionComplete={handleActionComplete}
            />
          </TabsContent>

          <TabsContent value="beta" className="mt-0">
            <HostContainers
              hostId="beta"
              hostName="DGX Spark Beta"
              hostIp="192.168.50.110"
              onActionComplete={handleActionComplete}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <PullHistory />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ContainerInventory;
