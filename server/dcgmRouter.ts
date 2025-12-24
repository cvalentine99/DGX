import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { Client } from "ssh2";
import { recordGpuMetrics, getGpuMetricsHistory, createSystemAlert, cleanupOldGpuMetrics } from "./db";
import {
  DGX_HOSTS as DGX_HOSTS_MAP,
  DGXHost,
  HostId,
  getAllHosts,
  getHost,
  isLocalHost,
  executeLocalCommand,
  hasSSHCredentials,
} from "./hostConfig";

// Convert to array format for backwards compatibility
const DGX_HOSTS = getAllHosts();

// GPU metrics interface
interface GpuMetrics {
  index: number;
  name: string;
  uuid: string;
  utilization: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryUtilization: number;
  temperature: number;
  powerDraw: number;
  powerLimit: number;
  fanSpeed: number;
  clockGraphics: number;
  clockMemory: number;
  pcieGen: number;
  pcieLinkWidth: number;
}

interface HostMetrics {
  hostId: string;
  hostName: string;
  hostIp: string;
  timestamp: number;
  connected: boolean;
  error?: string;
  isLocal?: boolean;
  gpus: GpuMetrics[];
  systemMetrics: {
    cpuUtilization: number;
    memoryUsed: number;
    memoryTotal: number;
    uptime: string;
  };
}

// Cache for metrics to reduce SSH calls
const metricsCache: Map<string, { data: HostMetrics; timestamp: number }> = new Map();
const CACHE_TTL = 5000; // 5 seconds

// Alert thresholds
const ALERT_THRESHOLDS = {
  temperatureWarning: 65, // °C
  temperatureCritical: 70, // °C
  powerSpikePercent: 90, // % of power limit
  utilizationHigh: 95, // %
  memoryHigh: 90, // % of total
};

