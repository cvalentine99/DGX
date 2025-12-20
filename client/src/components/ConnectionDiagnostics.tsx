import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Activity,
  Server,
  Timer,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'retrying' | 'failed';
  lastAttempt: number;
  lastSuccess: number | null;
  consecutiveFailures: number;
  currentRetryAttempt: number;
  nextRetryTime: number | null;
  lastError: string | null;
  host: {
    name: string;
    host: string;
    port: number;
    localIp: string;
  };
  retryConfig: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    timeoutMs: number;
    jitterFactor: number;
  };
  timeSinceLastAttempt?: number | null;
  timeSinceLastSuccess?: number | null;
  timeUntilNextRetry?: number | null;
}

interface HostDiagnosticsProps {
  hostId: 'alpha' | 'beta';
  connectionState: ConnectionState;
  onRetry: () => void;
  onReset: () => void;
  isRetrying: boolean;
  isResetting: boolean;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return 'N/A';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
  return `${seconds}s ago`;
}

function formatCountdown(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '0s';
  
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'connected': return 'text-green-500';
    case 'connecting': return 'text-blue-500';
    case 'retrying': return 'text-yellow-500';
    case 'failed': return 'text-red-500';
    default: return 'text-gray-500';
  }
}

function getStatusBgColor(status: string): string {
  switch (status) {
    case 'connected': return 'bg-green-500/20 border-green-500/50';
    case 'connecting': return 'bg-blue-500/20 border-blue-500/50';
    case 'retrying': return 'bg-yellow-500/20 border-yellow-500/50';
    case 'failed': return 'bg-red-500/20 border-red-500/50';
    default: return 'bg-gray-500/20 border-gray-500/50';
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'connecting':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'retrying':
      return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <WifiOff className="w-5 h-5 text-gray-500" />;
  }
}

