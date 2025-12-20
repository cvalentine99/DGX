/**
 * WebRTC Signaling Server using Socket.IO
 * Provides real-time SDP and ICE candidate exchange for WebRTC streaming
 */

import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Client } from "ssh2";

// Types for signaling messages
interface SignalingSession {
  id: string;
  hostId: "alpha" | "beta";
  camera: string;
  resolution: string;
  fps: number;
  format: string;
  senderSocket?: string;
  receiverSocket?: string;
  status: "waiting" | "connecting" | "streaming" | "stopped" | "error";
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  senderCandidates: RTCIceCandidateInit[];
  receiverCandidates: RTCIceCandidateInit[];
  createdAt: number;
  lastActivity: number;
  gstreamerPid?: number;
  error?: string;
}

interface StreamConfig {
  camera: string;
  resolution: string;
  fps: number;
  format: string;
}

// DGX Spark host configurations
const DGX_HOSTS = {
  alpha: {
    name: "DGX Spark Alpha",
    host: process.env.DGX_SSH_HOST || "0.tcp.ngrok.io",
    port: parseInt(process.env.DGX_SSH_PORT || "17974"),
    localIp: "192.168.50.139",
  },
  beta: {
    name: "DGX Spark Beta",
    host: process.env.DGX_SSH_HOST || "0.tcp.ngrok.io",
    port: parseInt(process.env.DGX_SSH_PORT || "17974"),
    localIp: "192.168.50.110",
  },
} as const;

// TURN server configuration
interface TurnConfig {
  urls: string;
  username?: string;
  credential?: string;
}

// Active signaling sessions
const sessions = new Map<string, SignalingSession>();

// Socket to session mapping
const socketToSession = new Map<string, string>();

// Socket.IO server instance
let io: SocketIOServer | null = null;

/**
 * Get ICE server configuration including STUN and TURN
 */
