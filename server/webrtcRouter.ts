import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { Client } from "ssh2";

// WebRTC Session Management
interface WebRTCSession {
  id: string;
  hostId: string;
  camera: string;
  resolution: string;
  fps: number;
  format: string;
  status: "initializing" | "connecting" | "streaming" | "stopped" | "error";
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  iceCandidates: RTCIceCandidateInit[];
  remoteIceCandidates: RTCIceCandidateInit[];
  createdAt: number;
  lastActivity: number;
  stats?: {
    bitrate: number;
    framesReceived: number;
    framesDropped: number;
    latency: number;
  };
  error?: string;
}

// Active WebRTC sessions
const activeSessions = new Map<string, WebRTCSession>();

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

type HostId = keyof typeof DGX_HOSTS;

// Get SSH credentials
function getSSHCredentials() {
  const username = process.env.DGX_SSH_USERNAME;
  const password = process.env.DGX_SSH_PASSWORD;
  const privateKey = process.env.DGX_SSH_PRIVATE_KEY;

  if (!username) {
    throw new Error("DGX_SSH_USERNAME not configured");
  }

  return { username, password, privateKey };
}

// Create SSH connection
function createSSHConnection(hostId: HostId): Promise<Client> {
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

// Execute SSH command
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

// Clean up old sessions (older than 5 minutes)
function cleanupOldSessions() {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  const entries = Array.from(activeSessions.entries());
  for (const [id, session] of entries) {
    if (now - session.lastActivity > maxAge) {
      activeSessions.delete(id);
    }
  }
}

// Generate GStreamer WebRTC pipeline command
function generateGStreamerPipeline(session: WebRTCSession): string {
  const [width, height] = session.resolution.split("x").map(Number);
  const fps = session.fps;
  const camera = session.camera;
  
  // GStreamer pipeline for WebRTC streaming with hardware encoding on DGX Spark
  // Uses v4l2src for camera capture and nvv4l2h264enc for GPU-accelerated encoding
  const pipeline = `
    gst-launch-1.0 -v \\
      v4l2src device=${camera} ! \\
      video/x-raw,width=${width},height=${height},framerate=${fps}/1 ! \\
      videoconvert ! \\
      nvvidconv ! \\
      nvv4l2h264enc bitrate=4000000 preset-level=1 ! \\
      h264parse ! \\
      rtph264pay config-interval=-1 pt=96 ! \\
      webrtcbin name=sendrecv bundle-policy=max-bundle stun-server=stun://stun.l.google.com:19302
  `.trim().replace(/\s+/g, " ");
  
  return pipeline;
}

export const webrtcRouter = router({
  // Create a new WebRTC streaming session
  createSession: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      camera: z.string().default("/dev/video0"),
      resolution: z.string().default("1920x1080"),
      fps: z.number().default(30),
      format: z.string().default("H.264"),
    }))
    .mutation(async ({ input }) => {
      cleanupOldSessions();
      
      const sessionId = `webrtc-${input.hostId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const session: WebRTCSession = {
        id: sessionId,
        hostId: input.hostId,
        camera: input.camera,
        resolution: input.resolution,
        fps: input.fps,
        format: input.format,
        status: "initializing",
        iceCandidates: [],
        remoteIceCandidates: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      
      activeSessions.set(sessionId, session);
      
      // In a real implementation, this would start the GStreamer pipeline on the DGX Spark
      // For now, we simulate the session creation
      session.status = "connecting";
      
      return {
        success: true,
        sessionId,
        host: DGX_HOSTS[input.hostId],
        config: {
          camera: input.camera,
          resolution: input.resolution,
          fps: input.fps,
          format: input.format,
        },
        // STUN/TURN servers for NAT traversal
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      };
    }),

  // Set the SDP offer from the client
  setOffer: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      offer: z.object({
        type: z.literal("offer"),
        sdp: z.string(),
      }),
    }))
    .mutation(async ({ input }) => {
      const session = activeSessions.get(input.sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }
      
      session.offer = input.offer as RTCSessionDescriptionInit;
      session.lastActivity = Date.now();
      
      // In a real implementation, this would send the offer to the GStreamer pipeline
      // and receive an answer. For simulation, we generate a mock answer.
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Generate a simulated SDP answer
      // In production, this would come from the GStreamer WebRTC pipeline
      const mockAnswer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: generateMockSdpAnswer(input.offer.sdp, session),
      };
      
      session.answer = mockAnswer;
      session.status = "streaming";
      
      return {
        success: true,
        answer: mockAnswer,
      };
    }),

  // Get the SDP answer for the client
  getAnswer: publicProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      const session = activeSessions.get(input.sessionId);
      if (!session) {
        return { success: false, error: "Session not found", answer: null };
      }
      
      session.lastActivity = Date.now();
      
      return {
        success: true,
        answer: session.answer || null,
        status: session.status,
      };
    }),

  // Add ICE candidate from client
  addIceCandidate: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      candidate: z.object({
        candidate: z.string(),
        sdpMid: z.string().nullable(),
        sdpMLineIndex: z.number().nullable(),
      }),
    }))
    .mutation(async ({ input }) => {
      const session = activeSessions.get(input.sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }
      
      session.remoteIceCandidates.push(input.candidate as RTCIceCandidateInit);
      session.lastActivity = Date.now();
      
      return { success: true };
    }),

  // Get ICE candidates from server (DGX Spark)
  getIceCandidates: publicProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      const session = activeSessions.get(input.sessionId);
      if (!session) {
        return { success: false, error: "Session not found", candidates: [] };
      }
      
      session.lastActivity = Date.now();
      
      // In a real implementation, these would come from the GStreamer pipeline
      // For simulation, generate mock ICE candidates
      if (session.iceCandidates.length === 0 && session.status === "streaming") {
        session.iceCandidates = generateMockIceCandidates();
      }
      
      return {
        success: true,
        candidates: session.iceCandidates,
        status: session.status,
      };
    }),

  // Get session status and stats
  getSessionStatus: publicProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      const session = activeSessions.get(input.sessionId);
      if (!session) {
        return { success: false, error: "Session not found", session: null };
      }
      
      session.lastActivity = Date.now();
      
      // Update simulated stats
      if (session.status === "streaming") {
        session.stats = {
          bitrate: 3500000 + Math.random() * 1000000, // ~3.5-4.5 Mbps
          framesReceived: Math.floor((Date.now() - session.createdAt) / 1000 * session.fps),
          framesDropped: Math.floor(Math.random() * 5),
          latency: 15 + Math.random() * 10, // 15-25ms
        };
      }
      
      return {
        success: true,
        session: {
          id: session.id,
          hostId: session.hostId,
          camera: session.camera,
          resolution: session.resolution,
          fps: session.fps,
          format: session.format,
          status: session.status,
          stats: session.stats,
          createdAt: session.createdAt,
          uptime: Date.now() - session.createdAt,
        },
      };
    }),

  // Stop a streaming session
  stopSession: publicProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const session = activeSessions.get(input.sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }
      
      session.status = "stopped";
      
      // In a real implementation, this would stop the GStreamer pipeline on DGX Spark
      // via SSH command
      
      activeSessions.delete(input.sessionId);
      
      return { success: true, message: "Session stopped" };
    }),

  // List all active sessions
  listSessions: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]).optional(),
    }))
    .query(async ({ input }) => {
      cleanupOldSessions();
      
      const sessions = Array.from(activeSessions.values())
        .filter(s => !input.hostId || s.hostId === input.hostId)
        .map(s => ({
          id: s.id,
          hostId: s.hostId,
          camera: s.camera,
          resolution: s.resolution,
          fps: s.fps,
          status: s.status,
          createdAt: s.createdAt,
          uptime: Date.now() - s.createdAt,
        }));
      
      return {
        success: true,
        sessions,
        count: sessions.length,
      };
    }),

  // Start GStreamer pipeline on DGX Spark (real implementation)
  startGStreamerPipeline: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const session = activeSessions.get(input.sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }
      
      try {
        const conn = await createSSHConnection(input.hostId);
        
        // Check if GStreamer is available
        const gstCheck = await executeSSHCommand(conn, "which gst-launch-1.0");
        if (gstCheck.code !== 0) {
          conn.end();
          return { success: false, error: "GStreamer not found on host" };
        }
        
        // Check if camera is available
        const camCheck = await executeSSHCommand(conn, `ls -la ${session.camera}`);
        if (camCheck.code !== 0) {
          conn.end();
          return { success: false, error: `Camera ${session.camera} not found` };
        }
        
        // Generate and start the pipeline (in background)
        const pipeline = generateGStreamerPipeline(session);
        const startCmd = `nohup ${pipeline} > /tmp/webrtc-${session.id}.log 2>&1 &`;
        
        await executeSSHCommand(conn, startCmd);
        conn.end();
        
        session.status = "streaming";
        
        return {
          success: true,
          message: "GStreamer pipeline started",
          pipeline: pipeline,
        };
      } catch (error: any) {
        session.status = "error";
        session.error = error.message;
        return { success: false, error: error.message };
      }
    }),
});

// Generate a mock SDP answer for simulation
function generateMockSdpAnswer(offerSdp: string, session: WebRTCSession): string {
  const [width, height] = session.resolution.split("x").map(Number);
  
  return `v=0
o=- ${Date.now()} 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS stream
m=video 9 UDP/TLS/RTP/SAVPF 96
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:${Math.random().toString(36).substr(2, 8)}
a=ice-pwd:${Math.random().toString(36).substr(2, 24)}
a=ice-options:trickle
a=fingerprint:sha-256 ${generateMockFingerprint()}
a=setup:active
a=mid:0
a=sendonly
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 H264/90000
a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=ssrc:${Math.floor(Math.random() * 4294967295)} cname:dgx-spark-camera
a=ssrc:${Math.floor(Math.random() * 4294967295)} msid:stream video
`;
}

// Generate mock fingerprint
function generateMockFingerprint(): string {
  const bytes = Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()
  );
  return bytes.join(":");
}

// Generate mock ICE candidates
function generateMockIceCandidates(): RTCIceCandidateInit[] {
  return [
    {
      candidate: `candidate:1 1 UDP 2130706431 192.168.50.139 ${49152 + Math.floor(Math.random() * 1000)} typ host`,
      sdpMid: "0",
      sdpMLineIndex: 0,
    },
    {
      candidate: `candidate:2 1 UDP 1694498815 ${DGX_HOSTS.alpha.host} ${49152 + Math.floor(Math.random() * 1000)} typ srflx raddr 192.168.50.139 rport ${49152 + Math.floor(Math.random() * 1000)}`,
      sdpMid: "0",
      sdpMLineIndex: 0,
    },
  ];
}
