import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  RefreshCw,
  Download,
  Copy,
  Check,
  Terminal,
  Loader2,
  AlertCircle,
  Clock,
  Server,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

interface ContainerLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostId: "alpha" | "beta";
  containerId: string;
  containerName: string;
  containerImage: string;
}

// Simulated logs for demo mode
const SIMULATED_LOGS = `2024-12-20T08:15:23.456Z INFO  [vllm.entrypoints.api_server] Starting vLLM API server...
2024-12-20T08:15:24.123Z INFO  [vllm.engine.llm_engine] Initializing LLM engine with model: Nemotron-3-Nano-30B-A3B-FP8
2024-12-20T08:15:25.789Z INFO  [vllm.engine.llm_engine] Loading model weights...
2024-12-20T08:15:45.234Z INFO  [vllm.engine.llm_engine] Model loaded successfully
2024-12-20T08:15:45.567Z INFO  [vllm.engine.llm_engine] GPU memory allocated: 45.2 GB / 128 GB
2024-12-20T08:15:46.012Z INFO  [vllm.entrypoints.api_server] Server ready at http://0.0.0.0:8000
2024-12-20T08:16:01.234Z INFO  [vllm.engine.async_llm_engine] Received request: req-001
2024-12-20T08:16:01.456Z DEBUG [vllm.engine.async_llm_engine] Processing prompt with 128 tokens
2024-12-20T08:16:02.789Z INFO  [vllm.engine.async_llm_engine] Generated 256 tokens in 1.33s (192.5 tok/s)
2024-12-20T08:16:02.890Z INFO  [vllm.engine.async_llm_engine] Request req-001 completed
2024-12-20T08:17:15.123Z INFO  [vllm.engine.async_llm_engine] Received request: req-002
2024-12-20T08:17:15.234Z DEBUG [vllm.engine.async_llm_engine] Processing prompt with 512 tokens
2024-12-20T08:17:18.567Z INFO  [vllm.engine.async_llm_engine] Generated 1024 tokens in 3.33s (307.2 tok/s)
2024-12-20T08:17:18.678Z INFO  [vllm.engine.async_llm_engine] Request req-002 completed
2024-12-20T08:18:30.456Z WARN  [vllm.engine.llm_engine] GPU memory usage high: 78.5%
2024-12-20T08:18:30.567Z INFO  [vllm.engine.llm_engine] Running garbage collection...
2024-12-20T08:18:31.234Z INFO  [vllm.engine.llm_engine] GPU memory after GC: 62.3%
2024-12-20T08:19:45.789Z INFO  [vllm.engine.async_llm_engine] Received batch request: batch-001 (5 prompts)
2024-12-20T08:19:46.012Z DEBUG [vllm.engine.async_llm_engine] Batch processing with continuous batching
2024-12-20T08:19:52.345Z INFO  [vllm.engine.async_llm_engine] Batch completed: 5 requests, avg 285.6 tok/s
2024-12-20T08:20:00.000Z INFO  [vllm.metrics] Metrics snapshot: requests=8, avg_latency=2.1s, throughput=267.3 tok/s`;

export function ContainerLogsModal({
  isOpen,
  onClose,
  hostId,
  containerId,
  containerName,
  containerImage,
}: ContainerLogsModalProps) {
  const [tailLines, setTailLines] = useState<string>("100");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copied, setCopied] = useState(false);
  const [useSimulated, setUseSimulated] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLPreElement>(null);

  const { data, isLoading, error, refetch, isRefetching } = trpc.ssh.getContainerLogs.useQuery(
    {
      hostId,
      containerId,
      tail: parseInt(tailLines),
      timestamps: true,
    },
    {
      enabled: isOpen && !useSimulated,
      refetchInterval: autoRefresh ? 5000 : false,
    }
  );

  // Check for SSH errors and switch to simulated mode
  useEffect(() => {
    if (error || (data && !data.success)) {
      setUseSimulated(true);
    }
  }, [error, data]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && autoRefresh) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data?.logs, autoRefresh]);

  const logs = useSimulated ? SIMULATED_LOGS : (data?.logs || "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      toast.success("Logs copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy logs");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${containerName || containerId}-logs-${new Date().toISOString().split("T")[0]}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Logs downloaded");
  };

  // Colorize log lines based on level
  const colorizeLog = (line: string) => {
    if (line.includes("ERROR") || line.includes("FATAL")) {
      return "text-red-400";
    }
    if (line.includes("WARN")) {
      return "text-yellow-400";
    }
    if (line.includes("DEBUG")) {
      return "text-gray-500";
    }
    if (line.includes("INFO")) {
      return "text-green-400";
    }
    return "text-gray-300";
  };

  const hostName = hostId === "alpha" ? "DGX Spark Alpha" : "DGX Spark Beta";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-gray-900 border-gray-800">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#76b900]/10 rounded-lg">
                <Terminal className="w-5 h-5 text-[#76b900]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-orbitron text-white">
                  Container Logs
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs bg-gray-800/50 text-gray-400 border-gray-700">
                    <Server className="w-3 h-3 mr-1" />
                    {hostName}
                  </Badge>
                  <span className="text-xs text-gray-500 font-mono">
                    {containerName || containerId}
                  </span>
                </div>
              </div>
            </div>
            {useSimulated && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                SIMULATED
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Controls */}
        <div className="flex items-center justify-between py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="tail-lines" className="text-xs text-gray-400">
                Lines:
              </Label>
              <Select value={tailLines} onValueChange={setTailLines}>
                <SelectTrigger className="w-24 h-8 bg-black/50 border-gray-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="data-[state=checked]:bg-[#76b900]"
              />
              <Label htmlFor="auto-refresh" className="text-xs text-gray-400 flex items-center gap-1">
                {autoRefresh ? (
                  <Play className="w-3 h-3 text-[#76b900]" />
                ) : (
                  <Pause className="w-3 h-3" />
                )}
                Auto-refresh
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-8"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8"
            >
              {copied ? (
                <Check className="w-4 h-4 mr-1 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 mr-1" />
              )}
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </div>

        {/* Logs content */}
        <div className="flex-1 overflow-hidden rounded-lg bg-black/50 border border-gray-800">
          {isLoading && !useSimulated ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-[#76b900]" />
              <span className="ml-2 text-gray-400">Fetching logs...</span>
            </div>
          ) : error && !useSimulated ? (
            <div className="flex items-center justify-center h-full">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <span className="ml-2 text-red-400">{error.message}</span>
            </div>
          ) : (
            <pre
              ref={logsContainerRef}
              className="h-full overflow-auto p-4 text-xs font-mono leading-relaxed"
            >
              {logs.split("\n").map((line, idx) => (
                <div key={idx} className={`${colorizeLog(line)} hover:bg-gray-800/50`}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>
              {autoRefresh ? "Auto-refreshing every 5s" : "Manual refresh"}
            </span>
            {isRefetching && (
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                Updating...
              </Badge>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {logs.split("\n").filter(l => l.trim()).length} lines
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ContainerLogsModal;
