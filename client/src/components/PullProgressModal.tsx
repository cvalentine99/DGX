/**
 * Pull Progress Modal Component
 * 
 * Shows real-time progress when pulling container images or downloading models
 * to DGX Spark hosts via SSH with detailed progress tracking.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  Clock,
  RefreshCw,
  Layers,
  Gauge,
  HardDrive,
  Zap,
  Ban,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface LayerProgress {
  id: string;
  status: "waiting" | "downloading" | "extracting" | "complete" | "exists";
  current: number;
  total: number;
}

interface PullProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageTag: string;
  hostId: "alpha" | "beta";
  onComplete?: () => void;
  type?: "container" | "model";
}

export default function PullProgressModal({
  open,
  onOpenChange,
  imageTag,
  hostId,
  onComplete,
  type = "container",
}: PullProgressModalProps) {
  const [pullId, setPullId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "authenticating" | "pulling" | "extracting" | "completed" | "failed" | "cancelled">("idle");
  const [phase, setPhase] = useState<string>("Initializing");
  const [overallPercent, setOverallPercent] = useState(0);
  const [layers, setLayers] = useState<LayerProgress[]>([]);
  const [downloadSpeed, setDownloadSpeed] = useState("0 B/s");
  const [downloadedSize, setDownloadedSize] = useState("0 B");
  const [totalSize, setTotalSize] = useState("0 B");
  const [eta, setEta] = useState("calculating...");
  const [logs, setLogs] = useState<string[]>([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const hostNames = {
    alpha: "DGX Spark Alpha (192.168.50.110)",
    beta: "DGX Spark Beta (192.168.50.139)",
  };

  // Start pull mutation
  const pullMutation = trpc.ssh.pullImage.useMutation({
    onSuccess: (data) => {
      setPullId(data.pullId);
      setStatus("connecting");
      setPhase("Connecting");
      setLogs([`Initiating pull to ${data.host.name}...`]);
    },
    onError: (err) => {
      setStatus("failed");
      setPhase("Error");
      setError(err.message);
      setLogs((prev) => [...prev, `✗ Error: ${err.message}`]);
    },
  });

  // Cancel mutation
  const cancelMutation = trpc.ssh.cancelPull.useMutation({
    onSuccess: () => {
      setStatus("cancelled");
      setPhase("Cancelled");
    },
  });

  // Poll for status updates
  const statusQuery = trpc.ssh.getPullStatus.useQuery(
    { pullId: pullId || "" },
    {
      enabled: !!pullId && !["completed", "failed", "cancelled"].includes(status),
      refetchInterval: 500, // Poll every 500ms for smoother updates
    }
  );

  // Update status from polling
  useEffect(() => {
    if (statusQuery.data?.found) {
      const data = statusQuery.data;
      setStatus(data.status as any);
      setPhase(data.phase || "Processing");
      setOverallPercent(data.overallPercent || 0);
      setLayers(data.layers || []);
      setDownloadSpeed(data.downloadSpeed || "0 B/s");
      setDownloadedSize(data.downloadedSize || "0 B");
      setTotalSize(data.totalSize || "0 B");
      setEta(data.eta || "calculating...");
      setLogs(data.logs || []);
      setDuration(data.duration || 0);
      
      if (data.error) {
        setError(data.error);
      }

      if (data.status === "completed" && onComplete) {
        onComplete();
      }
    }
  }, [statusQuery.data, onComplete]);

  // Start pull when modal opens
  useEffect(() => {
    if (open && status === "idle") {
      pullMutation.mutate({ hostId, imageTag });
    }
  }, [open, status, hostId, imageTag]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPullId(null);
      setStatus("idle");
      setPhase("Initializing");
      setOverallPercent(0);
      setLayers([]);
      setDownloadSpeed("0 B/s");
      setDownloadedSize("0 B");
      setTotalSize("0 B");
      setEta("calculating...");
      setLogs([]);
      setDuration(0);
      setError(null);
    }
  }, [open]);

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (status) {
      case "connecting":
        return { icon: <Loader2 className="w-3 h-3 animate-spin" />, text: "Connecting", color: "border-yellow-500/50 text-yellow-400" };
      case "authenticating":
        return { icon: <Shield className="w-3 h-3 animate-pulse" />, text: "Authenticating", color: "border-blue-500/50 text-blue-400" };
      case "pulling":
        return { icon: <Download className="w-3 h-3 animate-bounce" />, text: "Downloading", color: "border-primary/50 text-primary" };
      case "extracting":
        return { icon: <Layers className="w-3 h-3 animate-pulse" />, text: "Extracting", color: "border-purple-500/50 text-purple-400" };
      case "completed":
        return { icon: <CheckCircle2 className="w-3 h-3" />, text: "Completed", color: "border-blue-500/50 text-blue-400" };
      case "failed":
        return { icon: <XCircle className="w-3 h-3" />, text: "Failed", color: "border-red-500/50 text-red-400" };
      case "cancelled":
        return { icon: <Ban className="w-3 h-3" />, text: "Cancelled", color: "border-orange-500/50 text-orange-400" };
      default:
        return { icon: <Loader2 className="w-3 h-3" />, text: "Initializing", color: "border-muted-foreground/50 text-muted-foreground" };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Count layer statuses
  const layerStats = {
    downloading: layers.filter(l => l.status === "downloading").length,
    extracting: layers.filter(l => l.status === "extracting").length,
    complete: layers.filter(l => l.status === "complete" || l.status === "exists").length,
    total: layers.length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Download className="w-5 h-5 text-primary" />
            {type === "container" ? "Pulling Container Image" : "Downloading Model"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {hostNames[hostId]}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                  {imageTag}
                </div>
              </div>
            </div>
            <Badge variant="outline" className={cn("gap-1", statusDisplay.color)}>
              {statusDisplay.icon}
              {statusDisplay.text}
            </Badge>
          </div>

          {/* Main Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                {phase}
              </span>
              <span className="text-foreground font-mono font-bold text-lg">
                {overallPercent}%
              </span>
            </div>
            
            <div className="relative">
              <Progress value={overallPercent} className="h-3" />
              {/* Animated glow effect when downloading */}
              {(status === "pulling" || status === "extracting") && (
                <motion.div
                  className="absolute inset-0 h-3 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrive className="w-3.5 h-3.5" />
                <span>{downloadedSize} / {totalSize}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-yellow-400 font-medium">{downloadSpeed}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>ETA: {eta}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
          </div>

          {/* Layer Progress */}
          {layers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Layers
                </span>
                <span className="text-xs text-muted-foreground">
                  {layerStats.complete}/{layerStats.total} complete
                  {layerStats.downloading > 0 && ` • ${layerStats.downloading} downloading`}
                  {layerStats.extracting > 0 && ` • ${layerStats.extracting} extracting`}
                </span>
              </div>
              
              <div className="grid grid-cols-6 gap-1">
                {layers.slice(0, 12).map((layer) => (
                  <motion.div
                    key={layer.id}
                    className={cn(
                      "h-2 rounded-full transition-colors",
                      layer.status === "complete" || layer.status === "exists" 
                        ? "bg-blue-500" 
                        : layer.status === "downloading" 
                          ? "bg-yellow-500" 
                          : layer.status === "extracting"
                            ? "bg-purple-500"
                            : "bg-muted"
                    )}
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ 
                      scale: layer.status === "downloading" || layer.status === "extracting" ? [1, 1.1, 1] : 1,
                      opacity: 1 
                    }}
                    transition={{ 
                      duration: 0.5, 
                      repeat: layer.status === "downloading" || layer.status === "extracting" ? Infinity : 0 
                    }}
                    title={`${layer.id}: ${layer.status}`}
                  />
                ))}
                {layers.length > 12 && (
                  <div className="h-2 flex items-center justify-center text-[8px] text-muted-foreground">
                    +{layers.length - 12}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Log Output */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Terminal className="w-4 h-4" />
              Output Log
            </div>
            <ScrollArea className="h-[150px] rounded-lg bg-background/80 border border-border/50 p-3">
              <div className="space-y-1 font-mono text-xs">
                <AnimatePresence mode="popLayout">
                  {logs.map((line, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "text-muted-foreground",
                        line.includes("✗") && "text-red-400",
                        line.includes("✓") && "text-blue-400",
                        line.includes("⚠") && "text-yellow-400",
                        line.includes("Pull complete") && "text-blue-400",
                        line.includes("Downloading") && "text-yellow-400",
                        line.includes("Extracting") && "text-purple-400"
                      )}
                    >
                      <span className="text-muted-foreground/50 mr-2">
                        [{String(index + 1).padStart(2, "0")}]
                      </span>
                      {line}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {["connecting", "authenticating", "pulling", "extracting"].includes(status) && (
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-primary"
                  >
                    <span className="text-muted-foreground/50 mr-2">
                      [{String(logs.length + 1).padStart(2, "0")}]
                    </span>
                    {status === "pulling" ? "Downloading layers..." : "Processing..."}
                  </motion.div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-red-400">
                    {type === "container" ? "Pull Failed" : "Download Failed"}
                  </div>
                  <div className="text-xs text-red-400/80 mt-1">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <div>
              {["connecting", "authenticating", "pulling", "extracting"].includes(status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pullId && cancelMutation.mutate({ pullId })}
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              {status === "completed" && (
                <Button
                  variant="default"
                  onClick={() => onOpenChange(false)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Done
                </Button>
              )}
              {(status === "failed" || status === "cancelled") && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatus("idle");
                      setPhase("Initializing");
                      setOverallPercent(0);
                      setLayers([]);
                      setLogs([]);
                      setError(null);
                      pullMutation.mutate({ hostId, imageTag });
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </>
              )}
              {["connecting", "authenticating", "pulling", "extracting"].includes(status) && (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Run in Background
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