// Track last alert times to avoid spam (cooldown in ms)
const lastAlertTime: Map<string, number> = new Map();
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Check metrics against thresholds and create alerts
async function checkAlertThresholds(hostId: string, hostName: string, metrics: HostMetrics) {
  const now = Date.now();
  
  for (const gpu of metrics.gpus) {
    // Temperature critical alert
    if (gpu.temperature >= ALERT_THRESHOLDS.temperatureCritical) {
      const alertKey = `${hostId}-temp-critical`;
      const lastAlert = lastAlertTime.get(alertKey) || 0;
      if (now - lastAlert > ALERT_COOLDOWN) {
        await createSystemAlert({
          type: "error",
          message: `GPU ${gpu.index} on ${hostName} temperature critical: ${gpu.temperature}°C (threshold: ${ALERT_THRESHOLDS.temperatureCritical}°C)`,
          hostId,
        });
        lastAlertTime.set(alertKey, now);
        console.log(`[Alert] Critical temperature on ${hostName}: ${gpu.temperature}°C`);
      }
    }
    // Temperature warning alert
    else if (gpu.temperature >= ALERT_THRESHOLDS.temperatureWarning) {
      const alertKey = `${hostId}-temp-warning`;
      const lastAlert = lastAlertTime.get(alertKey) || 0;
      if (now - lastAlert > ALERT_COOLDOWN) {
        await createSystemAlert({
          type: "warning",
          message: `GPU ${gpu.index} on ${hostName} temperature elevated: ${gpu.temperature}°C (threshold: ${ALERT_THRESHOLDS.temperatureWarning}°C)`,
          hostId,
        });
        lastAlertTime.set(alertKey, now);
        console.log(`[Alert] Warning temperature on ${hostName}: ${gpu.temperature}°C`);
      }
    }
    
    // Power spike alert
    if (gpu.powerLimit > 0) {
      const powerPercent = (gpu.powerDraw / gpu.powerLimit) * 100;
      if (powerPercent >= ALERT_THRESHOLDS.powerSpikePercent) {
        const alertKey = `${hostId}-power-spike`;
        const lastAlert = lastAlertTime.get(alertKey) || 0;
        if (now - lastAlert > ALERT_COOLDOWN) {
          await createSystemAlert({
            type: "warning",
            message: `GPU ${gpu.index} on ${hostName} power spike: ${gpu.powerDraw.toFixed(1)}W (${powerPercent.toFixed(0)}% of ${gpu.powerLimit}W limit)`,
            hostId,
          });
          lastAlertTime.set(alertKey, now);
          console.log(`[Alert] Power spike on ${hostName}: ${gpu.powerDraw}W`);
        }
      }
    }
    
    // High utilization alert (sustained)
    if (gpu.utilization >= ALERT_THRESHOLDS.utilizationHigh) {
      const alertKey = `${hostId}-util-high`;
      const lastAlert = lastAlertTime.get(alertKey) || 0;
      if (now - lastAlert > ALERT_COOLDOWN) {
        await createSystemAlert({
          type: "info",
          message: `GPU ${gpu.index} on ${hostName} running at high utilization: ${gpu.utilization}%`,
          hostId,
        });
        lastAlertTime.set(alertKey, now);
      }
    }
  }
  
  // System memory alert
  if (metrics.systemMetrics.memoryTotal > 0) {
    const memPercent = (metrics.systemMetrics.memoryUsed / metrics.systemMetrics.memoryTotal) * 100;
    if (memPercent >= ALERT_THRESHOLDS.memoryHigh) {
      const alertKey = `${hostId}-mem-high`;
      const lastAlert = lastAlertTime.get(alertKey) || 0;
      if (now - lastAlert > ALERT_COOLDOWN) {
        await createSystemAlert({
          type: "warning",
          message: `${hostName} unified memory usage high: ${memPercent.toFixed(0)}% (${(metrics.systemMetrics.memoryUsed / 1024).toFixed(1)}GB / ${(metrics.systemMetrics.memoryTotal / 1024).toFixed(1)}GB)`,
          hostId,
        });
        lastAlertTime.set(alertKey, now);
        console.log(`[Alert] High memory on ${hostName}: ${memPercent.toFixed(0)}%`);
      }
    }
  }
}

// History storage for time-series charts (in-memory buffer before DB write)
interface MetricsHistoryPoint {
  timestamp: number;
  utilization: number;
  temperature: number;
  powerDraw: number;
  memoryUsed: number;
  memoryTotal: number;
}

const lastDbWrite: Map<string, number> = new Map();
const DB_WRITE_INTERVAL = 60000; // Write to DB every 1 minute

// Add metrics to database history
async function addToDbHistory(hostId: string, metrics: HostMetrics) {
  const gpu = metrics.gpus[0];
  if (!gpu) return;
  
  // Only write to DB if enough time has passed
  const lastWrite = lastDbWrite.get(hostId) || 0;
  if (Date.now() - lastWrite < DB_WRITE_INTERVAL) {
    return;
  }
  
  await recordGpuMetrics({
    hostId,
    gpuUtilization: Math.round(gpu.utilization),
    gpuTemperature: Math.round(gpu.temperature),
    gpuPowerDraw: Math.round(gpu.powerDraw),
    gpuMemoryUsed: Math.round(gpu.memoryUsed),
    gpuMemoryTotal: Math.round(gpu.memoryTotal),
    cpuUtilization: Math.round(metrics.systemMetrics.cpuUtilization),
    systemMemoryUsed: Math.round(metrics.systemMetrics.memoryUsed),
    systemMemoryTotal: Math.round(metrics.systemMetrics.memoryTotal),
  });
  
  lastDbWrite.set(hostId, Date.now());

  // Note: Alert conditions are handled by checkAlertThresholds() which has
  // proper cooldown logic to prevent duplicate alerts. Do not add alerts here.
}

// Cleanup old metrics periodically
setInterval(() => {
  cleanupOldGpuMetrics();
}, 60 * 60 * 1000); // Every hour

