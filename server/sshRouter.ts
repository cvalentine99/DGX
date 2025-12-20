import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { Client } from "ssh2";

// DGX Spark host configurations
const DGX_HOSTS = {
  alpha: {
    name: "DGX Spark Alpha",
    host: "192.168.50.139",
    port: 22,
  },
  beta: {
    name: "DGX Spark Beta",
    host: "192.168.50.110",
    port: 22,
  },
} as const;

type HostId = keyof typeof DGX_HOSTS;

// Progress tracking types
interface LayerProgress {
  id: string;
  status: "waiting" | "downloading" | "extracting" | "complete" | "exists";
  current: number;
  total: number;
  speed?: string;
}

interface PullProgress {
  status: "connecting" | "authenticating" | "pulling" | "extracting" | "completed" | "failed" | "cancelled";
  phase: string;
  overallPercent: number;
  layers: Map<string, LayerProgress>;
  currentLayer?: string;
  downloadSpeed: string;
  downloadedSize: string;
  totalSize: string;
  eta: string;
  logs: string[];
  startTime: number;
  endTime?: number;
  error?: string;
  imageTag: string;
  hostId: string;
}

// Get SSH credentials from environment
function getSSHCredentials() {
  const username = process.env.DGX_SSH_USERNAME;
  const password = process.env.DGX_SSH_PASSWORD;
  const privateKey = process.env.DGX_SSH_PRIVATE_KEY;

  if (!username) {
    throw new Error("DGX_SSH_USERNAME not configured");
  }

  return { username, password, privateKey };
}

// Create SSH connection to a host
function createSSHConnection(hostId: HostId): Promise<Client> {
  return new Promise((resolve, reject) => {
    const host = DGX_HOSTS[hostId];
    const credentials = getSSHCredentials();
    const conn = new Client();

    conn.on("ready", () => {
      resolve(conn);
    });

    conn.on("error", (err) => {
      reject(new Error(`SSH connection failed to ${host.name}: ${err.message}`));
    });

    const config: any = {
      host: host.host,
      port: host.port,
      username: credentials.username,
      readyTimeout: 10000,
    };

    // Use private key if available, otherwise use password
    if (credentials.privateKey) {
      config.privateKey = credentials.privateKey;
    } else if (credentials.password) {
      config.password = credentials.password;
    } else {
      reject(new Error("No SSH authentication method configured"));
      return;
    }

    conn.connect(config);
  });
}

// Execute command via SSH and return output
function executeSSHCommand(conn: Client, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = "";
      let stderr = "";

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

// Parse docker pull progress line
function parseDockerProgress(line: string, progress: PullProgress): void {
  // Match layer progress: "abc123: Downloading [====>     ] 45.2MB/100MB"
  const downloadMatch = line.match(/^([a-f0-9]+):\s*(Downloading|Extracting|Pull complete|Already exists|Waiting|Verifying Checksum|Download complete)\s*(?:\[([=>\s]+)\]\s*)?(?:(\d+(?:\.\d+)?[KMGT]?B?)\/(\d+(?:\.\d+)?[KMGT]?B?))?/i);
  
  if (downloadMatch) {
    const [, layerId, status, , current, total] = downloadMatch;
    
    let layerStatus: LayerProgress["status"] = "waiting";
    if (status.toLowerCase().includes("downloading")) layerStatus = "downloading";
    else if (status.toLowerCase().includes("extracting")) layerStatus = "extracting";
    else if (status.toLowerCase().includes("complete")) layerStatus = "complete";
    else if (status.toLowerCase().includes("exists")) layerStatus = "exists";
    
    const layer = progress.layers.get(layerId) || {
      id: layerId,
      status: "waiting",
      current: 0,
      total: 0,
    };
    
    layer.status = layerStatus;
    if (current) layer.current = parseSize(current);
    if (total) layer.total = parseSize(total);
    
    progress.layers.set(layerId, layer);
    progress.currentLayer = layerId;
    
    // Calculate overall progress
    calculateOverallProgress(progress);
    return;
  }
  
  // Match digest line
  if (line.includes("Digest:")) {
    progress.phase = "Verifying digest";
    progress.logs.push(line.trim());
    return;
  }
  
  // Match status line
  if (line.includes("Status:")) {
    progress.logs.push(line.trim());
    if (line.includes("Downloaded newer image") || line.includes("Image is up to date")) {
      progress.status = "completed";
      progress.overallPercent = 100;
      progress.phase = "Complete";
    }
    return;
  }
  
  // Match pulling from line
  if (line.includes("Pulling from")) {
    progress.phase = "Pulling layers";
    progress.logs.push(line.trim());
    return;
  }
  
  // Generic log
  if (line.trim() && !line.includes("\r")) {
    progress.logs.push(line.trim());
  }
}

// Parse size string to bytes
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B?)?$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();
  
  const multipliers: Record<string, number> = {
    "B": 1,
    "KB": 1024,
    "MB": 1024 * 1024,
    "GB": 1024 * 1024 * 1024,
    "TB": 1024 * 1024 * 1024 * 1024,
    "K": 1024,
    "M": 1024 * 1024,
    "G": 1024 * 1024 * 1024,
    "T": 1024 * 1024 * 1024 * 1024,
  };
  
  return value * (multipliers[unit] || 1);
}

