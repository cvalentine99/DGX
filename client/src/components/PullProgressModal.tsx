/**
 * Pull Progress Modal Component
 * 
 * Shows real-time progress when pulling container images to DGX Spark hosts via SSH.
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

interface PullProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageTag: string;
  hostId: "alpha" | "beta";
  onComplete?: () => void;
}

export default function PullProgressModal({
  open,
  onOpenChange,
  imageTag,
  hostId,
  onComplete,
}: PullProgressModalProps) {
  const [pullId, setPullId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "pulling" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState<string[]>([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const hostNames = {
    alpha: "DGX Spark Alpha (192.168.50.139)",
    beta: "DGX Spark Beta (192.168.50.110)",
  };

  // Start pull mutation
  const pullMutation = trpc.ssh.pullImage.useMutation({
    onSuccess: (data) => {
      setPullId(data.pullId);
      setStatus("connecting");
      setProgress([`Initiating pull to ${data.host.name}...`]);
    },
    onError: (err) => {
      setStatus("failed");
      setError(err.message);
      setProgress((prev) => [...prev, `Error: ${err.message}`]);
    },
  });

  // Poll for status updates
  const statusQuery = trpc.ssh.getPullStatus.useQuery(
    { pullId: pullId || "" },
    {
      enabled: !!pullId && status !== "completed" && status !== "failed",
      refetchInterval: 1000,
    }
  );

  // Update status from polling
  useEffect(() => {
    if (statusQuery.data?.found) {
      const data = statusQuery.data;
      setStatus(data.status as any);
      setProgress(data.progress || []);
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
      setProgress([]);
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

  // Estimate progress percentage
  const getProgressPercent = () => {
    if (status === "completed") return 100;
    if (status === "failed") return 0;
    if (status === "connecting") return 5;
    
    // Estimate based on log messages
    const pullCompleteCount = progress.filter(p => p.includes("Pull complete")).length;
    const downloadingCount = progress.filter(p => p.includes("Downloading") || p.includes("Extracting")).length;
    
    if (pullCompleteCount > 0) {
      return Math.min(90, 20 + pullCompleteCount * 10);
    }
    if (downloadingCount > 0) {
      return Math.min(50, 10 + downloadingCount * 5);
    }
    return 10;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Download className="w-5 h-5 text-primary" />
            Pulling Container Image
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
                <div className="text-xs text-muted-foreground font-mono">
                  {imageTag}
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                status === "completed" && "border-green-500/50 text-green-400",
                status === "failed" && "border-red-500/50 text-red-400",
                (status === "connecting" || status === "pulling") && "border-primary/50 text-primary"
              )}
            >
              {status === "connecting" && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting
                </>
              )}
              {status === "pulling" && (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Pulling
                </>
              )}
              {status === "completed" && (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  Completed
                </>
              )}
              {status === "failed" && (
                <>
                  <XCircle className="w-3 h-3" />
                  Failed
                </>
              )}
              {status === "idle" && "Initializing"}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground font-mono flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(duration)}
              </span>
            </div>
            <Progress value={getProgressPercent()} className="h-2" />
          </div>

          {/* Log Output */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Terminal className="w-4 h-4" />
              Output Log
            </div>
            <ScrollArea className="h-[200px] rounded-lg bg-background/80 border border-border/50 p-3">
              <div className="space-y-1 font-mono text-xs">
                <AnimatePresence mode="popLayout">
                  {progress.map((line, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "text-muted-foreground",
                        line.includes("Error") && "text-red-400",
                        line.includes("Successfully") && "text-green-400",
                        line.includes("Pull complete") && "text-primary",
                        line.includes("Downloading") && "text-yellow-400",
                        line.includes("Extracting") && "text-blue-400"
                      )}
                    >
                      <span className="text-muted-foreground/50 mr-2">
                        [{String(index + 1).padStart(2, "0")}]
                      </span>
                      {line}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {(status === "connecting" || status === "pulling") && (
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-primary"
                  >
                    <span className="text-muted-foreground/50 mr-2">
                      [{String(progress.length + 1).padStart(2, "0")}]
                    </span>
                    Waiting for output...
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
                  <div className="text-sm font-medium text-red-400">Pull Failed</div>
                  <div className="text-xs text-red-400/80 mt-1">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {status === "completed" && (
              <Button
                variant="default"
                onClick={() => onOpenChange(false)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Done
              </Button>
            )}
            {status === "failed" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus("idle");
                    setProgress([]);
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
            {(status === "connecting" || status === "pulling") && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Run in Background
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