// SSH configuration from environment (kept for backwards compatibility with executeSSHCommand)
function getSSHConfig() {
  return {
    username: process.env.DGX_SSH_USERNAME || "ubuntu",
    password: process.env.DGX_SSH_PASSWORD,
    privateKey: process.env.DGX_SSH_PRIVATE_KEY,
  };
}

// Execute SSH command on a host
async function executeSSHCommand(hostIp: string, command: string, sshHost?: string, sshPort?: number): Promise<string> {
  const config = getSSHConfig();
  
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = "";
    
    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }
        
        stream.on("close", () => {
          conn.end();
          resolve(output);
        });
        
        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });
        
        stream.stderr.on("data", (data: Buffer) => {
          output += data.toString();
        });
      });
    });
    
    conn.on("error", (err) => {
      reject(err);
    });
    
    const connectionConfig: Record<string, unknown> = {
      host: sshHost || hostIp,
      port: sshPort || 22,
      username: config.username,
      readyTimeout: 10000,
    };
    
    if (config.privateKey) {
      connectionConfig.privateKey = config.privateKey;
    } else if (config.password) {
      connectionConfig.password = config.password;
    }
    
    conn.connect(connectionConfig);
  });
}

// Parse nvidia-smi output
// Map GPU names to correct display names
function mapGpuName(rawName: string): string {
  // DGX Spark uses GB10 Grace Blackwell Superchip
  if (rawName.includes("GB10")) {
    return "NVIDIA GB10 Grace Blackwell";
  }
  return rawName;
}

function parseNvidiaSmi(output: string): GpuMetrics[] {
  const gpus: GpuMetrics[] = [];
  const lines = output.trim().split("\n");
  
  for (const line of lines) {
    const parts = line.split(", ");
    if (parts.length >= 15) {
      gpus.push({
        index: parseInt(parts[0]) || 0,
        name: mapGpuName(parts[1] || "Unknown GPU"),
        uuid: parts[2] || "",
        utilization: parseInt(parts[3]) || 0,
        memoryUsed: parseInt(parts[4]) || 0,
        memoryTotal: parseInt(parts[5]) || 0,
        memoryUtilization: parseInt(parts[6]) || 0,
        temperature: parseInt(parts[7]) || 0,
        powerDraw: parseFloat(parts[8]) || 0,
        powerLimit: parseFloat(parts[9]) || 0,
        fanSpeed: parseInt(parts[10]) || 0,
        clockGraphics: parseInt(parts[11]) || 0,
        clockMemory: parseInt(parts[12]) || 0,
        pcieGen: parseInt(parts[13]) || 0,
        pcieLinkWidth: parseInt(parts[14]) || 0,
      });
    }
  }
  
  return gpus;
}

// Parse system metrics
function parseSystemMetrics(output: string): { cpuUtilization: number; memoryUsed: number; memoryTotal: number; uptime: string } {
  const lines = output.trim().split("\n");
  let cpuUtilization = 0;
  let memoryUsed = 0;
  let memoryTotal = 0;
  let uptime = "";
  
  for (const line of lines) {
    if (line.startsWith("CPU:")) {
      cpuUtilization = parseFloat(line.split(":")[1]) || 0;
    } else if (line.startsWith("MEM_USED:")) {
      memoryUsed = parseInt(line.split(":")[1]) || 0;
    } else if (line.startsWith("MEM_TOTAL:")) {
      memoryTotal = parseInt(line.split(":")[1]) || 0;
    } else if (line.startsWith("UPTIME:")) {
      uptime = line.split(":").slice(1).join(":").trim();
    }
  }
  
  return { cpuUtilization, memoryUsed, memoryTotal, uptime };
}

// Execute command on host - automatically chooses local or SSH
// Uses shared executeLocalCommand from hostConfig
async function executeCommandOnHost(host: DGXHost, command: string): Promise<string> {
  if (host.isLocal) {
    console.log(`[DCGM] Executing locally on ${host.name}: ${command.substring(0, 80)}...`);
    return executeLocalCommand(command);
  } else {
    return executeSSHCommand(host.ip, command, host.sshHost, host.sshPort);
  }
}

