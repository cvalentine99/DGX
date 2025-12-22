/**
 * WebRTC Signaling Server using Socket.IO
 * Provides real-time SDP and ICE candidate exchange for WebRTC streaming
 * Supports both LOCAL (direct commands) and REMOTE (SSH) execution
 */

import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Client } from "ssh2";
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execCallback);

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

// DGX Spark host configurations - unified with local/remote logic
const DGX_HOSTS = {
  alpha: {
    name: "DGX Spark Alpha",
    ip: "192.168.50.139",
    sshHost: process.env.DGX_SSH_HOST || "192.168.50.139",
    sshPort: parseInt(process.env.DGX_SSH_PORT || "22"),
    isLocal: false, // Alpha is REMOTE - accessed via SSH
  },
  beta: {
    name: "DGX Spark Beta",
    ip: "192.168.50.110",
    sshHost: process.env.DGX_SSH_HOST_BETA || "192.168.50.110",
    sshPort: parseInt(process.env.DGX_SSH_PORT_BETA || "22"),
    isLocal: process.env.LOCAL_HOST === 'beta' || process.env.LOCAL_HOST === undefined, // Beta is LOCAL by default
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

  return { username, password, privateKey };
}

/**
 * Check if SSH credentials are configured
 */
function hasSSHCredentials(): boolean {
  const creds = getSSHCredentials();
  return !!(creds.username && (creds.password || creds.privateKey));
}

/**
 * Execute command locally (for Beta when running on Beta)
 */
async function executeLocalCommand(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });
    return { stdout: stdout || '', stderr: stderr || '', code: 0 };
  } catch (error: any) {
    return { 
      stdout: error.stdout || '', 
      stderr: error.stderr || error.message || 'Command failed', 
      code: error.code || 1 
    };
  }
}

/**
 * Create SSH connection to DGX Spark (only for remote hosts)
 */