// Format bytes to human readable
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// Calculate overall progress from layers
function calculateOverallProgress(progress: PullProgress): void {
  let totalBytes = 0;
  let downloadedBytes = 0;
  let downloadingLayers = 0;
  let completedLayers = 0;
  
  progress.layers.forEach((layer) => {
    if (layer.total > 0) {
      totalBytes += layer.total;
      downloadedBytes += layer.current;
    }
    if (layer.status === "downloading" || layer.status === "extracting") {
      downloadingLayers++;
    }
    if (layer.status === "complete" || layer.status === "exists") {
      completedLayers++;
    }
  });
  
  // Calculate percentage
  if (totalBytes > 0) {
    progress.overallPercent = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
  } else if (progress.layers.size > 0) {
    progress.overallPercent = Math.min(99, Math.round((completedLayers / progress.layers.size) * 100));
  }
  
  // Update phase
  if (downloadingLayers > 0) {
    progress.status = "pulling";
    progress.phase = `Downloading ${downloadingLayers} layer${downloadingLayers > 1 ? "s" : ""}`;
  } else if (progress.layers.size > 0 && completedLayers === progress.layers.size) {
    progress.phase = "Finalizing";
  }
  
  // Update sizes
  progress.downloadedSize = formatSize(downloadedBytes);
  progress.totalSize = formatSize(totalBytes);
  
  // Calculate speed and ETA
  const elapsed = (Date.now() - progress.startTime) / 1000;
  if (elapsed > 0 && downloadedBytes > 0) {
    const speed = downloadedBytes / elapsed;
    progress.downloadSpeed = `${formatSize(speed)}/s`;
    
    if (totalBytes > downloadedBytes) {
      const remaining = totalBytes - downloadedBytes;
      const etaSeconds = remaining / speed;
      if (etaSeconds < 60) {
        progress.eta = `${Math.round(etaSeconds)}s`;
      } else if (etaSeconds < 3600) {
        progress.eta = `${Math.round(etaSeconds / 60)}m`;
      } else {
        progress.eta = `${Math.round(etaSeconds / 3600)}h ${Math.round((etaSeconds % 3600) / 60)}m`;
      }
    }
  }
}

// Track active pull operations
const activePulls = new Map<string, PullProgress>();

// Track active SSH connections for cancellation
const activeConnections = new Map<string, Client>();

