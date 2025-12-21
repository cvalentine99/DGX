import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Rocket, Server, Cloud, Database, Key, FileCode, Download, Copy, Check,
  ChevronRight, ChevronLeft, Cpu, HardDrive, MemoryStick, Network,
  Container, Settings2, Shield, Zap, Package, Terminal, FileText,
  CheckCircle2, Circle, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 300 : -300, opacity: 0 })
};

// Types
interface WizardConfig {
  // Step 1: Deployment Method
  deploymentMethod: "ai-workbench" | "bare-metal";
  
  // Step 2: Infrastructure
  hostname: string;
  sshPort: number;
  sshUsername: string;
  gpuCount: number;
  gpuType: string;
  cpuCores: number;
  memoryGB: number;
  storageGB: number;
  
  // Step 3: Services
  enableDatabase: boolean;
  databasePath: string;
  enableVllm: boolean;
  vllmModel: string;
  vllmPort: number;
  enableJupyter: boolean;
  jupyterPort: number;
  enableNginx: boolean;
  enableSsl: boolean;
  domain: string;
  
  // Step 4: Secrets
  jwtSecret: string;
  ngcApiKey: string;
  huggingfaceToken: string;
  vllmApiKey: string;
  sshPassword: string;
  turnServerUrl: string;
  turnUsername: string;
  turnCredential: string;
}

const defaultConfig: WizardConfig = {
  deploymentMethod: "ai-workbench",
  hostname: "192.168.50.139",
  sshPort: 22,
  sshUsername: "ubuntu",
  gpuCount: 1,
  gpuType: "NVIDIA GB10 Grace Blackwell",
  cpuCores: 8,
  memoryGB: 32,
  storageGB: 500,
  enableDatabase: true,
  databasePath: "/var/lib/nemo/nemo.db",
  enableVllm: false,
  vllmModel: "meta-llama/Llama-2-7b-chat-hf",
  vllmPort: 8000,
  enableJupyter: true,
  jupyterPort: 8888,
  enableNginx: true,
  enableSsl: false,
  domain: "localhost",
  jwtSecret: "",
  ngcApiKey: "",
  huggingfaceToken: "",
  vllmApiKey: "",
  sshPassword: "",
  turnServerUrl: "",
  turnUsername: "",
  turnCredential: ""
};

const STEPS = [
  { id: 1, title: "Deployment Method", icon: Rocket, description: "Choose how to deploy" },
  { id: 2, title: "Infrastructure", icon: Server, description: "Configure hardware" },
  { id: 3, title: "Services", icon: Container, description: "Enable services" },
  { id: 4, title: "Secrets", icon: Key, description: "Configure credentials" },
  { id: 5, title: "Generate", icon: FileCode, description: "Review & download" }
];