function getIceServers(): (RTCIceServer | TurnConfig)[] {
  const servers: (RTCIceServer | TurnConfig)[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  // Add TURN server if configured
  const turnServer = process.env.TURN_SERVER_URL;
  const turnUser = process.env.TURN_SERVER_USERNAME;
  const turnPass = process.env.TURN_SERVER_CREDENTIAL;

  if (turnServer) {
    servers.push({
      urls: turnServer,
      username: turnUser,
      credential: turnPass,
    });
  }

  return servers;
}

/**
 * Get SSH credentials from environment
 */
function getSSHCredentials() {
  const username = process.env.DGX_SSH_USERNAME;
  const password = process.env.DGX_SSH_PASSWORD;
  const privateKey = process.env.DGX_SSH_PRIVATE_KEY;

  if (!username) {
    throw new Error("DGX_SSH_USERNAME not configured");
  }

  return { username, password, privateKey };
}

/**
 * Create SSH connection to DGX Spark
 */
function createSSHConnection(hostId: "alpha" | "beta"): Promise<Client> {
  return new Promise((resolve, reject) => {
    const host = DGX_HOSTS[hostId];
    const credentials = getSSHCredentials();
    const conn = new Client();

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH connection timeout to ${host.name}`));
    }, 10000);

    conn.on("ready", () => {
      clearTimeout(timeout);
      resolve(conn);
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`SSH connection failed to ${host.name}: ${err.message}`));
    });

    const config: any = {
      host: host.host,
      port: host.port,
      username: credentials.username,
      readyTimeout: 10000,
    };

    if (credentials.privateKey) {
      config.privateKey = credentials.privateKey;
    } else if (credentials.password) {
      config.password = credentials.password;
    }

    conn.connect(config);
  });
}

/**
 * Execute SSH command
 */
function executeSSHCommand(
  conn: Client,
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    conn.exec(command, (err, stream) => {
      if (err) {
        resolve({ stdout: "", stderr: err.message, code: 1 });
        return;
      }

      stream.on("close", (code: number) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
    });
  });
}

/**
 * Generate GStreamer WebRTC pipeline command
 */
function generateGStreamerPipeline(
  session: SignalingSession,
  signalingUrl: string
): string {
  const [width, height] = session.resolution.split("x").map(Number);

  // GStreamer pipeline for WebRTC streaming with hardware encoding
  // Uses the Python WebRTC sender script for proper signaling integration
  const pipeline = `python3 /opt/nemo/gstreamer-webrtc-sender.py \\
    --device ${session.camera} \\
    --resolution ${session.resolution} \\
    --fps ${session.fps} \\
    --signaling-url ${signalingUrl} \\
    --stun-server stun://stun.l.google.com:19302`;

  return pipeline;
}

/**
 * Start GStreamer pipeline on DGX Spark via SSH
 */
async function startGStreamerPipeline(
  session: SignalingSession,
  signalingUrl: string
): Promise<{ success: boolean; error?: string; pid?: number }> {
  try {
    const conn = await createSSHConnection(session.hostId);

    // Check if camera is available
    const camCheck = await executeSSHCommand(conn, `ls -la ${session.camera}`);
    if (camCheck.code !== 0) {
      conn.end();
      return { success: false, error: `Camera ${session.camera} not found` };
    }

    // Generate pipeline command
    const pipeline = generateGStreamerPipeline(session, signalingUrl);

    // Start pipeline in background and get PID
    const startCmd = `nohup ${pipeline} > /tmp/webrtc-${session.id}.log 2>&1 & echo $!`;
    const result = await executeSSHCommand(conn, startCmd);

    conn.end();

    if (result.code === 0 && result.stdout.trim()) {
      const pid = parseInt(result.stdout.trim());
      return { success: true, pid };
    }

    return { success: false, error: "Failed to start pipeline" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Stop GStreamer pipeline on DGX Spark via SSH
 */
async function stopGStreamerPipeline(
  session: SignalingSession
): Promise<{ success: boolean; error?: string }> {
  if (!session.gstreamerPid) {
    return { success: true };
  }

  try {
    const conn = await createSSHConnection(session.hostId);

    // Kill the GStreamer process
    await executeSSHCommand(conn, `kill ${session.gstreamerPid} 2>/dev/null || true`);

    conn.end();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old sessions
 */
function cleanupOldSessions() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  const entries = Array.from(sessions.entries());
  for (const [id, session] of entries) {
    if (now - session.lastActivity > maxAge) {
      // Stop pipeline if running
      if (session.gstreamerPid) {
        stopGStreamerPipeline(session).catch(console.error);
      }
      sessions.delete(id);
      console.log(`[WebRTC Signaling] Cleaned up session ${id}`);
    }
  }
}

/**
 * Initialize WebSocket signaling server
 */
export function initializeSignalingServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/webrtc-signaling",
    transports: ["websocket", "polling"],
  });

  // Cleanup interval
  setInterval(cleanupOldSessions, 60000);

  io.on("connection", (socket: Socket) => {
    console.log(`[WebRTC Signaling] Client connected: ${socket.id}`);

    // Handle session creation request
    socket.on("create-session", async (data: {
      hostId: "alpha" | "beta";
      config: StreamConfig;
    }, callback) => {
      try {
        const sessionId = `ws-${data.hostId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const session: SignalingSession = {
          id: sessionId,
          hostId: data.hostId,
          camera: data.config.camera,
          resolution: data.config.resolution,
          fps: data.config.fps,
          format: data.config.format,
          receiverSocket: socket.id,
          status: "waiting",
          senderCandidates: [],
          receiverCandidates: [],
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };

        sessions.set(sessionId, session);
        socketToSession.set(socket.id, sessionId);

        // Join session room
        socket.join(sessionId);

        console.log(`[WebRTC Signaling] Session created: ${sessionId}`);

        callback({
          success: true,
          sessionId,
          iceServers: getIceServers(),
          host: DGX_HOSTS[data.hostId],
        });
      } catch (error: any) {
        callback({ success: false, error: error.message });
      }
    });

    // Handle sender registration (from GStreamer on DGX Spark)
    socket.on("register-sender", async (data: {
      sessionId: string;
      device: string;
      resolution: string;
      fps: number;
    }, callback) => {
      const session = sessions.get(data.sessionId);
      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      session.senderSocket = socket.id;
      session.status = "connecting";
      session.lastActivity = Date.now();

      socketToSession.set(socket.id, data.sessionId);
      socket.join(data.sessionId);

      console.log(`[WebRTC Signaling] Sender registered for session: ${data.sessionId}`);

      // Notify receiver that sender is ready
      socket.to(data.sessionId).emit("sender-ready", {
        sessionId: data.sessionId,
        device: data.device,
        resolution: data.resolution,
        fps: data.fps,
      });

      callback({ success: true });
    });

    // Handle SDP offer from sender
    socket.on("offer", (data: {
      sessionId: string;
      sdp: string;
    }) => {
      const session = sessions.get(data.sessionId);
      if (!session) return;

      session.offer = { type: "offer", sdp: data.sdp };
      session.lastActivity = Date.now();

      console.log(`[WebRTC Signaling] Offer received for session: ${data.sessionId}`);

      // Forward offer to receiver
      socket.to(data.sessionId).emit("offer", {
        sessionId: data.sessionId,
        sdp: data.sdp,
      });
    });

    // Handle SDP answer from receiver
    socket.on("answer", (data: {
      sessionId: string;
      sdp: string;
    }) => {
      const session = sessions.get(data.sessionId);
      if (!session) return;

      session.answer = { type: "answer", sdp: data.sdp };
      session.status = "streaming";
      session.lastActivity = Date.now();

      console.log(`[WebRTC Signaling] Answer received for session: ${data.sessionId}`);

      // Forward answer to sender
      socket.to(data.sessionId).emit("answer", {
        sessionId: data.sessionId,
        sdp: data.sdp,
      });
    });

    // Handle ICE candidate from either peer
    socket.on("ice-candidate", (data: {
      sessionId: string;
      candidate: RTCIceCandidateInit;
      from: "sender" | "receiver";
    }) => {
      const session = sessions.get(data.sessionId);
      if (!session) return;

      session.lastActivity = Date.now();

      // Store candidate
      if (data.from === "sender") {
        session.senderCandidates.push(data.candidate);
      } else {
        session.receiverCandidates.push(data.candidate);
      }

      // Forward to the other peer
      socket.to(data.sessionId).emit("ice-candidate", {
        sessionId: data.sessionId,
        candidate: data.candidate,
        from: data.from,
      });
    });

    // Handle start stream request
    socket.on("start-stream", async (data: {
      sessionId: string;
    }, callback) => {
      const session = sessions.get(data.sessionId);
      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      // Get signaling URL for GStreamer
      const protocol = process.env.NODE_ENV === "production" ? "wss" : "ws";
      const host = process.env.SIGNALING_HOST || "localhost:3000";
      const signalingUrl = `${protocol}://${host}/webrtc-signaling`;

      console.log(`[WebRTC Signaling] Starting stream for session: ${data.sessionId}`);

      // Start GStreamer pipeline on DGX Spark
      const result = await startGStreamerPipeline(session, signalingUrl);

      if (result.success) {
        session.gstreamerPid = result.pid;
        session.status = "connecting";
        callback({ success: true, message: "Pipeline started" });
      } else {
        session.status = "error";
        session.error = result.error;
        callback({ success: false, error: result.error });
      }
    });

    // Handle stop stream request
    socket.on("stop-stream", async (data: {
      sessionId: string;
    }, callback) => {
      const session = sessions.get(data.sessionId);
      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      console.log(`[WebRTC Signaling] Stopping stream for session: ${data.sessionId}`);

      // Stop GStreamer pipeline
      await stopGStreamerPipeline(session);

      session.status = "stopped";
      session.gstreamerPid = undefined;

      // Notify all peers
      io?.to(data.sessionId).emit("stream-stopped", {
        sessionId: data.sessionId,
      });

      callback({ success: true });
    });

    // Handle connection state update
    socket.on("connection-state", (data: {
      sessionId: string;
      state: string;
    }) => {
      const session = sessions.get(data.sessionId);
      if (!session) return;

      session.lastActivity = Date.now();

      console.log(`[WebRTC Signaling] Connection state for ${data.sessionId}: ${data.state}`);

      // Forward to other peers
      socket.to(data.sessionId).emit("connection-state", data);
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`[WebRTC Signaling] Client disconnected: ${socket.id}`);

      const sessionId = socketToSession.get(socket.id);
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          // If sender disconnected, stop the pipeline
          if (session.senderSocket === socket.id) {
            await stopGStreamerPipeline(session);
            session.senderSocket = undefined;
          }

          // If receiver disconnected, notify sender
          if (session.receiverSocket === socket.id) {
            session.receiverSocket = undefined;
            io?.to(sessionId).emit("receiver-disconnected", { sessionId });
          }

          // If both disconnected, clean up session
          if (!session.senderSocket && !session.receiverSocket) {
            sessions.delete(sessionId);
          }
        }

        socketToSession.delete(socket.id);
      }
    });
  });

  console.log("[WebRTC Signaling] Server initialized");
  return io;
}

/**
 * Get signaling server instance
 */
export function getSignalingServer(): SocketIOServer | null {
  return io;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): SignalingSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Get all active sessions
 */
export function getAllSessions(): SignalingSession[] {
  return Array.from(sessions.values());
}