function createSSHConnection(hostId: "alpha" | "beta"): Promise<Client> {
  return new Promise((resolve, reject) => {
    const host = DGX_HOSTS[hostId];
    const credentials = getSSHCredentials();
    
    if (!credentials.username) {
      reject(new Error("DGX_SSH_USERNAME not configured"));
      return;
    }
    
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
      host: host.sshHost,
      port: host.sshPort,
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
 * Execute command on host - automatically chooses local or SSH
 */
async function executeOnHost(hostId: "alpha" | "beta", command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const host = DGX_HOSTS[hostId];
  
  if (host.isLocal) {
    console.log(`[WebRTC Signaling] Executing locally on ${host.name}: ${command.substring(0, 80)}...`);
    return executeLocalCommand(command);
  } else {
    // Remote host - use SSH
    if (!hasSSHCredentials()) {
      return { stdout: '', stderr: 'SSH credentials not configured', code: 1 };
    }
    
    const conn = await createSSHConnection(hostId);
    const result = await executeSSHCommand(conn, command);
    conn.end();
    return result;
  }
}

/**
 * Generate GStreamer WebRTC pipeline command
 */
function generateGStreamerPipeline(
  session: SignalingSession,
  signalingUrl: string
): string {
  // GStreamer pipeline for WebRTC streaming with hardware encoding
  const pipeline = `python3 /opt/nemo/gstreamer-webrtc-sender.py \\
    --device ${session.camera} \\
    --resolution ${session.resolution} \\
    --fps ${session.fps} \\
    --signaling-url ${signalingUrl} \\
    --stun-server stun://stun.l.google.com:19302`;

  return pipeline;
}

/**
 * Start GStreamer pipeline on DGX Spark (local or SSH)
 */
async function startGStreamerPipeline(
  session: SignalingSession,
  signalingUrl: string
): Promise<{ success: boolean; error?: string; pid?: number }> {
  const host = DGX_HOSTS[session.hostId];
  
  try {
    // Check if camera is available
    const camCheck = await executeOnHost(session.hostId, `ls -la ${session.camera}`);
    if (camCheck.code !== 0) {
      return { success: false, error: `Camera ${session.camera} not found` };
    }

    // Generate pipeline command
    const pipeline = generateGStreamerPipeline(session, signalingUrl);

    // Start pipeline in background and get PID
    const startCmd = `nohup ${pipeline} > /tmp/webrtc-${session.id}.log 2>&1 & echo $!`;
    const result = await executeOnHost(session.hostId, startCmd);

    if (result.code === 0 && result.stdout.trim()) {
      const pid = parseInt(result.stdout.trim());
      console.log(`[WebRTC Signaling] Started pipeline on ${host.name} (${host.isLocal ? 'LOCAL' : 'REMOTE'}), PID: ${pid}`);
      return { success: true, pid };
    }

    return { success: false, error: "Failed to start pipeline" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Stop GStreamer pipeline on DGX Spark (local or SSH)
 */
async function stopGStreamerPipeline(
  session: SignalingSession
): Promise<{ success: boolean; error?: string }> {
  if (!session.gstreamerPid) {
    return { success: true };
  }

  try {
    // Kill the GStreamer process
    await executeOnHost(session.hostId, `kill ${session.gstreamerPid} 2>/dev/null || true`);
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
        const host = DGX_HOSTS[data.hostId];
        
        // Check if we can access this host
        if (!host.isLocal && !hasSSHCredentials()) {
          callback({ success: false, error: "SSH credentials not configured for remote host" });
          return;
        }
        
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

        console.log(`[WebRTC Signaling] Session created: ${sessionId} on ${host.name} (${host.isLocal ? 'LOCAL' : 'REMOTE'})`);

        callback({
          success: true,
          sessionId,
          iceServers: getIceServers(),
          host: {
            name: host.name,
            ip: host.ip,
            isLocal: host.isLocal,
          },
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

      console.log(`[WebRTC Signaling] Sender registered for session ${data.sessionId}`);

      // Notify receiver that sender is ready
      socket.to(data.sessionId).emit("sender-ready", {
        sessionId: data.sessionId,
        device: data.device,
        resolution: data.resolution,
        fps: data.fps,
      });

      callback({ success: true });
    });

    // Handle SDP offer from receiver
    socket.on("offer", async (data: {
      sessionId: string;
      offer: RTCSessionDescriptionInit;
    }, callback) => {
      const session = sessions.get(data.sessionId);
      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      session.offer = data.offer;
      session.lastActivity = Date.now();

      // Forward offer to sender
      if (session.senderSocket) {
        io?.to(session.senderSocket).emit("offer", {
          sessionId: data.sessionId,
          offer: data.offer,
        });
      }

      callback({ success: true });
    });

    // Handle SDP answer from sender
    socket.on("answer", async (data: {
      sessionId: string;
      answer: RTCSessionDescriptionInit;
    }, callback) => {
      const session = sessions.get(data.sessionId);
      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      session.answer = data.answer;
      session.status = "streaming";
      session.lastActivity = Date.now();

      // Forward answer to receiver
      if (session.receiverSocket) {
        io?.to(session.receiverSocket).emit("answer", {
          sessionId: data.sessionId,
          answer: data.answer,
        });
      }

      callback({ success: true });
    });

    // Handle ICE candidate from either peer
    socket.on("ice-candidate", async (data: {
      sessionId: string;
      candidate: RTCIceCandidateInit;
      from: "sender" | "receiver";
    }) => {
      const session = sessions.get(data.sessionId);
      if (!session) return;

      session.lastActivity = Date.now();

      // Store and forward candidate
      if (data.from === "sender") {
        session.senderCandidates.push(data.candidate);
        if (session.receiverSocket) {
          io?.to(session.receiverSocket).emit("ice-candidate", {
            sessionId: data.sessionId,
            candidate: data.candidate,
          });
        }
      } else {
        session.receiverCandidates.push(data.candidate);
        if (session.senderSocket) {
          io?.to(session.senderSocket).emit("ice-candidate", {
            sessionId: data.sessionId,
            candidate: data.candidate,
          });
        }
      }
    });

    // Handle session stop request
    socket.on("stop-session", async (data: { sessionId: string }, callback) => {
      const session = sessions.get(data.sessionId);
      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      // Stop GStreamer pipeline
      if (session.gstreamerPid) {
        await stopGStreamerPipeline(session);
      }

      session.status = "stopped";

      // Notify all participants
      io?.to(data.sessionId).emit("session-stopped", { sessionId: data.sessionId });

      // Clean up
      sessions.delete(data.sessionId);
      if (session.senderSocket) socketToSession.delete(session.senderSocket);
      if (session.receiverSocket) socketToSession.delete(session.receiverSocket);

      callback({ success: true });
    });

    // Handle start pipeline request
    socket.on("start-pipeline", async (data: {
      sessionId: string;
      signalingUrl: string;
    }, callback) => {
      const session = sessions.get(data.sessionId);
      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      const result = await startGStreamerPipeline(session, data.signalingUrl);
      if (result.success && result.pid) {
        session.gstreamerPid = result.pid;
      }

      callback(result);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`[WebRTC Signaling] Client disconnected: ${socket.id}`);

      const sessionId = socketToSession.get(socket.id);
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          // Mark session as error if sender disconnected
          if (session.senderSocket === socket.id) {
            session.status = "error";
            session.error = "Sender disconnected";
            io?.to(sessionId).emit("session-error", {
              sessionId,
              error: "Sender disconnected",
            });
          }
        }
        socketToSession.delete(socket.id);
      }
    });
  });

  console.log("[WebRTC Signaling] Signaling server initialized");
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
