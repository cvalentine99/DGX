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
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface WebRTCPreviewProps {
  hostId: "alpha" | "beta";
  camera?: string;
  resolution?: string;
  fps?: number;
  format?: string;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
  className?: string;
}

interface StreamStats {
  bitrate: number;
  framesReceived: number;
  framesDropped: number;
  latency: number;
  connectionState: string;
  iceState: string;
}

export function WebRTCPreview({
  hostId,
  camera = "/dev/video0",
  resolution = "1920x1080",
  fps = 30,
  format = "H.264",
  onStreamStart,
  onStreamStop,
  className = "",
}: WebRTCPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StreamStats>({
    bitrate: 0,
    framesReceived: 0,
    framesDropped: 0,
    latency: 0,
    connectionState: "new",
    iceState: "new",
  });

  // Stream configuration state
  const [streamConfig, setStreamConfig] = useState({
    resolution,
    fps,
    format,
  });

  // tRPC mutations and queries
  const createSession = trpc.webrtc.createSession.useMutation();
  const setOffer = trpc.webrtc.setOffer.useMutation();
  const addIceCandidate = trpc.webrtc.addIceCandidate.useMutation();
  const stopSession = trpc.webrtc.stopSession.useMutation();
  const getSessionStatus = trpc.webrtc.getSessionStatus.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId && isStreaming, refetchInterval: 2000 }
  );

  // Update stats from server
  useEffect(() => {
    if (getSessionStatus.data?.session?.stats) {
      const serverStats = getSessionStatus.data.session.stats;
      setStats(prev => ({
        ...prev,
        bitrate: serverStats.bitrate,
        framesReceived: serverStats.framesReceived,
        framesDropped: serverStats.framesDropped,
        latency: serverStats.latency,
      }));
    }
  }, [getSessionStatus.data]);

  // Create RTCPeerConnection with configuration
  const createPeerConnection = useCallback(() => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = async (event) => {
      if (event.candidate && sessionId) {
        try {
          await addIceCandidate.mutateAsync({
            sessionId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        } catch (err) {
          console.error("Failed to send ICE candidate:", err);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      setStats(prev => ({ ...prev, iceState: pc.iceConnectionState }));
      
      if (pc.iceConnectionState === "failed") {
        setError("ICE connection failed. Check network connectivity.");
        handleStopStream();
      } else if (pc.iceConnectionState === "disconnected") {
        toast.warning("Stream connection interrupted");
      } else if (pc.iceConnectionState === "connected") {
        toast.success("Stream connected successfully");
      }
    };

    pc.onconnectionstatechange = () => {
      setStats(prev => ({ ...prev, connectionState: pc.connectionState }));
      
      if (pc.connectionState === "failed") {
        setError("Connection failed");
        handleStopStream();
      }
    };

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setIsStreaming(true);
        setIsConnecting(false);
        onStreamStart?.();
      }
    };

    return pc;
  }, [sessionId, addIceCandidate, onStreamStart]);

  // Start the WebRTC stream
  const handleStartStream = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Create session on server
      const sessionResult = await createSession.mutateAsync({
        hostId,
        camera,
        resolution: streamConfig.resolution,
        fps: streamConfig.fps,
        format: streamConfig.format,
      });

      if (!sessionResult.success) {
        throw new Error("Failed to create session");
      }

      setSessionId(sessionResult.sessionId);

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add transceiver for receiving video
      pc.addTransceiver("video", { direction: "recvonly" });

      // Create and set local offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to server and get answer
      const answerResult = await setOffer.mutateAsync({
        sessionId: sessionResult.sessionId,
        offer: {
          type: "offer",
          sdp: offer.sdp || "",
        },
      });

      if (!answerResult.success || !answerResult.answer) {
        throw new Error("Failed to get answer from server");
      }

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(answerResult.answer));

      // For simulation: create a mock video stream
      // In production, the stream would come from the DGX Spark via WebRTC
      await simulateVideoStream(pc);

      toast.success("Stream started");
    } catch (err: any) {
      console.error("Failed to start stream:", err);
      setError(err.message || "Failed to start stream");
      setIsConnecting(false);
      toast.error("Failed to start stream");
    }
  };

  // Simulate video stream for demo purposes
  const simulateVideoStream = async (pc: RTCPeerConnection) => {
    try {
      // Create a canvas-based video stream for simulation
      const canvas = document.createElement("canvas");
      const [width, height] = streamConfig.resolution.split("x").map(Number);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;

      // Animation loop for simulated video
      let frameCount = 0;
      const drawFrame = () => {
        if (!isStreaming && !isConnecting) return;

        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#1a1a2e");
        gradient.addColorStop(1, "#16213e");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw grid pattern
        ctx.strokeStyle = "rgba(118, 185, 0, 0.1)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Draw camera info
        ctx.fillStyle = "#3b82f6";
        ctx.font = "bold 24px monospace";
        ctx.fillText("LOGITECH BRIO - LIVE FEED", 40, 50);
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px monospace";
        ctx.fillText(`Resolution: ${streamConfig.resolution}`, 40, 80);
        ctx.fillText(`Frame Rate: ${streamConfig.fps} FPS`, 40, 100);
        ctx.fillText(`Format: ${streamConfig.format}`, 40, 120);
        ctx.fillText(`Device: ${camera}`, 40, 140);

        // Draw timestamp
        const now = new Date();
        ctx.fillStyle = "#3b82f6";
        ctx.font = "14px monospace";
        ctx.fillText(now.toLocaleTimeString(), width - 100, 30);

        // Draw frame counter
        ctx.fillStyle = "rgba(118, 185, 0, 0.5)";
        ctx.font = "12px monospace";
        ctx.fillText(`Frame: ${frameCount++}`, width - 100, height - 20);

        // Draw detection boxes (simulated)
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        
        // Simulated person detection
        const boxX = 200 + Math.sin(frameCount * 0.02) * 50;
        const boxY = 200 + Math.cos(frameCount * 0.03) * 30;
        ctx.strokeRect(boxX, boxY, 150, 300);
        ctx.fillStyle = "rgba(118, 185, 0, 0.8)";
        ctx.font = "12px sans-serif";
        ctx.fillText("person 0.95", boxX, boxY - 5);

        // Simulated object detection
        const box2X = 500 + Math.cos(frameCount * 0.025) * 40;
        const box2Y = 350 + Math.sin(frameCount * 0.02) * 25;
        ctx.strokeStyle = "#00d4ff";
        ctx.strokeRect(box2X, box2Y, 100, 80);
        ctx.fillStyle = "rgba(0, 212, 255, 0.8)";
        ctx.fillText("laptop 0.89", box2X, box2Y - 5);

        // Draw pipeline status
        ctx.fillStyle = "#3b82f6";
        ctx.font = "bold 14px monospace";
        ctx.fillText("● PIPELINE ACTIVE", 40, height - 60);
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px monospace";
        ctx.fillText("Object Detection • YOLOv8 • TensorRT", 40, height - 40);

        requestAnimationFrame(drawFrame);
      };

      // Start drawing
      drawFrame();

      // Create stream from canvas
      const stream = canvas.captureStream(streamConfig.fps);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setIsConnecting(false);
        onStreamStart?.();
      }

      // Start stats collection
      statsIntervalRef.current = setInterval(() => {
        setStats(prev => ({
          ...prev,
          bitrate: 3500000 + Math.random() * 1000000,
          framesReceived: prev.framesReceived + streamConfig.fps,
          framesDropped: prev.framesDropped + (Math.random() > 0.95 ? 1 : 0),
          latency: 15 + Math.random() * 10,
          connectionState: "connected",
          iceState: "connected",
        }));
      }, 1000);

    } catch (err) {
      console.error("Failed to simulate stream:", err);
      throw err;
    }
  };

  // Stop the WebRTC stream
  const handleStopStream = async () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    if (sessionId) {
      try {
        await stopSession.mutateAsync({ sessionId });
      } catch (err) {
        console.error("Failed to stop session:", err);
      }
    }

    setSessionId(null);
    setIsStreaming(false);
    setIsConnecting(false);
    setStats({
      bitrate: 0,
      framesReceived: 0,
      framesDropped: 0,
      latency: 0,
      connectionState: "new",
      iceState: "new",
    });
    
    onStreamStop?.();
    toast.info("Stream stopped");
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && videoRef.current) {
      videoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, []);

  // Format bitrate for display
  const formatBitrate = (bps: number) => {
    if (bps >= 1000000) {
      return `${(bps / 1000000).toFixed(1)} Mbps`;
    }
    return `${(bps / 1000).toFixed(0)} Kbps`;
  };

  // Get connection quality indicator
  const getConnectionQuality = () => {
    if (!isStreaming) return { icon: WifiOff, color: "text-muted-foreground", label: "Offline" };
    if (stats.latency < 20) return { icon: SignalHigh, color: "text-nvidia-green", label: "Excellent" };
    if (stats.latency < 50) return { icon: SignalMedium, color: "text-nvidia-warning", label: "Good" };
    return { icon: SignalLow, color: "text-nvidia-critical", label: "Poor" };
  };

  const quality = getConnectionQuality();

  return (
    <Card className={`cyber-panel overflow-hidden ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Video className="h-5 w-5 text-nvidia-green" />
            Live Camera Preview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isStreaming ? "default" : "secondary"}
              className={isStreaming ? "bg-nvidia-green/20 text-nvidia-green" : ""}
            >
              <quality.icon className={`h-3 w-3 mr-1 ${quality.color}`} />
              {quality.label}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowStats(!showStats)}
            >
              <Activity className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Video Container */}
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />

          {/* Overlay when not streaming */}
          {!isStreaming && !isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Camera Preview</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click Start to begin streaming from {camera}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>{streamConfig.resolution}</span>
                  <span>•</span>
                  <span>{streamConfig.fps} FPS</span>
                  <span>•</span>
                  <span>{streamConfig.format}</span>
                </div>
              </div>
            </div>
          )}

          {/* Connecting overlay */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-nvidia-green mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium">Connecting...</p>
                <p className="text-sm text-muted-foreground">
                  Establishing WebRTC connection to DGX Spark
                </p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-nvidia-critical mx-auto mb-4" />
                <p className="text-lg font-medium text-nvidia-critical">Connection Error</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    handleStartStream();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Stats overlay */}
          <AnimatePresence>
            {showStats && isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-2 left-2 right-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1">
                    <Gauge className="h-3 w-3 text-nvidia-green" />
                    <span>{formatBitrate(stats.bitrate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-nvidia-teal" />
                    <span>{stats.latency.toFixed(0)}ms</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-purple-400" />
                    <span>{stats.framesReceived} frames</span>
                  </div>
                  {stats.framesDropped > 0 && (
                    <div className="flex items-center gap-1 text-nvidia-warning">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{stats.framesDropped} dropped</span>
                    </div>
                  )}
                </div>
                <div className="bg-nvidia-green/20 text-nvidia-green px-2 py-1 rounded text-xs font-mono">
                  ● LIVE
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isStreaming ? (
                <Button
                  size="sm"
                  className="bg-nvidia-green hover:bg-nvidia-green/90 text-black"
                  onClick={handleStartStream}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isConnecting ? "Connecting..." : "Start Stream"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopStream}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={streamConfig.resolution}
                onValueChange={(v) => setStreamConfig({ ...streamConfig, resolution: v })}
                disabled={isStreaming}
              >
                <SelectTrigger className="w-28 h-8 text-xs bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3840x2160">4K UHD</SelectItem>
                  <SelectItem value="2560x1440">QHD</SelectItem>
                  <SelectItem value="1920x1080">1080p</SelectItem>
                  <SelectItem value="1280x720">720p</SelectItem>
                  <SelectItem value="640x480">480p</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={streamConfig.fps.toString()}
                onValueChange={(v) => setStreamConfig({ ...streamConfig, fps: parseInt(v) })}
                disabled={isStreaming}
              >
                <SelectTrigger className="w-20 h-8 text-xs bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 FPS</SelectItem>
                  <SelectItem value="30">30 FPS</SelectItem>
                  <SelectItem value="24">24 FPS</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 bg-background/80"
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
        </div>

        {/* Connection info bar */}
        {isStreaming && (
          <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-nvidia-green" />
                <span>ICE: {stats.iceState}</span>
              </div>
              <div className="flex items-center gap-1">
                <Wifi className="h-3 w-3 text-nvidia-teal" />
                <span>Connection: {stats.connectionState}</span>
              </div>
            </div>
            <div className="text-muted-foreground">
              Session: {sessionId?.slice(-8)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WebRTCPreview;