export const sshRouter = router({
  // Test SSH connection to a host
  testConnection: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
    }))
    .mutation(async ({ input }: { input: { hostId: HostId } }) => {
      try {
        const conn = await createSSHConnection(input.hostId);
        const result = await executeSSHCommand(conn, "hostname && docker --version");
        conn.end();

        return {
          success: true,
          hostname: result.stdout.split("\n")[0],
          dockerVersion: result.stdout.split("\n")[1] || "Docker installed",
          host: DGX_HOSTS[input.hostId as HostId],
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          host: DGX_HOSTS[input.hostId as HostId],
        };
      }
    }),

  // Get list of images on a host
  listImages: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
    }))
    .query(async ({ input }: { input: { hostId: HostId } }) => {
      try {
        const conn = await createSSHConnection(input.hostId);
        const result = await executeSSHCommand(
          conn,
          'docker images --format "{{.Repository}}:{{.Tag}}|{{.Size}}|{{.CreatedAt}}" | head -50'
        );
        conn.end();

        const images = result.stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [fullTag, size, createdAt] = line.split("|");
            const [repository, tag] = fullTag.split(":");
            return { repository, tag: tag || "latest", size, createdAt, fullTag };
          });

        return { success: true, images };
      } catch (error: any) {
        return { success: false, error: error.message, images: [] };
      }
    }),

  // Start pulling a container image
  pullImage: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      imageTag: z.string(),
    }))
    .mutation(async ({ input }: { input: { hostId: HostId; imageTag: string } }) => {
      const pullId = `${input.hostId}-${Date.now()}`;
      
      // Initialize pull tracking with enhanced progress
      const progress: PullProgress = {
        status: "connecting",
        phase: "Initializing",
        overallPercent: 0,
        layers: new Map(),
        downloadSpeed: "0 B/s",
        downloadedSize: "0 B",
        totalSize: "0 B",
        eta: "calculating...",
        logs: [],
        startTime: Date.now(),
        imageTag: input.imageTag,
        hostId: input.hostId,
      };
      
      activePulls.set(pullId, progress);

      // Start the pull operation asynchronously
      (async () => {
        try {
          progress.logs.push(`Connecting to ${DGX_HOSTS[input.hostId as HostId].name}...`);
          progress.phase = "Connecting";
          
          const conn = await createSSHConnection(input.hostId);
          activeConnections.set(pullId, conn);
          
          progress.logs.push(`Connected to ${DGX_HOSTS[input.hostId as HostId].host}`);
          
          // Login to NGC registry if pulling from nvcr.io
          if (input.imageTag.startsWith("nvcr.io")) {
            progress.status = "authenticating";
            progress.phase = "Authenticating with NGC";
            
            const ngcApiKey = process.env.NGC_API_KEY;
            if (ngcApiKey) {
              progress.logs.push("Authenticating with NGC registry...");
              const loginResult = await executeSSHCommand(
                conn,
                `echo "${ngcApiKey}" | docker login nvcr.io -u '$oauthtoken' --password-stdin 2>&1`
              );
              if (loginResult.code === 0) {
                progress.logs.push("✓ NGC authentication successful");
              } else {
                progress.logs.push(`⚠ NGC login warning: ${loginResult.stdout || loginResult.stderr}`);
              }
            } else {
              progress.logs.push("⚠ NGC_API_KEY not configured, attempting anonymous pull");
            }
          }
          
          progress.status = "pulling";
          progress.phase = "Starting pull";
          progress.logs.push(`Pulling ${input.imageTag}...`);

          // Execute docker pull command with progress
          await new Promise<void>((resolve, reject) => {
            conn.exec(`docker pull ${input.imageTag} 2>&1`, (err, stream) => {
              if (err) {
                reject(err);
                return;
              }

              stream.on("close", (code: number) => {
                if (code === 0) {
                  progress.status = "completed";
                  progress.phase = "Complete";
                  progress.overallPercent = 100;
                  progress.logs.push(`✓ Successfully pulled ${input.imageTag}`);
                } else {
                  progress.status = "failed";
                  progress.phase = "Failed";
                  progress.error = `Pull failed with exit code ${code}`;
                  progress.logs.push(`✗ ${progress.error}`);
                }
                resolve();
              });

              stream.on("data", (data: Buffer) => {
                const lines = data.toString().split(/[\r\n]+/).filter(Boolean);
                lines.forEach((line) => {
                  parseDockerProgress(line, progress);
                });
              });
            });
          });

          conn.end();
          activeConnections.delete(pullId);
          
        } catch (error: any) {
          progress.status = "failed";
          progress.phase = "Error";
          progress.error = error.message;
          progress.logs.push(`✗ Error: ${error.message}`);
          
          const conn = activeConnections.get(pullId);
          if (conn) {
            conn.end();
            activeConnections.delete(pullId);
          }
        }

        progress.endTime = Date.now();
      })();

      return { pullId, host: DGX_HOSTS[input.hostId as HostId] };
    }),

  // Cancel a pull operation
  cancelPull: publicProcedure
    .input(z.object({
      pullId: z.string(),
    }))
    .mutation(({ input }: { input: { pullId: string } }) => {
      const progress = activePulls.get(input.pullId);
      const conn = activeConnections.get(input.pullId);
      
      if (progress && (progress.status === "pulling" || progress.status === "connecting" || progress.status === "authenticating")) {
        progress.status = "cancelled";
        progress.phase = "Cancelled";
        progress.logs.push("⚠ Pull cancelled by user");
        progress.endTime = Date.now();
        
        if (conn) {
          conn.end();
          activeConnections.delete(input.pullId);
        }
        
        return { success: true, message: "Pull cancelled" };
      }
      
      return { success: false, message: "Pull not found or already completed" };
    }),

  // Get pull operation status with detailed progress
  getPullStatus: publicProcedure
    .input(z.object({
      pullId: z.string(),
    }))
    .query(({ input }: { input: { pullId: string } }) => {
      const progress = activePulls.get(input.pullId);
      
      if (!progress) {
        return { found: false };
      }

      // Convert layers Map to array for serialization
      const layers: LayerProgress[] = [];
      progress.layers.forEach((layer) => {
        layers.push(layer);
      });

      return {
        found: true,
        status: progress.status,
        phase: progress.phase,
        overallPercent: progress.overallPercent,
        layers,
        currentLayer: progress.currentLayer,
        downloadSpeed: progress.downloadSpeed,
        downloadedSize: progress.downloadedSize,
        totalSize: progress.totalSize,
        eta: progress.eta,
        logs: progress.logs.slice(-50), // Last 50 log entries
        startTime: progress.startTime,
        endTime: progress.endTime,
        error: progress.error,
        imageTag: progress.imageTag,
        hostId: progress.hostId,
        duration: progress.endTime 
          ? progress.endTime - progress.startTime 
          : Date.now() - progress.startTime,
      };
    }),

  // Get all active/recent pulls
  getActivePulls: publicProcedure.query(() => {
    const pulls: Array<{
      pullId: string;
      status: string;
      phase: string;
      overallPercent: number;
      imageTag: string;
      hostId: string;
      startTime: number;
      duration: number;
    }> = [];

    activePulls.forEach((progress, pullId) => {
      pulls.push({
        pullId,
        status: progress.status,
        phase: progress.phase,
        overallPercent: progress.overallPercent,
        imageTag: progress.imageTag,
        hostId: progress.hostId,
        startTime: progress.startTime,
        duration: progress.endTime 
          ? progress.endTime - progress.startTime 
          : Date.now() - progress.startTime,
      });
    });

    // Return most recent first
    return pulls.sort((a, b) => b.startTime - a.startTime).slice(0, 10);
  }),

  // Get host info
  getHosts: publicProcedure.query(() => {
    return Object.entries(DGX_HOSTS).map(([id, host]) => ({
      id,
      ...host,
    }));
  }),
  
  // Download HuggingFace model
  downloadHFModel: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      modelId: z.string(),
      localDir: z.string().optional(),
    }))
    .mutation(async ({ input }: { input: { hostId: HostId; modelId: string; localDir?: string } }) => {
      const pullId = `hf-${input.hostId}-${Date.now()}`;
      
      const progress: PullProgress = {
        status: "connecting",
        phase: "Initializing",
        overallPercent: 0,
        layers: new Map(),
        downloadSpeed: "0 B/s",
        downloadedSize: "0 B",
        totalSize: "0 B",
        eta: "calculating...",
        logs: [],
        startTime: Date.now(),
        imageTag: input.modelId,
        hostId: input.hostId,
      };
      
      activePulls.set(pullId, progress);

      (async () => {
        try {
          progress.logs.push(`Connecting to ${DGX_HOSTS[input.hostId as HostId].name}...`);
          progress.phase = "Connecting";
          
          const conn = await createSSHConnection(input.hostId);
          activeConnections.set(pullId, conn);
          
          progress.logs.push(`Connected to ${DGX_HOSTS[input.hostId as HostId].host}`);
          
          // Set up HuggingFace token
          const hfToken = process.env.HUGGINGFACE_TOKEN;
          if (hfToken) {
            progress.status = "authenticating";
            progress.phase = "Authenticating with HuggingFace";
            progress.logs.push("Setting up HuggingFace authentication...");
            
            await executeSSHCommand(conn, `export HF_TOKEN="${hfToken}"`);
            progress.logs.push("✓ HuggingFace token configured");
          }
          
          progress.status = "pulling";
          progress.phase = "Downloading model";
          
          const localDir = input.localDir || `/models/${input.modelId.replace("/", "_")}`;
          progress.logs.push(`Downloading to ${localDir}...`);
          
          // Use huggingface-cli to download
          const downloadCmd = hfToken 
            ? `HF_TOKEN="${hfToken}" huggingface-cli download ${input.modelId} --local-dir ${localDir} 2>&1`
            : `huggingface-cli download ${input.modelId} --local-dir ${localDir} 2>&1`;
          
          await new Promise<void>((resolve, reject) => {
            conn.exec(downloadCmd, (err, stream) => {
              if (err) {
                reject(err);
                return;
              }

              let lastPercent = 0;

              stream.on("close", (code: number) => {
                if (code === 0) {
                  progress.status = "completed";
                  progress.phase = "Complete";
                  progress.overallPercent = 100;
                  progress.logs.push(`✓ Successfully downloaded ${input.modelId}`);
                } else {
                  progress.status = "failed";
                  progress.phase = "Failed";
                  progress.error = `Download failed with exit code ${code}`;
                  progress.logs.push(`✗ ${progress.error}`);
                }
                resolve();
              });

              stream.on("data", (data: Buffer) => {
                const output = data.toString();
                
                // Parse progress percentage from huggingface-cli output
                const percentMatch = output.match(/(\d+)%/);
                if (percentMatch) {
                  const percent = parseInt(percentMatch[1]);
                  if (percent > lastPercent) {
                    lastPercent = percent;
                    progress.overallPercent = percent;
                  }
                }
                
                // Parse speed
                const speedMatch = output.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)\/s/i);
                if (speedMatch) {
                  progress.downloadSpeed = `${speedMatch[1]} ${speedMatch[2]}/s`;
                }
                
                // Parse downloaded/total
                const sizeMatch = output.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)\s*\/\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)/i);
                if (sizeMatch) {
                  progress.downloadedSize = `${sizeMatch[1]} ${sizeMatch[2]}`;
                  progress.totalSize = `${sizeMatch[3]} ${sizeMatch[4]}`;
                }
                
                // Log file downloads
                const fileMatch = output.match(/Downloading\s+(.+?):/);
                if (fileMatch) {
                  progress.logs.push(`Downloading: ${fileMatch[1]}`);
                }
              });
            });
          });

          conn.end();
          activeConnections.delete(pullId);
          
        } catch (error: any) {
          progress.status = "failed";
          progress.phase = "Error";
          progress.error = error.message;
          progress.logs.push(`✗ Error: ${error.message}`);
          
          const conn = activeConnections.get(pullId);
          if (conn) {
            conn.end();
            activeConnections.delete(pullId);
          }
        }

        progress.endTime = Date.now();
      })();

      return { pullId, host: DGX_HOSTS[input.hostId as HostId] };
    }),

  // Remove a container image from a host
  removeImage: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      imageTag: z.string(),
    }))
    .mutation(async ({ input }: { input: { hostId: HostId; imageTag: string } }) => {
      try {
        const conn = await createSSHConnection(input.hostId);
        
        // First check if image exists
        const checkResult = await executeSSHCommand(
          conn,
          `docker images -q "${input.imageTag}"`
        );
        
        if (!checkResult.stdout.trim()) {
          conn.end();
          return { success: false, error: "Image not found on host" };
        }
        
        // Remove the image (force to remove even if tagged multiple times)
        const result = await executeSSHCommand(
          conn,
          `docker rmi -f "${input.imageTag}" 2>&1`
        );
        conn.end();
        
        if (result.code === 0) {
          return { 
            success: true, 
            message: `Successfully removed ${input.imageTag}`,
            host: DGX_HOSTS[input.hostId],
          };
        } else {
          // Check if it's in use by a container
          if (result.stdout.includes("image is being used") || result.stderr.includes("image is being used")) {
            return { 
              success: false, 
              error: "Cannot remove: image is being used by a running container",
              host: DGX_HOSTS[input.hostId],
            };
          }
          return { 
            success: false, 
            error: result.stderr || result.stdout || "Failed to remove image",
            host: DGX_HOSTS[input.hostId],
          };
        }
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message,
          host: DGX_HOSTS[input.hostId],
        };
      }
    }),

  // Update (pull latest) a container image on a host
  updateImage: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      imageTag: z.string(),
    }))
    .mutation(async ({ input }: { input: { hostId: HostId; imageTag: string } }) => {
      const pullId = `update-${input.hostId}-${Date.now()}`;
      
      // Initialize pull tracking
      const progress: PullProgress = {
        status: "connecting",
        phase: "Initializing update",
        overallPercent: 0,
        layers: new Map(),
        downloadSpeed: "0 B/s",
        downloadedSize: "0 B",
        totalSize: "0 B",
        eta: "calculating...",
        logs: [],
        startTime: Date.now(),
        imageTag: input.imageTag,
        hostId: input.hostId,
      };
      
      activePulls.set(pullId, progress);
      
      // Start async pull operation
      (async () => {
        try {
          const conn = await createSSHConnection(input.hostId);
          activeConnections.set(pullId, conn);
          
          progress.status = "authenticating";
          progress.phase = "Authenticating with NGC";
          progress.logs.push(`Updating ${input.imageTag} on ${DGX_HOSTS[input.hostId as HostId].name}`);
          
          // NGC login if pulling from nvcr.io
          if (input.imageTag.startsWith("nvcr.io")) {
            const ngcKey = process.env.NGC_API_KEY;
            if (ngcKey) {
              await executeSSHCommand(
                conn,
                `echo "${ngcKey}" | docker login nvcr.io -u '$oauthtoken' --password-stdin 2>&1`
              );
              progress.logs.push("✓ NGC authentication successful");
            }
          }
          
          progress.status = "pulling";
          progress.phase = "Pulling latest version";
          
          // Pull with --pull=always to force update
          await new Promise<void>((resolve) => {
            conn.exec(`docker pull "${input.imageTag}" 2>&1`, (err, stream) => {
              if (err) {
                progress.status = "failed";
                progress.error = err.message;
                resolve();
                return;
              }
              
              stream.on("close", (code: number) => {
                if (code === 0) {
                  progress.status = "completed";
                  progress.phase = "Update complete";
                  progress.overallPercent = 100;
                  progress.logs.push(`✓ Successfully updated ${input.imageTag}`);
                } else {
                  progress.status = "failed";
                  progress.error = "Update failed";
                }
                resolve();
              });
              
              stream.on("data", (data: Buffer) => {
                const line = data.toString();
                parseDockerProgress(line, progress);
              });
            });
          });
          
          conn.end();
          activeConnections.delete(pullId);
          
        } catch (error: any) {
          progress.status = "failed";
          progress.error = error.message;
          progress.logs.push(`✗ Error: ${error.message}`);
        }
        
        progress.endTime = Date.now();
      })();
      
      return { pullId, host: DGX_HOSTS[input.hostId as HostId] };
    }),
});
