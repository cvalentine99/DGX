/**
 * WebRTC Preview Component V2
 * Uses Socket.IO for real-time signaling with DGX Spark camera streaming
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  VideoOff,
  Play,
  Square,
  RefreshCw,
  Maximize2,
  Minimize2,
  Settings,
  Wifi,
  WifiOff,
  Activity,
  Gauge,
  Clock,
  Zap,
  Camera,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { useWebRTCStream } from "@/hooks/useWebRTCStream";

interface WebRTCPreviewV2Props {
  hostId: "alpha" | "beta";
  camera?: string;
  resolution?: string;
  fps?: number;
  format?: string;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
  className?: string;
}

const RESOLUTIONS = [
  { value: "3840x2160", label: "4K UHD", fps: [30, 24, 15] },
  { value: "2560x1440", label: "QHD", fps: [30, 24, 20, 15] },
  { value: "1920x1080", label: "1080p", fps: [60, 30, 24] },
  { value: "1280x720", label: "720p", fps: [60, 30, 24] },
  { value: "640x480", label: "480p", fps: [90, 60, 30] },
];

export function WebRTCPreviewV2({
  hostId,
  camera = "/dev/video0",
  resolution: initialResolution = "1920x1080",
  fps: initialFps = 30,
  format = "H.264",
  onStreamStart,
  onStreamStop,
  className = "",
}: WebRTCPreviewV2Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [resolution, setResolution] = useState(initialResolution);
  const [fps, setFps] = useState(initialFps);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use WebRTC stream hook
  const {
    isConnected,
    isStreaming,
    isConnecting,
    sessionId,
    error,
    stats,
    startStream,
    stopStream,
    reconnect,
    videoRef,
    mediaStream,
  } = useWebRTCStream({
    onStreamStart: () => {
      toast.success("Camera stream connected");
      onStreamStart?.();
    },
    onStreamStop: () => {
      toast.info("Camera stream stopped");
      onStreamStop?.();
    },
    onError: (err) => {
      toast.error(`Stream error: ${err}`);
    },
  });

  // Handle start stream
  const handleStartStream = async () => {
    try {
      await startStream({
        hostId,
        camera,
        resolution,
        fps,
        format,
      });
    } catch (err) {
      // Error already handled in hook
    }
  };

  // Handle stop stream
  const handleStopStream = async () => {
    await stopStream();
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Get connection quality indicator
  const getConnectionQuality = () => {
    if (!isStreaming) return { icon: SignalLow, color: "text-muted-foreground", label: "Offline" };
    
    const latency = stats.latency;
    if (latency < 20) return { icon: SignalHigh, color: "text-nvidia-green", label: "Excellent" };
    if (latency < 50) return { icon: SignalMedium, color: "text-nvidia-teal", label: "Good" };
    if (latency < 100) return { icon: Signal, color: "text-nvidia-warning", label: "Fair" };
    return { icon: SignalLow, color: "text-nvidia-critical", label: "Poor" };
  };

  // Format bitrate
  const formatBitrate = (bps: number) => {
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
    if (bps >= 1000) return `${(bps / 1000).toFixed(0)} Kbps`;
    return `${bps.toFixed(0)} bps`;
  };

  // Get available FPS options for selected resolution
  const getAvailableFps = () => {
    const res = RESOLUTIONS.find((r) => r.value === resolution);
    return res?.fps || [30];
  };

  const quality = getConnectionQuality();
  const QualityIcon = quality.icon;

  return (
    <Card className={`cyber-panel ${className}`} ref={containerRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Video className="h-5 w-5 text-nvidia-green" />
            Live Camera Preview
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <Badge
              variant="outline"
              className={isConnected ? "text-nvidia-green" : "text-muted-foreground"}
            >
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </>
              )}
            </Badge>

            {/* Stream status */}
            {isStreaming && (
              <Badge variant="outline" className="text-nvidia-green animate-pulse">
                <Radio className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}

            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Video container */}
        <div className="relative aspect-video bg-background/50 rounded-lg overflow-hidden border border-border">
          {/* Video element */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain"
            autoPlay
            playsInline
            muted
          />

          {/* Overlay when not streaming */}
          {!isStreaming && !isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  Camera Preview
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click Start to begin streaming from {camera}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resolution} • {fps} FPS • {format}
                </p>
              </div>
            </div>
          )}

          {/* Connecting overlay */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-nvidia-green mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium text-foreground mb-2">
                  Connecting...
                </p>
                <p className="text-sm text-muted-foreground">
                  Establishing WebRTC connection to DGX Spark
                </p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && !isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-nvidia-critical mx-auto mb-4" />
                <p className="text-lg font-medium text-nvidia-critical mb-2">
                  Connection Error
                </p>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  {error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reconnect}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Stats overlay */}
          <AnimatePresence>
            {isStreaming && showStats && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-2 left-2 right-2 flex justify-between"
              >
                {/* Left stats */}
                <div className="bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono space-y-0.5">
                  <div className="flex items-center gap-1 text-nvidia-green">
                    <Activity className="h-3 w-3" />
                    {formatBitrate(stats.bitrate)}
                  </div>
                  <div className="flex items-center gap-1 text-nvidia-teal">
                    <Clock className="h-3 w-3" />
                    {stats.latency.toFixed(0)}ms
                  </div>
                </div>

                {/* Right stats */}
                <div className="bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono space-y-0.5 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <QualityIcon className={`h-3 w-3 ${quality.color}`} />
                    <span className={quality.color}>{quality.label}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {stats.framesReceived} frames
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom info bar */}
          {isStreaming && (
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
              <Badge variant="outline" className="bg-background/80 text-nvidia-green text-xs">
                {resolution} @ {fps}fps
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 bg-background/80"
                onClick={() => setShowStats(!showStats)}
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Start/Stop button */}
          {!isStreaming ? (
            <Button
              onClick={handleStartStream}
              disabled={isConnecting || !isConnected}
              className="flex-1 gap-2 bg-nvidia-green hover:bg-nvidia-green/90 text-black"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Stream
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleStopStream}
              variant="destructive"
              className="flex-1 gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Stream
            </Button>
          )}

          {/* Resolution selector */}
          <Select
            value={resolution}
            onValueChange={(value) => {
              setResolution(value);
              // Reset FPS if not available for new resolution
              const availableFps = RESOLUTIONS.find((r) => r.value === value)?.fps || [30];
              if (!availableFps.includes(fps)) {
                setFps(availableFps[0]);
              }
            }}
            disabled={isStreaming}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((res) => (
                <SelectItem key={res.value} value={res.value}>
                  {res.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* FPS selector */}
          <Select
            value={fps.toString()}
            onValueChange={(value) => setFps(parseInt(value))}
            disabled={isStreaming}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getAvailableFps().map((f) => (
                <SelectItem key={f} value={f.toString()}>
                  {f} FPS
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reconnect button */}
          {error && (
            <Button
              variant="outline"
              size="icon"
              onClick={reconnect}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Detailed stats (when streaming) */}
        {isStreaming && showStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-4 gap-2 pt-2 border-t border-border"
          >
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Bitrate</div>
              <div className="text-sm font-mono text-nvidia-green">
                {formatBitrate(stats.bitrate)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Latency</div>
              <div className="text-sm font-mono text-nvidia-teal">
                {stats.latency.toFixed(0)}ms
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Frames</div>
              <div className="text-sm font-mono">
                {stats.framesReceived.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Dropped</div>
              <div className={`text-sm font-mono ${stats.framesDropped > 0 ? "text-nvidia-warning" : ""}`}>
                {stats.framesDropped}
              </div>
            </div>
          </motion.div>
        )}

        {/* Connection info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Camera className="h-3 w-3" />
            <span>Logitech BRIO</span>
          </div>
          <div className="flex items-center gap-2">
            <span>ICE: {stats.iceState}</span>
            <span>•</span>
            <span>Conn: {stats.connectionState}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