export default function DeploymentWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [config, setConfig] = useState<WizardConfig>(defaultConfig);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const updateConfig = <K extends keyof WizardConfig>(key: K, value: WizardConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  };

  // Generate random JWT secret
  const generateJwtSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    updateConfig('jwtSecret', result);
  };

  // Generate configuration files
  const generatedFiles = useMemo(() => {
    const files: Record<string, string> = {};

    if (config.deploymentMethod === "ai-workbench") {
      // Generate spec.yaml
      files["spec.yaml"] = `specVersion: v2
meta:
  name: nemo-command-center
  image: project-nemo-command-center
  description: Valentine RF Command Center for NVIDIA DGX Spark
  labels: [nvidia, dgx, nemo, ai, mlops]
  createdOn: "${new Date().toISOString().split('T')[0]}"
  defaultBranch: main

container:
  image: nvcr.io/nvidia/pytorch:24.10-py3
  buildtime: docker
  runtime: docker

execution:
  apps:
    - name: NeMo Command Center
      type: custom
      class: webapp
      start: pnpm start
      health: /api/health
      port: "3000"
      url: http://localhost:3000
${config.enableJupyter ? `
    - name: JupyterLab
      type: jupyterlab
      class: webapp
      start: jupyter lab --allow-root --ip=0.0.0.0 --port=${config.jupyterPort} --no-browser
      health: /api
      port: "${config.jupyterPort}"
      url: http://localhost:${config.jupyterPort}
` : ''}
  resources:
    gpu:
      requested: ${config.gpuCount}
    secrets:
      - variable: NGC_API_KEY
        description: NGC API Key
      - variable: HUGGINGFACE_TOKEN
        description: HuggingFace token
      - variable: JWT_SECRET
        description: JWT authentication secret

environment:
  variables:
    NODE_ENV: production
    DATABASE_URL: file:${config.databasePath}
`;

      // Generate compose.yaml
      files["compose.yaml"] = `name: nemo-command-center

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nemo-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:${config.databasePath}
      - JWT_SECRET=\${JWT_SECRET}
      - NGC_API_KEY=\${NGC_API_KEY}
      - HUGGINGFACE_TOKEN=\${HUGGINGFACE_TOKEN}
      - DGX_SSH_HOST=${config.hostname}
      - DGX_SSH_USERNAME=${config.sshUsername}
      - DGX_SSH_PORT=${config.sshPort}
    volumes:
      - app-data:/app/data
      - app-logs:/app/logs
    networks:
      - nemo-network
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: ${config.gpuCount}
              capabilities: [gpu]
${config.enableJupyter ? `
  jupyter:
    image: nvcr.io/nvidia/pytorch:24.10-py3
    container_name: nemo-jupyter
    restart: unless-stopped
    ports:
      - "${config.jupyterPort}:${config.jupyterPort}"
    volumes:
      - .:/workspace
      - app-data:/workspace/data
    networks:
      - nemo-network
    command: jupyter lab --ip=0.0.0.0 --port=${config.jupyterPort} --no-browser --allow-root
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: ${config.gpuCount}
              capabilities: [gpu]
` : ''}${config.enableVllm ? `
  vllm:
    image: vllm/vllm-openai:latest
    container_name: nemo-vllm
    restart: unless-stopped
    ports:
      - "${config.vllmPort}:${config.vllmPort}"
    environment:
      - HUGGING_FACE_HUB_TOKEN=\${HUGGINGFACE_TOKEN}
    volumes:
      - ./models:/models
    networks:
      - nemo-network
    command: --model ${config.vllmModel} --tensor-parallel-size 1
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: ${config.gpuCount}
              capabilities: [gpu]
` : ''}${config.enableNginx ? `
  nginx:
    image: nginx:alpine
    container_name: nemo-nginx
    restart: unless-stopped
    ports:
      - "80:80"${config.enableSsl ? `
      - "443:443"` : ''}
    volumes:
      - ./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - nemo-network
    depends_on:
      - app
` : ''}
networks:
  nemo-network:
    driver: bridge

volumes:
  app-data:
  app-logs:
`;

      // Generate Dockerfile
      files["Dockerfile"] = `FROM nvcr.io/nvidia/pytorch:24.10-py3

LABEL com.nvidia.workbench.application.name="NeMo Command Center"
LABEL com.nvidia.workbench.application.version="1.0.0"
LABEL com.nvidia.workbench.os.distro="ubuntu"
LABEL com.nvidia.workbench.os.version="22.04"
LABEL com.nvidia.workbench.cuda.version="12.4"

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \\
    curl git sqlite3 libssl-dev ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \\
    && apt-get install -y nodejs \\
    && npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["pnpm", "start"]
`;

    } else {
      // Bare Metal configuration
      files["install.sh"] = `#!/bin/bash
set -e

INSTALL_DIR="/opt/nemo-command-center"
DATA_DIR="/var/lib/nemo"
LOG_DIR="/var/log/nemo"
USER="nemo"

echo "Installing NeMo Command Center..."

# Check root
if [[ $EUID -ne 0 ]]; then
   echo "Error: Run as root"
   exit 1
fi

# Install dependencies
apt-get update
apt-get install -y curl wget git build-essential sqlite3 nginx

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pnpm

# Create user and directories
useradd --system --shell /bin/false --home-dir "$INSTALL_DIR" "$USER" 2>/dev/null || true
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR" /etc/nemo

# Copy files and install
cp -r . "$INSTALL_DIR/"
cd "$INSTALL_DIR"
pnpm install --frozen-lockfile
pnpm build

# Set permissions
chown -R "$USER:$USER" "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR"

# Install systemd service
cp deploy/systemd/nemo-command-center.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable nemo-command-center
systemctl start nemo-command-center

echo "Installation complete!"
echo "Edit /etc/nemo/nemo-command-center.env and restart the service"
`;

      files["nemo-command-center.service"] = `[Unit]
Description=NeMo Command Center
After=network.target

[Service]
Type=simple
User=nemo
Group=nemo
WorkingDirectory=/opt/nemo-command-center
EnvironmentFile=/etc/nemo/nemo-command-center.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/nemo-command-center/dist/index.js
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/nemo /var/log/nemo

# Limits
LimitNOFILE=65536
MemoryMax=8G

[Install]
WantedBy=multi-user.target
`;

      files["nginx.conf"] = `upstream nemo_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name ${config.domain};
${config.enableSsl ? `
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${config.domain};
    
    ssl_certificate /etc/letsencrypt/live/${config.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${config.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
` : ''}
    location / {
        proxy_pass http://nemo_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location /api/ {
        proxy_pass http://nemo_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300;
    }

    location /ws {
        proxy_pass http://nemo_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
`;
    }

    // Common: Environment file
    files[".env"] = `# NeMo Command Center Environment Configuration
# Generated by Deployment Wizard

NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=file:${config.databasePath}

# Authentication
JWT_SECRET=${config.jwtSecret || 'CHANGE_THIS_TO_A_SECURE_VALUE'}

# NVIDIA NGC
NGC_API_KEY=${config.ngcApiKey || 'your-ngc-api-key'}

# HuggingFace
HUGGINGFACE_TOKEN=${config.huggingfaceToken || 'your-huggingface-token'}

# DGX SSH Configuration
DGX_SSH_HOST=${config.hostname}
DGX_SSH_USERNAME=${config.sshUsername}
DGX_SSH_PASSWORD=${config.sshPassword || 'your-ssh-password'}
DGX_SSH_PORT=${config.sshPort}
${config.enableVllm ? `
# vLLM Inference
VLLM_API_URL=http://localhost:${config.vllmPort}/v1
VLLM_API_KEY=${config.vllmApiKey || 'your-vllm-api-key'}
` : ''}${config.turnServerUrl ? `
# WebRTC TURN Server
TURN_SERVER_URL=${config.turnServerUrl}
TURN_SERVER_USERNAME=${config.turnUsername}
TURN_SERVER_CREDENTIAL=${config.turnCredential}
` : ''}
`;

    return files;
  }, [config]);

  const copyToClipboard = async (filename: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
    toast.success(`${filename} copied to clipboard`);
  };

  const downloadAllFiles = () => {
    // Create a simple text file with all configs
    const allContent = Object.entries(generatedFiles)
      .map(([name, content]) => `=== ${name} ===\n\n${content}\n\n`)
      .join('\n');
    
    const blob = new Blob([allContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nemo-deployment-${config.deploymentMethod}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("All configuration files downloaded");
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <Rocket className="w-6 h-6 text-purple-400" />
            </div>
            Deployment Wizard
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate customized deployment configurations for your infrastructure
          </p>
        </div>
      </motion.div>

      {/* Progress Steps */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => goToStep(step.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                      currentStep === step.id
                        ? "bg-purple-500/20 border border-purple-500/50"
                        : currentStep > step.id
                        ? "bg-green-500/10 border border-green-500/30 hover:bg-green-500/20"
                        : "bg-muted/30 border border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className={`p-2 rounded-full ${
                      currentStep === step.id
                        ? "bg-purple-500/30 text-purple-400"
                        : currentStep > step.id
                        ? "bg-green-500/30 text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {currentStep > step.id ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p className={`text-sm font-medium ${
                        currentStep === step.id ? "text-purple-400" : 
                        currentStep > step.id ? "text-green-400" : "text-muted-foreground"
                      }`}>
                        Step {step.id}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.title}</p>
                    </div>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`w-8 lg:w-16 h-0.5 mx-2 ${
                      currentStep > step.id ? "bg-green-500/50" : "bg-border"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Step Content */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 border-border/50 min-h-[500px]">
          <CardContent className="p-6">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                {/* Step 1: Deployment Method */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">Choose Deployment Method</h2>
                      <p className="text-muted-foreground">
                        Select how you want to deploy NeMo Command Center
                      </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <button
                        onClick={() => updateConfig('deploymentMethod', 'ai-workbench')}
                        className={`p-6 rounded-xl border-2 text-left transition-all ${
                          config.deploymentMethod === 'ai-workbench'
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-border hover:border-purple-500/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-3 rounded-lg bg-purple-500/20">
                            <Cloud className="w-6 h-6 text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold">AI Workbench</h3>
                            <Badge variant="outline" className="text-xs">Recommended</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Containerized deployment using NVIDIA AI Workbench with Docker Compose. 
                          Ideal for development and managed environments.
                        </p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-4 h-4" /> Automatic GPU configuration
                          </div>
                          <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-4 h-4" /> Multi-container orchestration
                          </div>
                          <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-4 h-4" /> Easy remote deployment
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => updateConfig('deploymentMethod', 'bare-metal')}
                        className={`p-6 rounded-xl border-2 text-left transition-all ${
                          config.deploymentMethod === 'bare-metal'
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-border hover:border-orange-500/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-3 rounded-lg bg-orange-500/20">
                            <Server className="w-6 h-6 text-orange-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Bare Metal</h3>
                            <Badge variant="outline" className="text-xs">Production</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Direct installation on DGX Spark or Ubuntu systems. 
                          Maximum performance with systemd service management.
                        </p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-4 h-4" /> Maximum performance
                          </div>
                          <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-4 h-4" /> Direct GPU access
                          </div>
                          <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-4 h-4" /> Systemd integration
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Infrastructure */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">Configure Infrastructure</h2>
                      <p className="text-muted-foreground">
                        Specify your target hardware and connection details
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Network className="w-4 h-4 text-blue-400" />
                          Connection Details
                        </h3>
                        
                        <div className="space-y-2">
                          <Label>Hostname / IP Address</Label>
                          <Input
                            value={config.hostname}
                            onChange={(e) => updateConfig('hostname', e.target.value)}
                            placeholder="192.168.50.139"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>SSH Port</Label>
                            <Input
                              type="number"
                              value={config.sshPort}
                              onChange={(e) => updateConfig('sshPort', parseInt(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>SSH Username</Label>
                            <Input
                              value={config.sshUsername}
                              onChange={(e) => updateConfig('sshUsername', e.target.value)}
                              placeholder="ubuntu"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-green-400" />
                          Hardware Resources
                        </h3>

                        <div className="space-y-2">
                          <Label>GPU Type</Label>
                          <Select value={config.gpuType} onValueChange={(v) => updateConfig('gpuType', v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NVIDIA GB10 Grace Blackwell">NVIDIA GB10 Grace Blackwell</SelectItem>
                              <SelectItem value="NVIDIA A100">NVIDIA A100</SelectItem>
                              <SelectItem value="NVIDIA H100">NVIDIA H100</SelectItem>
                              <SelectItem value="NVIDIA RTX 4090">NVIDIA RTX 4090</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>GPU Count: {config.gpuCount}</Label>
                          <Slider
                            value={[config.gpuCount]}
                            onValueChange={([v]) => updateConfig('gpuCount', v)}
                            min={1}
                            max={8}
                            step={1}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">CPU Cores</Label>
                            <Input
                              type="number"
                              value={config.cpuCores}
                              onChange={(e) => updateConfig('cpuCores', parseInt(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Memory (GB)</Label>
                            <Input
                              type="number"
                              value={config.memoryGB}
                              onChange={(e) => updateConfig('memoryGB', parseInt(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Storage (GB)</Label>
                            <Input
                              type="number"
                              value={config.storageGB}
                              onChange={(e) => updateConfig('storageGB', parseInt(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Services */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">Configure Services</h2>
                      <p className="text-muted-foreground">
                        Enable and configure additional services
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Database */}
                      <Card className="bg-muted/30 border-border/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Database className="w-5 h-5 text-blue-400" />
                              <CardTitle className="text-base">Database</CardTitle>
                            </div>
                            <Switch
                              checked={config.enableDatabase}
                              onCheckedChange={(v) => updateConfig('enableDatabase', v)}
                            />
                          </div>
                        </CardHeader>
                        {config.enableDatabase && (
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              <Label className="text-xs">Database Path</Label>
                              <Input
                                value={config.databasePath}
                                onChange={(e) => updateConfig('databasePath', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </CardContent>
                        )}
                      </Card>

                      {/* vLLM */}
                      <Card className="bg-muted/30 border-border/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="w-5 h-5 text-yellow-400" />
                              <CardTitle className="text-base">vLLM Inference</CardTitle>
                            </div>
                            <Switch
                              checked={config.enableVllm}
                              onCheckedChange={(v) => updateConfig('enableVllm', v)}
                            />
                          </div>
                        </CardHeader>
                        {config.enableVllm && (
                          <CardContent className="pt-0 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Model</Label>
                              <Select value={config.vllmModel} onValueChange={(v) => updateConfig('vllmModel', v)}>
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="meta-llama/Llama-2-7b-chat-hf">Llama 2 7B Chat</SelectItem>
                                  <SelectItem value="meta-llama/Llama-2-13b-chat-hf">Llama 2 13B Chat</SelectItem>
                                  <SelectItem value="mistralai/Mistral-7B-Instruct-v0.2">Mistral 7B</SelectItem>
                                  <SelectItem value="nvidia/Nemotron-3-8B-Base-4k">Nemotron 3 8B</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Port</Label>
                              <Input
                                type="number"
                                value={config.vllmPort}
                                onChange={(e) => updateConfig('vllmPort', parseInt(e.target.value))}
                                className="text-sm"
                              />
                            </div>
                          </CardContent>
                        )}
                      </Card>

                      {/* JupyterLab */}
                      <Card className="bg-muted/30 border-border/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-5 h-5 text-orange-400" />
                              <CardTitle className="text-base">JupyterLab</CardTitle>
                            </div>
                            <Switch
                              checked={config.enableJupyter}
                              onCheckedChange={(v) => updateConfig('enableJupyter', v)}
                            />
                          </div>
                        </CardHeader>
                        {config.enableJupyter && (
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              <Label className="text-xs">Port</Label>
                              <Input
                                type="number"
                                value={config.jupyterPort}
                                onChange={(e) => updateConfig('jupyterPort', parseInt(e.target.value))}
                                className="text-sm"
                              />
                            </div>
                          </CardContent>
                        )}
                      </Card>

                      {/* Nginx */}
                      <Card className="bg-muted/30 border-border/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Shield className="w-5 h-5 text-green-400" />
                              <CardTitle className="text-base">Nginx Proxy</CardTitle>
                            </div>
                            <Switch
                              checked={config.enableNginx}
                              onCheckedChange={(v) => updateConfig('enableNginx', v)}
                            />
                          </div>
                        </CardHeader>
                        {config.enableNginx && (
                          <CardContent className="pt-0 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Domain</Label>
                              <Input
                                value={config.domain}
                                onChange={(e) => updateConfig('domain', e.target.value)}
                                placeholder="localhost"
                                className="text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="ssl"
                                checked={config.enableSsl}
                                onCheckedChange={(v) => updateConfig('enableSsl', !!v)}
                              />
                              <Label htmlFor="ssl" className="text-xs">Enable SSL/HTTPS</Label>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    </div>
                  </div>
                )}

                {/* Step 4: Secrets */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">Configure Secrets</h2>
                      <p className="text-muted-foreground">
                        Set up authentication and API credentials
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Key className="w-4 h-4 text-purple-400" />
                          Authentication
                        </h3>

                        <div className="space-y-2">
                          <Label>JWT Secret</Label>
                          <div className="flex gap-2">
                            <Input
                              value={config.jwtSecret}
                              onChange={(e) => updateConfig('jwtSecret', e.target.value)}
                              placeholder="Click generate to create a secure key"
                              className="font-mono text-xs"
                            />
                            <Button variant="outline" onClick={generateJwtSecret}>
                              Generate
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>SSH Password</Label>
                          <Input
                            type="password"
                            value={config.sshPassword}
                            onChange={(e) => updateConfig('sshPassword', e.target.value)}
                            placeholder="DGX host SSH password"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Package className="w-4 h-4 text-green-400" />
                          API Keys
                        </h3>

                        <div className="space-y-2">
                          <Label>NGC API Key</Label>
                          <Input
                            type="password"
                            value={config.ngcApiKey}
                            onChange={(e) => updateConfig('ngcApiKey', e.target.value)}
                            placeholder="From ngc.nvidia.com"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>HuggingFace Token</Label>
                          <Input
                            type="password"
                            value={config.huggingfaceToken}
                            onChange={(e) => updateConfig('huggingfaceToken', e.target.value)}
                            placeholder="From huggingface.co/settings/tokens"
                          />
                        </div>

                        {config.enableVllm && (
                          <div className="space-y-2">
                            <Label>vLLM API Key</Label>
                            <Input
                              type="password"
                              value={config.vllmApiKey}
                              onChange={(e) => updateConfig('vllmApiKey', e.target.value)}
                              placeholder="Optional API key for vLLM"
                            />
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Network className="w-4 h-4 text-blue-400" />
                          WebRTC TURN Server (Optional)
                        </h3>

                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">TURN Server URL</Label>
                            <Input
                              value={config.turnServerUrl}
                              onChange={(e) => updateConfig('turnServerUrl', e.target.value)}
                              placeholder="turn:server:3478"
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Username</Label>
                            <Input
                              value={config.turnUsername}
                              onChange={(e) => updateConfig('turnUsername', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Credential</Label>
                            <Input
                              type="password"
                              value={config.turnCredential}
                              onChange={(e) => updateConfig('turnCredential', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Generate */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold mb-2">Generated Configuration</h2>
                        <p className="text-muted-foreground">
                          Review and download your deployment files
                        </p>
                      </div>
                      <Button onClick={downloadAllFiles} className="bg-purple-600 hover:bg-purple-700">
                        <Download className="w-4 h-4 mr-2" />
                        Download All
                      </Button>
                    </div>

                    <div className="grid gap-4">
                      <Tabs defaultValue={Object.keys(generatedFiles)[0]} className="w-full">
                        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
                          {Object.keys(generatedFiles).map((filename) => (
                            <TabsTrigger
                              key={filename}
                              value={filename}
                              className="text-xs px-3 py-1.5"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              {filename}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {Object.entries(generatedFiles).map(([filename, content]) => (
                          <TabsContent key={filename} value={filename} className="mt-4">
                            <Card className="bg-muted/30 border-border/50">
                              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileCode className="w-4 h-4 text-purple-400" />
                                  <span className="font-mono text-sm">{filename}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(filename, content)}
                                >
                                  {copiedFile === filename ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </CardHeader>
                              <CardContent className="p-0">
                                <pre className="p-4 overflow-x-auto text-xs font-mono bg-black/30 rounded-b-lg max-h-[400px] overflow-y-auto">
                                  <code>{content}</code>
                                </pre>
                              </CardContent>
                            </Card>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>

                    {/* Summary */}
                    <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30">
                      <CardContent className="p-4">
                        <h3 className="font-medium mb-3 flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-purple-400" />
                          Configuration Summary
                        </h3>
                        <div className="grid md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Deployment</p>
                            <p className="font-medium capitalize">{config.deploymentMethod.replace('-', ' ')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Target Host</p>
                            <p className="font-medium font-mono">{config.hostname}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">GPU</p>
                            <p className="font-medium">{config.gpuCount}x {config.gpuType.split(' ').pop()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Services</p>
                            <p className="font-medium">
                              {[
                                config.enableDatabase && 'DB',
                                config.enableVllm && 'vLLM',
                                config.enableJupyter && 'Jupyter',
                                config.enableNginx && 'Nginx'
                              ].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation Buttons */}
      <motion.div variants={itemVariants} className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        
        {currentStep < 5 ? (
          <Button onClick={nextStep} className="gap-2 bg-purple-600 hover:bg-purple-700">
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={downloadAllFiles} className="gap-2 bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4" />
            Download Configuration
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