// Fetch metrics from a host (local or SSH)
async function fetchHostMetrics(host: DGXHost): Promise<HostMetrics> {
  // Check cache first
  const cached = metricsCache.get(host.id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    // nvidia-smi query for GPU metrics
    const nvidiaSmiCmd = `nvidia-smi --query-gpu=index,name,uuid,utilization.gpu,memory.used,memory.total,utilization.memory,temperature.gpu,power.draw,power.limit,fan.speed,clocks.current.graphics,clocks.current.memory,pcie.link.gen.current,pcie.link.width.current --format=csv,noheader,nounits`;
    
    // System metrics command
    const systemCmd = `echo "CPU:$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')" && echo "MEM_USED:$(free -m | awk '/Mem:/ {print $3}')" && echo "MEM_TOTAL:$(free -m | awk '/Mem:/ {print $2}')" && echo "UPTIME:$(uptime -p)"`;
    
    const [gpuOutput, systemOutput] = await Promise.all([
      executeCommandOnHost(host, nvidiaSmiCmd),
      executeCommandOnHost(host, systemCmd),
    ]);
    
    const gpus = parseNvidiaSmi(gpuOutput);
    const systemMetrics = parseSystemMetrics(systemOutput);
    
    const metrics: HostMetrics = {
      hostId: host.id,
      hostName: host.name,
      hostIp: host.ip,
      timestamp: Date.now(),
      connected: true,
      isLocal: host.isLocal,
      gpus,
      systemMetrics,
    };
    
    // Update cache
    metricsCache.set(host.id, { data: metrics, timestamp: Date.now() });
    
    // Store in database for history
    addToDbHistory(host.id, metrics);
    
    // Check alert thresholds
    checkAlertThresholds(host.id, host.name, metrics);
    
    return metrics;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[DCGM] Failed to fetch metrics from ${host.name}:`, errorMessage);
    
    // Return error state - no simulated data
    return {
      hostId: host.id,
      hostName: host.name,
      hostIp: host.ip,
      timestamp: Date.now(),
      connected: false,
      isLocal: host.isLocal,
      error: errorMessage,
      gpus: [],
      systemMetrics: {
        cpuUtilization: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        uptime: "unavailable",
      },
    };
  }
}

// Check if SSH credentials are configured
function hasCredentials(): boolean {
  const config = getSSHConfig();
  return !!(config.privateKey || config.password);
}

export const dcgmRouter = router({
  // Get list of available hosts
  getHosts: publicProcedure.query(() => {
    return DGX_HOSTS.map(host => ({
      id: host.id,
      name: host.name,
      ip: host.ip,
      localIp: host.ip,
      isLocal: host.isLocal,
    }));
  }),

  // Get metrics for a single host
  getMetrics: publicProcedure
    .input(z.object({
      hostId: z.string(),
    }))
    .query(async ({ input }) => {
      const host = DGX_HOSTS.find(h => h.id === input.hostId);
      if (!host) {
        throw new Error(`Host ${input.hostId} not found`);
      }
      
      // Local hosts don't need SSH credentials
      if (!host.isLocal && !hasCredentials()) {
        return {
          hostId: host.id,
          hostName: host.name,
          hostIp: host.ip,
          timestamp: Date.now(),
          connected: false,
          isLocal: host.isLocal,
          error: "SSH credentials not configured",
          gpus: [],
          systemMetrics: {
            cpuUtilization: 0,
            memoryUsed: 0,
            memoryTotal: 0,
            uptime: "unavailable",
          },
        };
      }
      
      return fetchHostMetrics(host);
    }),

  // Get metrics for all hosts
  getAllMetrics: publicProcedure.query(async () => {
    const credentialsAvailable = hasCredentials();
    
    // Fetch metrics for each host - local hosts don't need credentials
    const results = await Promise.all(
      DGX_HOSTS.map(async (host) => {
        // Local hosts can always be queried
        if (host.isLocal) {
          return fetchHostMetrics(host);
        }
        // Remote hosts need SSH credentials
        if (!credentialsAvailable) {
          return {
            hostId: host.id,
            hostName: host.name,
            hostIp: host.ip,
            timestamp: Date.now(),
            connected: false,
            isLocal: host.isLocal,
            error: "SSH credentials not configured",
            gpus: [],
            systemMetrics: {
              cpuUtilization: 0,
              memoryUsed: 0,
              memoryTotal: 0,
              uptime: "unavailable",
            },
          };
        }
        return fetchHostMetrics(host);
      })
    );
    
    return {
      hosts: results,
      timestamp: Date.now(),
      isLive: results.some(r => r.connected),
    };
  }),

  // Test connection (local or SSH)
  testConnection: publicProcedure
    .input(z.object({
      hostId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const host = DGX_HOSTS.find(h => h.id === input.hostId);
      if (!host) {
        throw new Error(`Host ${input.hostId} not found`);
      }
      
      try {
        const output = await executeCommandOnHost(host, "echo 'Connection successful' && hostname");
        return {
          success: true,
          message: output.trim(),
          hostId: host.id,
          hostName: host.name,
          isLocal: host.isLocal,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Connection failed",
          hostId: host.id,
          hostName: host.name,
          isLocal: host.isLocal,
        };
      }
    }),

  // Get metrics history for time-series charts (from database)
  getHistory: publicProcedure
    .input(z.object({
      hostId: z.string(),
      timeRange: z.enum(["1h", "6h", "24h"]).default("1h"),
    }))
    .query(async ({ input }) => {
      const host = DGX_HOSTS.find(h => h.id === input.hostId);
      if (!host) {
        throw new Error(`Host ${input.hostId} not found`);
      }
      
      const timeRangeMs = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
      }[input.timeRange];
      
      // Get history from database
      const dbHistory = await getGpuMetricsHistory(input.hostId, timeRangeMs);
      
      // Transform to expected format
      const points: MetricsHistoryPoint[] = dbHistory.map(h => ({
        timestamp: h.timestamp.getTime(),
        utilization: h.gpuUtilization,
        temperature: h.gpuTemperature,
        powerDraw: h.gpuPowerDraw,
        memoryUsed: h.gpuMemoryUsed,
        memoryTotal: h.gpuMemoryTotal,
      }));
      
      return {
        hostId: input.hostId,
        hostName: host.name,
        timeRange: input.timeRange,
        points,
        isLive: points.length > 0,
        dataPoints: points.length,
      };
    }),

  // Get DCGM-specific metrics (if dcgmi is available)
  getDcgmMetrics: publicProcedure
    .input(z.object({
      hostId: z.string(),
    }))
    .query(async ({ input }) => {
      const host = DGX_HOSTS.find(h => h.id === input.hostId);
      if (!host) {
        throw new Error(`Host ${input.hostId} not found`);
      }
      
      if (!hasCredentials()) {
        return {
          available: false,
          error: "SSH credentials not configured",
        };
      }
      
      try {
        // Check if dcgmi is available and get detailed metrics
        const dcgmiCmd = `dcgmi dmon -e 155,156,203,204,1001,1002,1003,1004,1005 -c 1 2>/dev/null || echo "DCGMI_NOT_AVAILABLE"`;
        const output = await executeSSHCommand(host.ip, dcgmiCmd, host.sshHost, host.sshPort);
        
        if (output.includes("DCGMI_NOT_AVAILABLE")) {
          return {
            available: false,
            error: "DCGM not installed on this host",
          };
        }
        
        return {
          available: true,
          rawOutput: output,
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          available: false,
          error: error instanceof Error ? error.message : "Failed to get DCGM metrics",
        };
      }
    }),
});
