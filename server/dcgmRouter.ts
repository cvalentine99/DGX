import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { Client } from "ssh2";

// DGX Spark host configuration
const DGX_HOSTS = [
  { id: "alpha", name: "DGX Spark Alpha", ip: "192.168.50.139" },
  { id: "beta", name: "DGX Spark Beta", ip: "192.168.50.110" },
];

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

// SSH configuration from environment
function getSSHConfig() {
  return {
    username: process.env.DGX_SSH_USERNAME || "ubuntu",
    password: process.env.DGX_SSH_PASSWORD,
    privateKey: process.env.DGX_SSH_PRIVATE_KEY,
  };
}

// Execute SSH command on a host
async function executeSSHCommand(hostIp: string, command: string): Promise<string> {
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
      host: hostIp,
      port: 22,
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

// Parse nvidia-smi output for GPU metrics
function parseNvidiaSmiOutput(output: string): GpuMetrics[] {
  const gpus: GpuMetrics[] = [];
  
  // nvidia-smi --query-gpu format output
  const lines = output.trim().split("\n").filter(line => line.trim());
  
  for (const line of lines) {
    const parts = line.split(", ").map(p => p.trim());
    if (parts.length >= 14) {
      gpus.push({
        index: parseInt(parts[0]) || 0,
        name: parts[1] || "Unknown GPU",
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

// Parse system metrics from various commands
function parseSystemMetrics(output: string): { cpuUtilization: number; memoryUsed: number; memoryTotal: number; uptime: string } {
  const lines = output.trim().split("\n");
  let cpuUtilization = 0;
  let memoryUsed = 0;
  let memoryTotal = 0;
  let uptime = "Unknown";
  
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

// Fetch metrics from a single host
async function fetchHostMetrics(hostId: string, hostName: string, hostIp: string): Promise<HostMetrics> {
  // Check cache first
  const cached = metricsCache.get(hostId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    // nvidia-smi query for GPU metrics
    const nvidiaSmiCommand = `nvidia-smi --query-gpu=index,name,uuid,utilization.gpu,memory.used,memory.total,utilization.memory,temperature.gpu,power.draw,power.limit,fan.speed,clocks.current.graphics,clocks.current.memory,pcie.link.gen.current,pcie.link.width.current --format=csv,noheader,nounits 2>/dev/null || echo "0, NVIDIA Grace Hopper, GPU-0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0"`;
    
    // System metrics command
    const systemCommand = `echo "CPU:$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo 0)" && echo "MEM_USED:$(free -m | awk '/Mem:/ {print $3}' 2>/dev/null || echo 0)" && echo "MEM_TOTAL:$(free -m | awk '/Mem:/ {print $2}' 2>/dev/null || echo 0)" && echo "UPTIME:$(uptime -p 2>/dev/null || echo 'unknown')"`;
    
    // Execute commands
    const [gpuOutput, systemOutput] = await Promise.all([
      executeSSHCommand(hostIp, nvidiaSmiCommand),
      executeSSHCommand(hostIp, systemCommand),
    ]);
    
    const gpus = parseNvidiaSmiOutput(gpuOutput);
    const systemMetrics = parseSystemMetrics(systemOutput);
    
    const metrics: HostMetrics = {
      hostId,
      hostName,
      hostIp,
      timestamp: Date.now(),
      connected: true,
      gpus: gpus.length > 0 ? gpus : [{
        index: 0,
        name: "NVIDIA Grace Hopper",
        uuid: "GPU-" + hostId,
        utilization: 0,
        memoryUsed: 0,
        memoryTotal: 98304, // 96GB
        memoryUtilization: 0,
        temperature: 0,
        powerDraw: 0,
        powerLimit: 500,
        fanSpeed: 0,
        clockGraphics: 0,
        clockMemory: 0,
        pcieGen: 5,
        pcieLinkWidth: 16,
      }],
      systemMetrics,
    };
    
    // Update cache
    metricsCache.set(hostId, { data: metrics, timestamp: Date.now() });
    
    return metrics;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Connection failed";
    
    // Return cached data if available, otherwise return error state
    if (cached) {
      return {
        ...cached.data,
        connected: false,
        error: errorMessage,
      };
    }
    
    return {
      hostId,
      hostName,
      hostIp,
      timestamp: Date.now(),
      connected: false,
      error: errorMessage,
      gpus: [],
      systemMetrics: {
        cpuUtilization: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        uptime: "Unknown",
      },
    };
  }
}

// Generate simulated metrics for demo/fallback
function generateSimulatedMetrics(hostId: string, hostName: string, hostIp: string): HostMetrics {
  const baseUtil = hostId === "alpha" ? 78 : 65;
  const baseTemp = hostId === "alpha" ? 62 : 58;
  const basePower = hostId === "alpha" ? 285 : 245;
  const baseMemUsed = hostId === "alpha" ? 45.2 : 38.7;
  
  // Add some variance for realism
  const variance = () => (Math.random() - 0.5) * 4;
  
  return {
    hostId,
    hostName,
    hostIp,
    timestamp: Date.now(),
    connected: true,
    gpus: [{
      index: 0,
      name: "NVIDIA Grace Hopper",
      uuid: `GPU-${hostId}-0`,
      utilization: Math.round(baseUtil + variance()),
      memoryUsed: Math.round((baseMemUsed + variance() * 0.5) * 1024),
      memoryTotal: 98304, // 96GB
      memoryUtilization: Math.round((baseMemUsed / 96) * 100),
      temperature: Math.round(baseTemp + variance()),
      powerDraw: Math.round(basePower + variance() * 5),
      powerLimit: 500,
      fanSpeed: Math.round(35 + variance()),
      clockGraphics: 1980,
      clockMemory: 2619,
      pcieGen: 5,
      pcieLinkWidth: 16,
    }],
    systemMetrics: {
      cpuUtilization: Math.round((hostId === "alpha" ? 34 : 28) + variance()),
      memoryUsed: Math.round((hostId === "alpha" ? 89.4 : 76.2) * 1024),
      memoryTotal: 512 * 1024, // 512GB
      uptime: "14d 7h 23m",
    },
  };
}

export const dcgmRouter = router({
  // Get list of available hosts
  getHosts: publicProcedure.query(() => {
    return DGX_HOSTS.map(host => ({
      id: host.id,
      name: host.name,
      ip: host.ip,
    }));
  }),

  // Get metrics for a single host
  getHostMetrics: publicProcedure
    .input(z.object({
      hostId: z.string(),
      forceRefresh: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      const host = DGX_HOSTS.find(h => h.id === input.hostId);
      if (!host) {
        throw new Error(`Host ${input.hostId} not found`);
      }
      
      // Clear cache if force refresh
      if (input.forceRefresh) {
        metricsCache.delete(input.hostId);
      }
      
      // Try to get real metrics, fall back to simulated
      try {
        const config = getSSHConfig();
        if (config.password || config.privateKey) {
          return await fetchHostMetrics(host.id, host.name, host.ip);
        }
      } catch {
        // Fall through to simulated
      }
      
      // Return simulated metrics
      return generateSimulatedMetrics(host.id, host.name, host.ip);
    }),

  // Get metrics for all hosts
  getAllMetrics: publicProcedure
    .input(z.object({
      forceRefresh: z.boolean().optional().default(false),
    }).optional())
    .query(async ({ input }) => {
      const forceRefresh = input?.forceRefresh ?? false;
      
      // Clear all caches if force refresh
      if (forceRefresh) {
        metricsCache.clear();
      }
      
      const config = getSSHConfig();
      const hasCredentials = !!(config.password || config.privateKey);
      
      const results = await Promise.all(
        DGX_HOSTS.map(async (host) => {
          try {
            if (hasCredentials) {
              return await fetchHostMetrics(host.id, host.name, host.ip);
            }
          } catch {
            // Fall through to simulated
          }
          return generateSimulatedMetrics(host.id, host.name, host.ip);
        })
      );
      
      return {
        hosts: results,
        timestamp: Date.now(),
        isSimulated: !hasCredentials,
      };
    }),

  // Test SSH connection to a host
  testConnection: publicProcedure
    .input(z.object({
      hostId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const host = DGX_HOSTS.find(h => h.id === input.hostId);
      if (!host) {
        return { success: false, error: `Host ${input.hostId} not found` };
      }
      
      try {
        const output = await executeSSHCommand(host.ip, "echo 'Connection successful' && nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1");
        return {
          success: true,
          message: output.trim(),
          gpuDetected: output.includes("NVIDIA") || output.includes("Grace"),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Connection failed",
        };
      }
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
      
      try {
        // Try to get DCGM metrics
        const output = await executeSSHCommand(host.ip, "dcgmi dmon -e 155,156,203,204,1001,1002,1003,1004 -c 1 2>/dev/null || echo 'DCGM not available'");
        
        if (output.includes("DCGM not available")) {
          return {
            available: false,
            message: "DCGM is not installed or not running on this host",
          };
        }
        
        return {
          available: true,
          rawOutput: output,
        };
      } catch (error) {
        return {
          available: false,
          error: error instanceof Error ? error.message : "Failed to fetch DCGM metrics",
        };
      }
    }),
});
