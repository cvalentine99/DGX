import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getSSHPool } from "./sshConnectionPool";

// Deployment step status
type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface DeploymentStep {
  id: string;
  name: string;
  status: StepStatus;
  logs: string[];
  startTime?: number;
  endTime?: number;
  error?: string;
}

// Active deployments tracking
interface ActiveDeployment {
  id: string;
  hostId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  steps: DeploymentStep[];
  startTime: number;
  endTime?: number;
  cancelled: boolean;
}

const activeDeployments = new Map<string, ActiveDeployment>();

// Generate unique deployment ID
function generateDeploymentId(): string {
  return `deploy-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export const deploymentRouter = router({
  // Test SSH connection to target host
  testConnection: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
    }))
    .mutation(async ({ input }) => {
      const pool = getSSHPool();
      
      try {
        const startTime = Date.now();
        const result = await pool.execute(
          input.hostId,
          'echo "Connection successful: $(hostname) - $(date)"'
        );
        const duration = Date.now() - startTime;
        
        return {
          success: true,
          message: result.trim(),
          latencyMs: duration,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Check GPU availability on target host
  checkGPU: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
    }))
    .mutation(async ({ input }) => {
      const pool = getSSHPool();
      
      try {
        // Check nvidia-smi
        const gpuInfo = await pool.execute(
          input.hostId,
          'nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>/dev/null || echo "NO_GPU"'
        );
        
        if (gpuInfo.trim() === "NO_GPU" || gpuInfo.includes("command not found")) {
          return {
            success: true,
            available: false,
            message: "No NVIDIA GPU detected or nvidia-smi not installed",
          };
        }
        
        const gpus = gpuInfo.trim().split("\n").map(line => {
          const [name, memory, driver] = line.split(", ");
          return { name: name?.trim(), memory: memory?.trim(), driver: driver?.trim() };
        });
        
        return {
          success: true,
          available: true,
          gpuCount: gpus.length,
          gpus,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Check disk space on target host
  checkDiskSpace: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      path: z.string().default("/home"),
      requiredGB: z.number().default(10),
    }))
    .mutation(async ({ input }) => {
      const pool = getSSHPool();
      
      try {
        const dfOutput = await pool.execute(
          input.hostId,
          `df -BG "${input.path}" 2>/dev/null | tail -1`
        );
        
        const parts = dfOutput.trim().split(/\s+/);
        if (parts.length < 4) {
          return { success: false, error: "Failed to parse disk space" };
        }
        
        const availableGB = parseInt(parts[3].replace("G", "")) || 0;
        const totalGB = parseInt(parts[1].replace("G", "")) || 0;
        const usedGB = parseInt(parts[2].replace("G", "")) || 0;
        
        return {
          success: true,
          available: availableGB >= input.requiredGB,
          availableGB,
          totalGB,
          usedGB,
          usedPercent: Math.round((usedGB / totalGB) * 100),
          requiredGB: input.requiredGB,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Start a new deployment
  startDeployment: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      deploymentMethod: z.enum(["ai-workbench", "bare-metal"]),
      config: z.object({
        appName: z.string().default("nemo-command-center"),
        deployPath: z.string().default("/opt/nemo-command-center"),
        port: z.number().default(3000),
        enableNginx: z.boolean().default(true),
        enableSystemd: z.boolean().default(true),
        envVars: z.record(z.string(), z.string()).optional(),
      }),
      files: z.array(z.object({
        name: z.string(),
        content: z.string(),
        path: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const deploymentId = generateDeploymentId();
      const pool = getSSHPool();
      
      // Initialize deployment tracking
      const deployment: ActiveDeployment = {
        id: deploymentId,
        hostId: input.hostId,
        status: "running",
        steps: [
          { id: "connect", name: "Establish SSH Connection", status: "pending", logs: [] },
          { id: "prepare", name: "Prepare Deployment Directory", status: "pending", logs: [] },
          { id: "upload", name: "Upload Configuration Files", status: "pending", logs: [] },
          { id: "deps", name: "Install Dependencies", status: "pending", logs: [] },
          { id: "configure", name: "Configure Services", status: "pending", logs: [] },
          { id: "start", name: "Start Application", status: "pending", logs: [] },
          { id: "verify", name: "Verify Deployment", status: "pending", logs: [] },
        ],
        startTime: Date.now(),
        cancelled: false,
      };
      
      activeDeployments.set(deploymentId, deployment);
      
      // Run deployment asynchronously
      (async () => {
        try {
          // Step 1: Connect
          const connectStep = deployment.steps.find(s => s.id === "connect")!;
          connectStep.status = "running";
          connectStep.startTime = Date.now();
          connectStep.logs.push(`Connecting to ${input.hostId}...`);
          
          try {
            const connResult = await pool.execute(input.hostId, 'echo "Connected to $(hostname)"');
            connectStep.logs.push(connResult.trim());
            connectStep.status = "completed";
            connectStep.endTime = Date.now();
          } catch (error: any) {
            connectStep.status = "failed";
            connectStep.error = error.message;
            connectStep.endTime = Date.now();
            deployment.status = "failed";
            return;
          }
          
          if (deployment.cancelled) {
            deployment.status = "cancelled";
            return;
          }
          
          // Step 2: Prepare directory
          const prepareStep = deployment.steps.find(s => s.id === "prepare")!;
          prepareStep.status = "running";
          prepareStep.startTime = Date.now();
          prepareStep.logs.push(`Creating deployment directory: ${input.config.deployPath}`);
          
          try {
            await pool.execute(input.hostId, `mkdir -p "${input.config.deployPath}"`);
            await pool.execute(input.hostId, `mkdir -p "${input.config.deployPath}/config"`);
            await pool.execute(input.hostId, `mkdir -p "${input.config.deployPath}/logs"`);
            prepareStep.logs.push("Created directories: config, logs");
            prepareStep.status = "completed";
            prepareStep.endTime = Date.now();
          } catch (error: any) {
            prepareStep.status = "failed";
            prepareStep.error = error.message;
            prepareStep.endTime = Date.now();
            deployment.status = "failed";
            return;
          }
          
          if (deployment.cancelled) {
            deployment.status = "cancelled";
            return;
          }
          
          // Step 3: Upload files
          const uploadStep = deployment.steps.find(s => s.id === "upload")!;
          uploadStep.status = "running";
          uploadStep.startTime = Date.now();
          uploadStep.logs.push(`Uploading ${input.files.length} configuration files...`);
          
          try {
            for (const file of input.files) {
              const fullPath = `${input.config.deployPath}/${file.path}/${file.name}`;
              const dirPath = `${input.config.deployPath}/${file.path}`;
              
              // Ensure directory exists
              await pool.execute(input.hostId, `mkdir -p "${dirPath}"`);
              
              // Write file content (base64 encoded to handle special characters)
              const base64Content = Buffer.from(file.content).toString("base64");
              await pool.execute(
                input.hostId,
                `echo '${base64Content}' | base64 -d > "${fullPath}"`
              );
              
              uploadStep.logs.push(`Uploaded: ${file.name}`);
            }
            uploadStep.status = "completed";
            uploadStep.endTime = Date.now();
          } catch (error: any) {
            uploadStep.status = "failed";
            uploadStep.error = error.message;
            uploadStep.endTime = Date.now();
            deployment.status = "failed";
            return;
          }
          
          if (deployment.cancelled) {
            deployment.status = "cancelled";
            return;
          }
          
          // Step 4: Install dependencies
          const depsStep = deployment.steps.find(s => s.id === "deps")!;
          depsStep.status = "running";
          depsStep.startTime = Date.now();
          
          try {
            if (input.deploymentMethod === "bare-metal") {
              depsStep.logs.push("Checking Node.js installation...");
              const nodeCheck = await pool.execute(input.hostId, "node --version 2>/dev/null || echo 'NOT_INSTALLED'");
              
              if (nodeCheck.includes("NOT_INSTALLED")) {
                depsStep.logs.push("Node.js not found, installing via nvm...");
                // Install nvm and node
                await pool.execute(
                  input.hostId,
                  'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
                );
                await pool.execute(input.hostId, 'source ~/.nvm/nvm.sh && nvm install 22');
                depsStep.logs.push("Node.js 22 installed");
              } else {
                depsStep.logs.push(`Node.js found: ${nodeCheck.trim()}`);
              }
              
              // Check pnpm
              depsStep.logs.push("Checking pnpm...");
              const pnpmCheck = await pool.execute(input.hostId, "pnpm --version 2>/dev/null || echo 'NOT_INSTALLED'");
              
              if (pnpmCheck.includes("NOT_INSTALLED")) {
                depsStep.logs.push("Installing pnpm...");
                await pool.execute(input.hostId, "npm install -g pnpm");
                depsStep.logs.push("pnpm installed");
              } else {
                depsStep.logs.push(`pnpm found: ${pnpmCheck.trim()}`);
              }
            } else {
              // AI Workbench - check Docker
              depsStep.logs.push("Checking Docker installation...");
              const dockerCheck = await pool.execute(input.hostId, "docker --version 2>/dev/null || echo 'NOT_INSTALLED'");
              
              if (dockerCheck.includes("NOT_INSTALLED")) {
                depsStep.logs.push("Docker not found - please install Docker first");
                depsStep.status = "failed";
                depsStep.error = "Docker is required for AI Workbench deployment";
                depsStep.endTime = Date.now();
                deployment.status = "failed";
                return;
              }
              
              depsStep.logs.push(`Docker found: ${dockerCheck.trim()}`);
            }
            
            depsStep.status = "completed";
            depsStep.endTime = Date.now();
          } catch (error: any) {
            depsStep.status = "failed";
            depsStep.error = error.message;
            depsStep.endTime = Date.now();
            deployment.status = "failed";
            return;
          }
          
          if (deployment.cancelled) {
            deployment.status = "cancelled";
            return;
          }
          
          // Step 5: Configure services
          const configStep = deployment.steps.find(s => s.id === "configure")!;
          configStep.status = "running";
          configStep.startTime = Date.now();
          
          try {
            if (input.deploymentMethod === "bare-metal") {
              // Create environment file
              if (input.config.envVars) {
                configStep.logs.push("Creating environment file...");
                const envContent = Object.entries(input.config.envVars)
                  .map(([key, value]) => `${key}=${value}`)
                  .join("\n");
                const envBase64 = Buffer.from(envContent).toString("base64");
                await pool.execute(
                  input.hostId,
                  `echo '${envBase64}' | base64 -d > "${input.config.deployPath}/.env"`
                );
                configStep.logs.push("Environment file created");
              }
              
              // Create systemd service if enabled
              if (input.config.enableSystemd) {
                configStep.logs.push("Creating systemd service...");
                const serviceContent = `[Unit]
Description=${input.config.appName}
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=${input.config.deployPath}
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:${input.config.deployPath}/logs/app.log
StandardError=append:${input.config.deployPath}/logs/error.log
EnvironmentFile=${input.config.deployPath}/.env

[Install]
WantedBy=multi-user.target`;
                
                const serviceBase64 = Buffer.from(serviceContent).toString("base64");
                await pool.execute(
                  input.hostId,
                  `echo '${serviceBase64}' | base64 -d | sudo tee /etc/systemd/system/${input.config.appName}.service > /dev/null`
                );
                await pool.execute(input.hostId, "sudo systemctl daemon-reload");
                configStep.logs.push("Systemd service created");
              }
              
              // Configure nginx if enabled
              if (input.config.enableNginx) {
                configStep.logs.push("Configuring nginx...");
                const nginxConfig = `server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:${input.config.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
                const nginxBase64 = Buffer.from(nginxConfig).toString("base64");
                await pool.execute(
                  input.hostId,
                  `echo '${nginxBase64}' | base64 -d | sudo tee /etc/nginx/sites-available/${input.config.appName} > /dev/null`
                );
                await pool.execute(
                  input.hostId,
                  `sudo ln -sf /etc/nginx/sites-available/${input.config.appName} /etc/nginx/sites-enabled/`
                );
                configStep.logs.push("Nginx configured");
              }
            } else {
              // AI Workbench - use docker-compose
              configStep.logs.push("Docker Compose configuration ready");
            }
            
            configStep.status = "completed";
            configStep.endTime = Date.now();
          } catch (error: any) {
            configStep.status = "failed";
            configStep.error = error.message;
            configStep.endTime = Date.now();
            deployment.status = "failed";
            return;
          }
          
          if (deployment.cancelled) {
            deployment.status = "cancelled";
            return;
          }
          
          // Step 6: Start application
          const startStep = deployment.steps.find(s => s.id === "start")!;
          startStep.status = "running";
          startStep.startTime = Date.now();
          
          try {
            if (input.deploymentMethod === "bare-metal") {
              if (input.config.enableSystemd) {
                startStep.logs.push("Starting application via systemd...");
                await pool.execute(input.hostId, `sudo systemctl start ${input.config.appName}`);
                await pool.execute(input.hostId, `sudo systemctl enable ${input.config.appName}`);
                startStep.logs.push("Application service started and enabled");
              } else {
                startStep.logs.push("Starting application directly...");
                await pool.execute(
                  input.hostId,
                  `cd "${input.config.deployPath}" && nohup node server/index.js > logs/app.log 2>&1 &`
                );
                startStep.logs.push("Application started in background");
              }
              
              // Restart nginx if configured
              if (input.config.enableNginx) {
                startStep.logs.push("Restarting nginx...");
                await pool.execute(input.hostId, "sudo systemctl restart nginx");
                startStep.logs.push("Nginx restarted");
              }
            } else {
              // AI Workbench - docker-compose up
              startStep.logs.push("Starting containers with docker-compose...");
              await pool.execute(
                input.hostId,
                `cd "${input.config.deployPath}" && docker-compose up -d`
              );
              startStep.logs.push("Containers started");
            }
            
            startStep.status = "completed";
            startStep.endTime = Date.now();
          } catch (error: any) {
            startStep.status = "failed";
            startStep.error = error.message;
            startStep.endTime = Date.now();
            deployment.status = "failed";
            return;
          }
          
          if (deployment.cancelled) {
            deployment.status = "cancelled";
            return;
          }
          
          // Step 7: Verify deployment
          const verifyStep = deployment.steps.find(s => s.id === "verify")!;
          verifyStep.status = "running";
          verifyStep.startTime = Date.now();
          
          try {
            verifyStep.logs.push("Waiting for application to start...");
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            verifyStep.logs.push(`Checking health endpoint on port ${input.config.port}...`);
            const healthCheck = await pool.execute(
              input.hostId,
              `curl -s -o /dev/null -w "%{http_code}" http://localhost:${input.config.port}/api/health 2>/dev/null || echo "000"`
            );
            
            const statusCode = healthCheck.trim();
            
            if (statusCode === "200") {
              verifyStep.logs.push("Health check passed (HTTP 200)");
              verifyStep.status = "completed";
            } else if (statusCode === "000") {
              verifyStep.logs.push("Application not responding - checking process...");
              
              // Check if process is running
              const processCheck = await pool.execute(
                input.hostId,
                `pgrep -f "node.*${input.config.appName}" || echo "NOT_RUNNING"`
              );
              
              if (processCheck.includes("NOT_RUNNING")) {
                verifyStep.logs.push("Process not found - deployment may have failed");
                verifyStep.status = "failed";
                verifyStep.error = "Application process not running";
              } else {
                verifyStep.logs.push(`Process running (PID: ${processCheck.trim()})`);
                verifyStep.logs.push("Application started but health endpoint not responding");
                verifyStep.status = "completed"; // Consider partial success
              }
            } else {
              verifyStep.logs.push(`Health check returned HTTP ${statusCode}`);
              verifyStep.status = "completed";
            }
            
            verifyStep.endTime = Date.now();
          } catch (error: any) {
            verifyStep.status = "failed";
            verifyStep.error = error.message;
            verifyStep.endTime = Date.now();
          }
          
          // Set final deployment status
          const failedSteps = deployment.steps.filter(s => s.status === "failed");
          if (failedSteps.length > 0) {
            deployment.status = "failed";
          } else {
            deployment.status = "completed";
          }
          deployment.endTime = Date.now();
          
        } catch (error: any) {
          deployment.status = "failed";
          deployment.endTime = Date.now();
        }
      })();
      
      return {
        success: true,
        deploymentId,
        message: "Deployment started",
      };
    }),

  // Get deployment status
  getDeploymentStatus: publicProcedure
    .input(z.object({
      deploymentId: z.string(),
    }))
    .query(({ input }) => {
      const deployment = activeDeployments.get(input.deploymentId);
      
      if (!deployment) {
        return {
          success: false,
          error: "Deployment not found",
        };
      }
      
      return {
        success: true,
        deployment: {
          id: deployment.id,
          hostId: deployment.hostId,
          status: deployment.status,
          steps: deployment.steps,
          startTime: deployment.startTime,
          endTime: deployment.endTime,
          duration: deployment.endTime 
            ? deployment.endTime - deployment.startTime 
            : Date.now() - deployment.startTime,
        },
      };
    }),

  // Cancel deployment
  cancelDeployment: publicProcedure
    .input(z.object({
      deploymentId: z.string(),
    }))
    .mutation(({ input }) => {
      const deployment = activeDeployments.get(input.deploymentId);
      
      if (!deployment) {
        return {
          success: false,
          error: "Deployment not found",
        };
      }
      
      if (deployment.status !== "running") {
        return {
          success: false,
          error: "Deployment is not running",
        };
      }
      
      deployment.cancelled = true;
      deployment.status = "cancelled";
      deployment.endTime = Date.now();
      
      // Mark current running step as skipped
      const runningStep = deployment.steps.find(s => s.status === "running");
      if (runningStep) {
        runningStep.status = "skipped";
        runningStep.endTime = Date.now();
        runningStep.logs.push("Cancelled by user");
      }
      
      // Mark remaining pending steps as skipped
      deployment.steps
        .filter(s => s.status === "pending")
        .forEach(s => {
          s.status = "skipped";
        });
      
      return {
        success: true,
        message: "Deployment cancelled",
      };
    }),

  // List recent deployments
  listDeployments: publicProcedure
    .query(() => {
      const deployments = Array.from(activeDeployments.values())
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 20)
        .map(d => ({
          id: d.id,
          hostId: d.hostId,
          status: d.status,
          startTime: d.startTime,
          endTime: d.endTime,
          stepsSummary: {
            total: d.steps.length,
            completed: d.steps.filter(s => s.status === "completed").length,
            failed: d.steps.filter(s => s.status === "failed").length,
          },
        }));
      
      return {
        success: true,
        deployments,
      };
    }),

  // Rollback deployment (stop and clean up)
  rollbackDeployment: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      appName: z.string().default("nemo-command-center"),
      deployPath: z.string().default("/opt/nemo-command-center"),
    }))
    .mutation(async ({ input }) => {
      const pool = getSSHPool();
      const logs: string[] = [];
      
      try {
        // Stop systemd service if exists
        logs.push("Stopping systemd service...");
        await pool.execute(
          input.hostId,
          `sudo systemctl stop ${input.appName} 2>/dev/null || true`
        );
        await pool.execute(
          input.hostId,
          `sudo systemctl disable ${input.appName} 2>/dev/null || true`
        );
        logs.push("Service stopped");
        
        // Remove systemd service file
        logs.push("Removing systemd service file...");
        await pool.execute(
          input.hostId,
          `sudo rm -f /etc/systemd/system/${input.appName}.service`
        );
        await pool.execute(input.hostId, "sudo systemctl daemon-reload");
        logs.push("Service file removed");
        
        // Remove nginx config
        logs.push("Removing nginx configuration...");
        await pool.execute(
          input.hostId,
          `sudo rm -f /etc/nginx/sites-enabled/${input.appName}`
        );
        await pool.execute(
          input.hostId,
          `sudo rm -f /etc/nginx/sites-available/${input.appName}`
        );
        await pool.execute(input.hostId, "sudo systemctl reload nginx 2>/dev/null || true");
        logs.push("Nginx configuration removed");
        
        // Kill any remaining processes
        logs.push("Killing remaining processes...");
        await pool.execute(
          input.hostId,
          `pkill -f "node.*${input.appName}" 2>/dev/null || true`
        );
        logs.push("Processes terminated");
        
        // Optionally remove deployment directory (commented out for safety)
        // logs.push("Removing deployment directory...");
        // await pool.execute(input.hostId, `rm -rf "${input.deployPath}"`);
        // logs.push("Deployment directory removed");
        
        return {
          success: true,
          message: "Rollback completed",
          logs,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          logs,
        };
      }
    }),
});
