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

// Track active pull operations
const activePulls = new Map<string, {
  status: "connecting" | "pulling" | "completed" | "failed";
  progress: string[];
  startTime: number;
  endTime?: number;
  error?: string;
  imageTag: string;
  hostId: string;
}>();

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
      
      // Initialize pull tracking
      activePulls.set(pullId, {
        status: "connecting",
        progress: [],
        startTime: Date.now(),
        imageTag: input.imageTag,
        hostId: input.hostId,
      });

      // Start the pull operation asynchronously
      (async () => {
        const pull = activePulls.get(pullId)!;
        
        try {
          pull.progress.push(`Connecting to ${DGX_HOSTS[input.hostId as HostId].name}...`);
          const conn = await createSSHConnection(input.hostId);
          
          // Login to NGC registry if pulling from nvcr.io
          if (input.imageTag.startsWith("nvcr.io")) {
            const ngcApiKey = process.env.NGC_API_KEY;
            if (ngcApiKey) {
              pull.progress.push("Authenticating with NGC registry...");
              const loginResult = await executeSSHCommand(
                conn,
                `echo "${ngcApiKey}" | docker login nvcr.io -u '$oauthtoken' --password-stdin 2>&1`
              );
              if (loginResult.code === 0) {
                pull.progress.push("NGC authentication successful");
              } else {
                pull.progress.push(`NGC login warning: ${loginResult.stdout || loginResult.stderr}`);
              }
            } else {
              pull.progress.push("Warning: NGC_API_KEY not configured, attempting anonymous pull");
            }
          }
          
          pull.status = "pulling";
          pull.progress.push(`Starting docker pull ${input.imageTag}...`);
          pull.progress.push("This may take several minutes for large images.");

          // Execute docker pull command
          const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
            conn.exec(`docker pull ${input.imageTag} 2>&1`, (err, stream) => {
              if (err) {
                reject(err);
                return;
              }

              let output = "";

              stream.on("close", (code: number) => {
                resolve({ stdout: output, stderr: "", code: code || 0 });
              });

              stream.on("data", (data: Buffer) => {
                const lines = data.toString().split("\n").filter(Boolean);
                lines.forEach((line) => {
                  output += line + "\n";
                  // Add progress updates
                  if (line.includes("Pulling") || line.includes("Download") || 
                      line.includes("Extract") || line.includes("Pull complete") ||
                      line.includes("Digest") || line.includes("Status")) {
                    pull.progress.push(line.trim());
                  }
                });
              });
            });
          });

          conn.end();

          if (result.code === 0) {
            pull.status = "completed";
            pull.progress.push(`Successfully pulled ${input.imageTag}`);
          } else {
            pull.status = "failed";
            pull.error = result.stdout || "Pull failed with unknown error";
            pull.progress.push(`Error: ${pull.error}`);
          }
        } catch (error: any) {
          pull.status = "failed";
          pull.error = error.message;
          pull.progress.push(`Error: ${error.message}`);
        }

        pull.endTime = Date.now();
      })();

      return { pullId, host: DGX_HOSTS[input.hostId as HostId] };
    }),

  // Get pull operation status
  getPullStatus: publicProcedure
    .input(z.object({
      pullId: z.string(),
    }))
    .query(({ input }: { input: { pullId: string } }) => {
      const pull = activePulls.get(input.pullId);
      
      if (!pull) {
        return { found: false };
      }

      return {
        found: true,
        status: pull.status,
        progress: pull.progress,
        startTime: pull.startTime,
        endTime: pull.endTime,
        error: pull.error,
        imageTag: pull.imageTag,
        hostId: pull.hostId,
        duration: pull.endTime 
          ? pull.endTime - pull.startTime 
          : Date.now() - pull.startTime,
      };
    }),

  // Get all active/recent pulls
  getActivePulls: publicProcedure.query(() => {
    const pulls: Array<{
      pullId: string;
      status: string;
      imageTag: string;
      hostId: string;
      startTime: number;
      duration: number;
    }> = [];

    activePulls.forEach((pull, pullId) => {
      pulls.push({
        pullId,
        status: pull.status,
        imageTag: pull.imageTag,
        hostId: pull.hostId,
        startTime: pull.startTime,
        duration: pull.endTime 
          ? pull.endTime - pull.startTime 
          : Date.now() - pull.startTime,
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
});