function HostDiagnostics({ 
  hostId, 
  connectionState, 
  onRetry, 
  onReset, 
  isRetrying,
  isResetting 
}: HostDiagnosticsProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Update countdown timer
  useEffect(() => {
    if (connectionState.nextRetryTime && connectionState.status === 'retrying') {
      const updateCountdown = () => {
        const remaining = connectionState.nextRetryTime! - Date.now();
        setCountdown(remaining > 0 ? remaining : null);
      };
      
      updateCountdown();
      const interval = setInterval(updateCountdown, 100);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [connectionState.nextRetryTime, connectionState.status]);
  
  const retryProgress = connectionState.retryConfig 
    ? (connectionState.currentRetryAttempt / connectionState.retryConfig.maxAttempts) * 100
    : 0;

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-4",
      getStatusBgColor(connectionState.status)
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-[#76b900]" />
          <div>
            <h3 className="font-semibold text-white">{connectionState.host.name}</h3>
            <p className="text-xs text-gray-400">
              {connectionState.host.host}:{connectionState.host.port}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon status={connectionState.status} />
          <Badge 
            variant="outline" 
            className={cn("capitalize", getStatusColor(connectionState.status))}
          >
            {connectionState.status}
          </Badge>
        </div>
      </div>
      
      {/* Retry Progress */}
      {(connectionState.status === 'retrying' || connectionState.status === 'connecting') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Retry Progress</span>
            <span className="text-white">
              Attempt {connectionState.currentRetryAttempt + 1} / {connectionState.retryConfig?.maxAttempts || 5}
            </span>
          </div>
          <Progress value={retryProgress} className="h-2" />
          
          {countdown !== null && countdown > 0 && (
            <div className="flex items-center gap-2 text-yellow-500 text-sm">
              <Timer className="w-4 h-4" />
              <span>Next retry in {formatCountdown(countdown)}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-black/30 rounded p-2">
          <div className="flex items-center gap-1 text-gray-400 mb-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Failures</span>
          </div>
          <span className={cn(
            "font-mono text-lg",
            connectionState.consecutiveFailures > 0 ? "text-red-400" : "text-green-400"
          )}>
            {connectionState.consecutiveFailures}
          </span>
        </div>
        
        <div className="bg-black/30 rounded p-2">
          <div className="flex items-center gap-1 text-gray-400 mb-1">
            <Clock className="w-3 h-3" />
            <span>Last Attempt</span>
          </div>
          <span className="font-mono text-white text-sm">
            {connectionState.lastAttempt > 0 
              ? formatDuration(Date.now() - connectionState.lastAttempt)
              : 'Never'}
          </span>
        </div>
        
        <div className="bg-black/30 rounded p-2">
          <div className="flex items-center gap-1 text-gray-400 mb-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Last Success</span>
          </div>
          <span className={cn(
            "font-mono text-sm",
            connectionState.lastSuccess ? "text-green-400" : "text-gray-500"
          )}>
            {connectionState.lastSuccess 
              ? formatDuration(Date.now() - connectionState.lastSuccess)
              : 'Never'}
          </span>
        </div>
        
        <div className="bg-black/30 rounded p-2">
          <div className="flex items-center gap-1 text-gray-400 mb-1">
            <Activity className="w-3 h-3" />
            <span>Timeout</span>
          </div>
          <span className="font-mono text-white text-sm">
            {connectionState.retryConfig?.timeoutMs 
              ? `${connectionState.retryConfig.timeoutMs / 1000}s`
              : '15s'}
          </span>
        </div>
      </div>
      
      {/* Last Error */}
      {connectionState.lastError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
          <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
            <XCircle className="w-4 h-4" />
            <span className="font-medium">Last Error</span>
          </div>
          <p className="text-red-300 text-xs font-mono break-all">
            {connectionState.lastError}
          </p>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying || connectionState.status === 'connecting'}
          className="flex-1 border-[#76b900]/50 hover:bg-[#76b900]/20"
        >
          {isRetrying ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Retry Now
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isResetting}
          className="border-gray-600 hover:bg-gray-700"
        >
          {isResetting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4 mr-2" />
          )}
          Reset
        </Button>
      </div>
    </div>
  );
}

export function ConnectionDiagnostics() {
  const [isRetryingAlpha, setIsRetryingAlpha] = useState(false);
  const [isRetryingBeta, setIsRetryingBeta] = useState(false);
  const [isResettingAlpha, setIsResettingAlpha] = useState(false);
  const [isResettingBeta, setIsResettingBeta] = useState(false);
  
  // Fetch connection status
  const { data: connectionStatus, refetch } = trpc.ssh.getConnectionStatus.useQuery(
    undefined,
    { refetchInterval: 2000 }
  );
  
  // Retry mutation
  const retryMutation = trpc.ssh.retryConnection.useMutation({
    onSuccess: () => refetch(),
  });
  
  // Reset mutation
  const resetMutation = trpc.ssh.resetConnectionState.useMutation({
    onSuccess: () => refetch(),
  });
  
  const handleRetryAlpha = useCallback(async () => {
    setIsRetryingAlpha(true);
    try {
      await retryMutation.mutateAsync({ hostId: 'alpha' });
    } finally {
      setIsRetryingAlpha(false);
    }
  }, [retryMutation]);
  
  const handleRetryBeta = useCallback(async () => {
    setIsRetryingBeta(true);
    try {
      await retryMutation.mutateAsync({ hostId: 'beta' });
    } finally {
      setIsRetryingBeta(false);
    }
  }, [retryMutation]);
  
  const handleResetAlpha = useCallback(async () => {
    setIsResettingAlpha(true);
    try {
      await resetMutation.mutateAsync({ hostId: 'alpha' });
    } finally {
      setIsResettingAlpha(false);
    }
  }, [resetMutation]);
  
  const handleResetBeta = useCallback(async () => {
    setIsResettingBeta(true);
    try {
      await resetMutation.mutateAsync({ hostId: 'beta' });
    } finally {
      setIsResettingBeta(false);
    }
  }, [resetMutation]);

  if (!connectionStatus) {
    return (
      <Card className="bg-black/40 border-gray-800">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#76b900]" />
        </CardContent>
      </Card>
    );
  }

  const alphaState = connectionStatus.alpha as ConnectionState;
  const betaState = connectionStatus.beta as ConnectionState;
  
  // Calculate overall health
  const healthyCount = [alphaState, betaState].filter(
    s => s.status === 'connected'
  ).length;
  const totalHosts = 2;

  return (
    <Card className="bg-black/40 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#76b900]/20">
              <Wifi className="w-5 h-5 text-[#76b900]" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Connection Diagnostics</CardTitle>
              <p className="text-sm text-gray-400">SSH connection status and retry management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                healthyCount === totalHosts 
                  ? "border-green-500 text-green-500" 
                  : healthyCount > 0 
                    ? "border-yellow-500 text-yellow-500"
                    : "border-red-500 text-red-500"
              )}
            >
              {healthyCount}/{totalHosts} Online
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Retry Configuration Info */}
        <div className="bg-black/30 rounded-lg p-3 border border-gray-800">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <History className="w-4 h-4" />
            <span>Retry Configuration</span>
          </div>
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Max Attempts</span>
              <p className="text-white font-mono">{alphaState.retryConfig?.maxAttempts || 5}</p>
            </div>
            <div>
              <span className="text-gray-500">Base Delay</span>
              <p className="text-white font-mono">{(alphaState.retryConfig?.baseDelayMs || 1000) / 1000}s</p>
            </div>
            <div>
              <span className="text-gray-500">Max Delay</span>
              <p className="text-white font-mono">{(alphaState.retryConfig?.maxDelayMs || 30000) / 1000}s</p>
            </div>
            <div>
              <span className="text-gray-500">Jitter</span>
              <p className="text-white font-mono">{((alphaState.retryConfig?.jitterFactor || 0.3) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
        
        {/* Host Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HostDiagnostics
            hostId="alpha"
            connectionState={alphaState}
            onRetry={handleRetryAlpha}
            onReset={handleResetAlpha}
            isRetrying={isRetryingAlpha}
            isResetting={isResettingAlpha}
          />
          
          <HostDiagnostics
            hostId="beta"
            connectionState={betaState}
            onRetry={handleRetryBeta}
            onReset={handleResetBeta}
            isRetrying={isRetryingBeta}
            isResetting={isResettingBeta}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default ConnectionDiagnostics;
