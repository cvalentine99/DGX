/**
 * WebRTC Streaming Hook with Socket.IO Signaling
 * Provides real-time camera streaming from DGX Spark via WebRTC
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface StreamConfig {
  hostId: "alpha" | "beta";
  camera: string;
  resolution: string;
  fps: number;
  format: string;
}

interface StreamStats {
  bitrate: number;
  framesReceived: number;
  framesDropped: number;
  latency: number;
  packetsLost: number;
  jitter: number;
  connectionState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
}

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface UseWebRTCStreamOptions {
  onStreamStart?: () => void;
  onStreamStop?: () => void;
  onError?: (error: string) => void;
  onStatsUpdate?: (stats: StreamStats) => void;
}

interface UseWebRTCStreamReturn {
  // State
  isConnected: boolean;
  isStreaming: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  error: string | null;
  stats: StreamStats;
  
  // Actions
  startStream: (config: StreamConfig) => Promise<void>;
  stopStream: () => Promise<void>;
  reconnect: () => Promise<void>;
  
  // Refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaStream: MediaStream | null;
}

const DEFAULT_STATS: StreamStats = {
  bitrate: 0,
  framesReceived: 0,
  framesDropped: 0,
  latency: 0,
  packetsLost: 0,
  jitter: 0,
  connectionState: "new",
  iceState: "new",
  signalingState: "stable",
};

export function useWebRTCStream(
  options: UseWebRTCStreamOptions = {}
): UseWebRTCStreamReturn {
  const { onStreamStart, onStreamStop, onError, onStatsUpdate } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StreamStats>(DEFAULT_STATS);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef<StreamConfig | null>(null);
  const iceServersRef = useRef<IceServer[]>([]);

  // Connect to signaling server
  const connectSignaling = useCallback(() => {
    if (socketRef.current?.connected) return;

    const signalingUrl = window.location.origin;
    const socket = io(signalingUrl, {
      path: "/webrtc-signaling",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("[WebRTC] Connected to signaling server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[WebRTC] Disconnected from signaling server");
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[WebRTC] Signaling connection error:", err);
      setError("Failed to connect to signaling server");
      onError?.("Failed to connect to signaling server");
    });

    // Handle SDP offer from sender (DGX Spark)
    socket.on("offer", async (data: { sessionId: string; sdp: string }) => {
      console.log("[WebRTC] Received offer from sender");
      
      if (!peerConnectionRef.current) {
        console.error("[WebRTC] No peer connection for offer");
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: data.sdp })
        );

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket.emit("answer", {
          sessionId: data.sessionId,
          sdp: answer.sdp,
        });

        console.log("[WebRTC] Sent answer to sender");
      } catch (err: any) {
        console.error("[WebRTC] Failed to handle offer:", err);
        setError(err.message);
        onError?.(err.message);
      }
    });

    // Handle ICE candidate from sender
    socket.on("ice-candidate", async (data: {
      sessionId: string;
      candidate: RTCIceCandidateInit;
      from: "sender" | "receiver";
    }) => {
      if (data.from === "sender" && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log("[WebRTC] Added remote ICE candidate");
        } catch (err) {
          console.error("[WebRTC] Failed to add ICE candidate:", err);
        }
      }
    });

    // Handle sender ready notification
    socket.on("sender-ready", (data: {
      sessionId: string;
      device: string;
      resolution: string;
      fps: number;
    }) => {
      console.log("[WebRTC] Sender ready:", data);
    });

    // Handle stream stopped
    socket.on("stream-stopped", () => {
      console.log("[WebRTC] Stream stopped by sender");
      handleStreamStopped();
    });

    // Handle connection state updates
    socket.on("connection-state", (data: { sessionId: string; state: string }) => {
      console.log("[WebRTC] Connection state:", data.state);
    });

    socketRef.current = socket;
  }, [onError]);

  // Create RTCPeerConnection
  const createPeerConnection = useCallback(() => {
    const config: RTCConfiguration = {
      iceServers: iceServersRef.current.length > 0
        ? iceServersRef.current
        : [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    };

    const pc = new RTCPeerConnection(config);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && sessionId) {
        socketRef.current.emit("ice-candidate", {
          sessionId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
          from: "receiver",
        });
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE state:", pc.iceConnectionState);
      setStats((prev) => ({ ...prev, iceState: pc.iceConnectionState }));

      if (pc.iceConnectionState === "failed") {
        setError("ICE connection failed");
        onError?.("ICE connection failed");
      } else if (pc.iceConnectionState === "connected") {
        setIsStreaming(true);
        setIsConnecting(false);
        onStreamStart?.();
      } else if (pc.iceConnectionState === "disconnected") {
        console.warn("[WebRTC] ICE disconnected, attempting reconnection...");
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);
      setStats((prev) => ({ ...prev, connectionState: pc.connectionState }));

      if (socketRef.current && sessionId) {
        socketRef.current.emit("connection-state", {
          sessionId,
          state: pc.connectionState,
        });
      }

      if (pc.connectionState === "failed") {
        setError("Connection failed");
        onError?.("Connection failed");
        handleStreamStopped();
      }
    };

    // Handle signaling state changes
    pc.onsignalingstatechange = () => {
      setStats((prev) => ({ ...prev, signalingState: pc.signalingState }));
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log("[WebRTC] Received track:", event.track.kind);
      
      if (event.streams[0]) {
        setMediaStream(event.streams[0]);
        
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(console.error);
        }
      }
    };

    return pc;
  }, [sessionId, onStreamStart, onError]);

  // Start collecting stats
  const startStatsCollection = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(async () => {
      if (!peerConnectionRef.current) return;

      try {
        const reports = await peerConnectionRef.current.getStats();
        let totalBitrate = 0;
        let framesReceived = 0;
        let framesDropped = 0;
        let packetsLost = 0;
        let jitter = 0;

        reports.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            totalBitrate = (report.bytesReceived * 8) / 1000; // kbps
            framesReceived = report.framesReceived || 0;
            framesDropped = report.framesDropped || 0;
            packetsLost = report.packetsLost || 0;
            jitter = report.jitter || 0;
          }
        });

        const newStats: StreamStats = {
          bitrate: totalBitrate,
          framesReceived,
          framesDropped,
          packetsLost,
          jitter: jitter * 1000, // Convert to ms
          latency: jitter * 1000 + 10, // Approximate latency
          connectionState: peerConnectionRef.current.connectionState,
          iceState: peerConnectionRef.current.iceConnectionState,
          signalingState: peerConnectionRef.current.signalingState,
        };

        setStats(newStats);
        onStatsUpdate?.(newStats);
      } catch (err) {
        console.error("[WebRTC] Failed to get stats:", err);
      }
    }, 1000);
  }, [onStatsUpdate]);

  // Handle stream stopped
  const handleStreamStopped = useCallback(() => {
    setIsStreaming(false);
    setIsConnecting(false);
    setMediaStream(null);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    onStreamStop?.();
  }, [onStreamStop]);

  // Start stream
  const startStream = useCallback(async (config: StreamConfig) => {
    setIsConnecting(true);
    setError(null);
    configRef.current = config;

    try {
      // Ensure signaling is connected
      if (!socketRef.current?.connected) {
        connectSignaling();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!socketRef.current?.connected) {
        throw new Error("Failed to connect to signaling server");
      }

      // Create session
      const sessionResult = await new Promise<{
        success: boolean;
        sessionId?: string;
        iceServers?: IceServer[];
        error?: string;
      }>((resolve) => {
        socketRef.current!.emit(
          "create-session",
          {
            hostId: config.hostId,
            config: {
              camera: config.camera,
              resolution: config.resolution,
              fps: config.fps,
              format: config.format,
            },
          },
          resolve
        );
      });

      if (!sessionResult.success || !sessionResult.sessionId) {
        throw new Error(sessionResult.error || "Failed to create session");
      }

      setSessionId(sessionResult.sessionId);
      
      if (sessionResult.iceServers) {
        iceServersRef.current = sessionResult.iceServers;
      }

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add transceiver for receiving video
      pc.addTransceiver("video", { direction: "recvonly" });

      // Request stream start from DGX Spark
      const startResult = await new Promise<{
        success: boolean;
        error?: string;
      }>((resolve) => {
        socketRef.current!.emit(
          "start-stream",
          { sessionId: sessionResult.sessionId },
          resolve
        );
      });

      if (!startResult.success) {
        throw new Error(startResult.error || "Failed to start stream");
      }

      // Start stats collection
      startStatsCollection();

      console.log("[WebRTC] Stream started successfully");
    } catch (err: any) {
      console.error("[WebRTC] Failed to start stream:", err);
      setError(err.message);
      setIsConnecting(false);
      onError?.(err.message);
      throw err;
    }
  }, [connectSignaling, createPeerConnection, startStatsCollection, onError]);

  // Stop stream
  const stopStream = useCallback(async () => {
    try {
      if (socketRef.current && sessionId) {
        await new Promise<void>((resolve) => {
          socketRef.current!.emit("stop-stream", { sessionId }, () => resolve());
        });
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      handleStreamStopped();
      setSessionId(null);
      setStats(DEFAULT_STATS);

      console.log("[WebRTC] Stream stopped");
    } catch (err: any) {
      console.error("[WebRTC] Failed to stop stream:", err);
    }
  }, [sessionId, handleStreamStopped]);

  // Reconnect
  const reconnect = useCallback(async () => {
    await stopStream();
    
    if (configRef.current) {
      await startStream(configRef.current);
    }
  }, [stopStream, startStream]);

  // Connect to signaling on mount
  useEffect(() => {
    connectSignaling();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [connectSignaling]);

  return {
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
  };
}
