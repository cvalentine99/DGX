import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Rocket, Server, Cloud, Database, Key, FileCode, Download, Copy, Check,
  ChevronRight, ChevronLeft, Cpu, HardDrive, MemoryStick, Network,
  Container, Settings2, Shield, Zap, Package, Terminal, FileText,
  CheckCircle2, Circle, ArrowRight, AlertCircle, Sparkles, RotateCcw,
  GitCompare, Eye, EyeOff, Upload, History, PlayCircle, Loader2,
  Trash2, Clock, XCircle, Wifi, WifiOff, StopCircle, ChevronDown,
  ChevronUp, Activity, Timer, Ban, RefreshCw
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
import { trpc } from "@/lib/trpc";

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

// Validation types
interface ValidationErrors {
  hostname?: string;
  sshPort?: string;
  sshUsername?: string;
  cpuCores?: string;
  memoryGB?: string;
  storageGB?: string;
  vllmPort?: string;
  jupyterPort?: string;
  domain?: string;
  jwtSecret?: string;
  databasePath?: string;
}

// Deployment presets
interface DeploymentPreset {
  id: string;
  name: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
  config: Partial<WizardConfig>;
}

const DEPLOYMENT_PRESETS: DeploymentPreset[] = [
  {
    id: "development",
    name: "Development",
    description: "Local development with minimal resources, JupyterLab enabled",
    icon: Terminal,
    color: "blue",
    config: {
      deploymentMethod: "ai-workbench",
      gpuCount: 1,
      cpuCores: 4,
      memoryGB: 16,
      storageGB: 100,
      enableDatabase: true,
      enableVllm: false,
      enableJupyter: true,
      enableNginx: false,
      enableSsl: false,
    }
  },
  {
    id: "production",
    name: "Production",
    description: "Full production setup with all services, SSL, and high resources",
    icon: Rocket,
    color: "green",
    config: {
      deploymentMethod: "bare-metal",
      gpuCount: 1,
      cpuCores: 16,
      memoryGB: 64,
      storageGB: 1000,
      enableDatabase: true,
      enableVllm: true,
      enableJupyter: false,
      enableNginx: true,
      enableSsl: true,
    }
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Bare minimum setup for testing, database only",
    icon: Package,
    color: "orange",
    config: {
      deploymentMethod: "ai-workbench",
      gpuCount: 1,
      cpuCores: 2,
      memoryGB: 8,
      storageGB: 50,
      enableDatabase: true,
      enableVllm: false,
      enableJupyter: false,
      enableNginx: false,
      enableSsl: false,
    }
  },
  {
    id: "inference",
    name: "Inference Server",
    description: "Optimized for model inference with vLLM and Nginx proxy",
    icon: Zap,
    color: "purple",
    config: {
      deploymentMethod: "bare-metal",
      gpuCount: 1,
      cpuCores: 8,
      memoryGB: 32,
      storageGB: 500,
      enableDatabase: true,
      enableVllm: true,
      enableJupyter: false,
      enableNginx: true,
      enableSsl: false,
    }
  }
];

// Validation helpers
const isValidIP = (ip: string): boolean => {
  if (ip === 'localhost') return true;
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return ipv4Regex.test(ip) || hostnameRegex.test(ip);
};

const isValidPort = (port: number): boolean => {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

const isValidPath = (path: string): boolean => {
  return path.startsWith('/') && !path.includes('..');
};

// Diff calculation helper
interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

const calculateDiff = (oldContent: string, newContent: string): DiffLine[] => {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const result: DiffLine[] = [];
  
  let oldIdx = 0;
  let newIdx = 0;
  let lineNum = 1;
  
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      result.push({ type: 'added', content: newLines[newIdx], lineNumber: lineNum++ });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      result.push({ type: 'removed', content: oldLines[oldIdx], lineNumber: lineNum++ });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      result.push({ type: 'unchanged', content: newLines[newIdx], lineNumber: lineNum++ });
      oldIdx++;
      newIdx++;
    } else {
      // Simple diff: mark old as removed, new as added
      result.push({ type: 'removed', content: oldLines[oldIdx], lineNumber: lineNum++ });
      oldIdx++;
    }
  }
  
  return result;
};

// History entry type
interface HistoryEntry {
  id: string;
  timestamp: number;
  config: WizardConfig;
  deploymentMethod: string;
  hostname: string;
  summary: string;
}

// Validation check result
interface ValidationCheck {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  message?: string;
}

// Deployment step tracking
interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  logs: string[];
  progress?: number;
}

interface DeploymentStatus {
  isDeploying: boolean;
  currentStepIndex: number;
  steps: DeploymentStep[];
  startTime?: number;
  endTime?: number;
  overallStatus: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  deploymentId?: string;
}

const INITIAL_DEPLOYMENT_STEPS: Omit<DeploymentStep, 'logs'>[] = [
  { id: 'connect', name: 'Connect to Host', description: 'Establishing SSH connection', status: 'pending' },
  { id: 'upload', name: 'Upload Files', description: 'Transferring configuration files', status: 'pending' },
  { id: 'dependencies', name: 'Install Dependencies', description: 'Installing required packages', status: 'pending' },
  { id: 'configure', name: 'Configure Services', description: 'Setting up environment and services', status: 'pending' },
  { id: 'start', name: 'Start Services', description: 'Launching application containers', status: 'pending' },
  { id: 'verify', name: 'Verify Deployment', description: 'Running health checks', status: 'pending' },
];

const HISTORY_STORAGE_KEY = 'nemo-deployment-history';

export default function DeploymentWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [config, setConfig] = useState<WizardConfig>(defaultConfig);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [previousFiles, setPreviousFiles] = useState<Record<string, string>>({});
  const [showDiff, setShowDiff] = useState(false);
  
  // New state for export/import, validation, and history
  const [deploymentHistory, setDeploymentHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [validationChecks, setValidationChecks] = useState<ValidationCheck[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Deployment tracking state
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>({
    isDeploying: false,
    currentStepIndex: -1,
    steps: [],
    overallStatus: 'idle'
  });
  const [showDeploymentPanel, setShowDeploymentPanel] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);

  const updateConfig = <K extends keyof WizardConfig>(key: K, value: WizardConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    // Clear preset selection when manually changing config
    setSelectedPreset(null);
  };

  // Validation function
  const validateConfig = useCallback((): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    // Hostname validation
    if (!config.hostname) {
      newErrors.hostname = "Hostname is required";
    } else if (!isValidIP(config.hostname)) {
      newErrors.hostname = "Invalid IP address or hostname format";
    }

    // SSH Port validation
    if (!isValidPort(config.sshPort)) {
      newErrors.sshPort = "Port must be between 1-65535";
    }

    // SSH Username validation
    if (!config.sshUsername || config.sshUsername.length < 1) {
      newErrors.sshUsername = "Username is required";
    }

    // Resource validation
    if (config.cpuCores < 1 || config.cpuCores > 256) {
      newErrors.cpuCores = "CPU cores must be between 1-256";
    }
    if (config.memoryGB < 1 || config.memoryGB > 2048) {
      newErrors.memoryGB = "Memory must be between 1-2048 GB";
    }
    if (config.storageGB < 10 || config.storageGB > 100000) {
      newErrors.storageGB = "Storage must be between 10-100000 GB";
    }

    // Service port validation
    if (config.enableVllm && !isValidPort(config.vllmPort)) {
      newErrors.vllmPort = "Port must be between 1-65535";
    }
    if (config.enableJupyter && !isValidPort(config.jupyterPort)) {
      newErrors.jupyterPort = "Port must be between 1-65535";
    }

    // Domain validation
    if (config.enableNginx && !config.domain) {
      newErrors.domain = "Domain is required when Nginx is enabled";
    }

    // Database path validation
    if (config.enableDatabase && !isValidPath(config.databasePath)) {
      newErrors.databasePath = "Path must be absolute (start with /)";
    }

    // JWT Secret validation
    if (config.jwtSecret && config.jwtSecret.length < 32) {
      newErrors.jwtSecret = "JWT secret should be at least 32 characters";
    }

    return newErrors;
  }, [config]);

  // Run validation on config change
  useEffect(() => {
    const newErrors = validateConfig();
    setErrors(newErrors);
  }, [validateConfig]);

  // Check if current step has errors
  const stepHasErrors = useCallback((step: number): boolean => {
    const stepFields: Record<number, (keyof ValidationErrors)[]> = {
      2: ['hostname', 'sshPort', 'sshUsername', 'cpuCores', 'memoryGB', 'storageGB'],
      3: ['vllmPort', 'jupyterPort', 'domain', 'databasePath'],
      4: ['jwtSecret'],
    };
    const fields = stepFields[step] || [];
    return fields.some(field => errors[field]);
  }, [errors]);

  // Apply preset
  const applyPreset = (preset: DeploymentPreset) => {
    setConfig(prev => ({ ...prev, ...preset.config }));
    setSelectedPreset(preset.id);
    toast.success(`Applied "${preset.name}" preset`);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setConfig(defaultConfig);
    setSelectedPreset(null);
    toast.info("Reset to default configuration");
  };

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setDeploymentHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load deployment history:', e);
    }
  }, []);

  // Export configuration as JSON
  const exportConfig = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      config: config
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nemo-config-${config.hostname || 'untitled'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Configuration exported successfully');
  };

  // Import configuration from JSON
  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.config && typeof data.config === 'object') {
          // Validate required fields exist
          const requiredFields = ['deploymentMethod', 'hostname', 'sshPort'];
          const hasRequired = requiredFields.every(field => field in data.config);
          if (!hasRequired) {
            toast.error('Invalid configuration file: missing required fields');
            return;
          }
          setConfig({ ...defaultConfig, ...data.config });
          setSelectedPreset(null);
          toast.success('Configuration imported successfully');
        } else {
          toast.error('Invalid configuration file format');
        }
      } catch (err) {
        toast.error('Failed to parse configuration file');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  // Save to history
  const saveToHistory = () => {
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      config: { ...config },
      deploymentMethod: config.deploymentMethod,
      hostname: config.hostname,
      summary: `${config.deploymentMethod === 'ai-workbench' ? 'AI Workbench' : 'Bare Metal'} - ${config.hostname} - ${config.gpuCount}x GPU`
    };
    const newHistory = [entry, ...deploymentHistory].slice(0, 20); // Keep last 20
    setDeploymentHistory(newHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    toast.success('Configuration saved to history');
  };

  // Load from history
  const loadFromHistory = (entry: HistoryEntry) => {
    setConfig(entry.config);
    setSelectedPreset(null);
    setShowHistory(false);
    toast.success('Configuration loaded from history');
  };

  // Delete from history
  const deleteFromHistory = (id: string) => {
    const newHistory = deploymentHistory.filter(h => h.id !== id);
    setDeploymentHistory(newHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    toast.info('History entry deleted');
  };

  // Clear all history
  const clearHistory = () => {
    setDeploymentHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    toast.info('History cleared');
  };

  // Run pre-flight validation checks
  const runValidationChecks = async () => {
    setIsValidating(true);
    const checks: ValidationCheck[] = [
      { name: 'Configuration Schema', status: 'pending' },
      { name: 'SSH Connectivity', status: 'pending' },
      { name: 'GPU Availability', status: 'pending' },
      { name: 'Disk Space', status: 'pending' },
    ];
    setValidationChecks(checks);

    // Check 1: Configuration Schema
    await new Promise(r => setTimeout(r, 500));
    const schemaErrors = validateConfig();
    const schemaValid = Object.keys(schemaErrors).length === 0;
    checks[0] = {
      name: 'Configuration Schema',
      status: schemaValid ? 'passed' : 'failed',
      message: schemaValid ? 'All fields validated' : `${Object.keys(schemaErrors).length} validation errors`
    };
    setValidationChecks([...checks]);

    // Determine host ID based on hostname
    const hostId = config.hostname.includes('139') || config.hostname.includes('alpha') ? 'alpha' as const : 'beta' as const;

    // Check 2: SSH Connectivity (real check)
    checks[1] = { name: 'SSH Connectivity', status: 'running' };
    setValidationChecks([...checks]);
    try {
      const connResult = await testConnectionMutation.mutateAsync({ hostId });
      checks[1] = {
        name: 'SSH Connectivity',
        status: connResult.success ? 'passed' : 'failed',
        message: connResult.success 
          ? `Connected to ${config.hostname} (${connResult.latencyMs}ms latency)`
          : connResult.error || 'SSH connection failed'
      };
    } catch (error) {
      checks[1] = {
        name: 'SSH Connectivity',
        status: 'failed',
        message: error instanceof Error ? error.message : 'SSH connection failed'
      };
    }
    setValidationChecks([...checks]);

    // Check 3: GPU Availability (real check)
    checks[2] = { name: 'GPU Availability', status: 'running' };
    setValidationChecks([...checks]);
    try {
      const gpuResult = await checkGPUMutation.mutateAsync({ hostId });
      if (gpuResult.success && gpuResult.available) {
        checks[2] = {
          name: 'GPU Availability',
          status: 'passed',
          message: `${gpuResult.gpuCount} GPU(s) detected: ${gpuResult.gpus?.map(g => g.name).join(', ')}`
        };
      } else {
        checks[2] = {
          name: 'GPU Availability',
          status: 'passed', // Not a failure, just no GPU
          message: 'No GPU detected (CPU-only mode)'
        };
      }
    } catch (error) {
      checks[2] = {
        name: 'GPU Availability',
        status: 'passed', // Don't fail on GPU check error
        message: 'Could not verify GPU (will continue without GPU)'
      };
    }
    setValidationChecks([...checks]);

    // Check 4: Disk Space (real check)
    checks[3] = { name: 'Disk Space', status: 'running' };
    setValidationChecks([...checks]);
    try {
      const diskResult = await checkDiskMutation.mutateAsync({ hostId, path: '/opt', requiredGB: 10 });
      if (diskResult.success) {
        checks[3] = {
          name: 'Disk Space',
          status: diskResult.available ? 'passed' : 'failed',
          message: diskResult.available 
            ? `${diskResult.availableGB}GB available (${diskResult.usedPercent}% used)`
            : `Only ${diskResult.availableGB}GB available, need ${diskResult.requiredGB}GB`
        };
      } else {
        checks[3] = {
          name: 'Disk Space',
          status: 'failed',
          message: diskResult.error || 'Failed to check disk space'
        };
      }
    } catch (error) {
      checks[3] = {
        name: 'Disk Space',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to check disk space'
      };
    }
    setValidationChecks([...checks]);

    setIsValidating(false);
    
    const allPassed = checks.every(c => c.status === 'passed');
    if (allPassed) {
      toast.success('All pre-flight checks passed!');
    } else {
      toast.error('Some validation checks failed');
    }
  };

  // tRPC mutations for real deployment
  const testConnectionMutation = trpc.deployment.testConnection.useMutation();
  const checkGPUMutation = trpc.deployment.checkGPU.useMutation();
  const checkDiskMutation = trpc.deployment.checkDiskSpace.useMutation();
  const startDeploymentMutation = trpc.deployment.startDeployment.useMutation();
  const cancelDeploymentMutation = trpc.deployment.cancelDeployment.useMutation();
  const deploymentStatusQuery = trpc.deployment.getDeploymentStatus.useQuery(
    { deploymentId: deploymentStatus.deploymentId || '' },
    { enabled: !!deploymentStatus.deploymentId && deploymentStatus.isDeploying, refetchInterval: 1000 }
  );

  // Sync deployment status from server
  useEffect(() => {
    if (deploymentStatusQuery.data?.success && deploymentStatusQuery.data.deployment) {
      const serverDeployment = deploymentStatusQuery.data.deployment;
      
      // Map server steps to local format
      const mappedSteps: DeploymentStep[] = serverDeployment.steps.map(s => ({
        id: s.id,
        name: s.name,
        description: s.name,
        status: s.status as DeploymentStep['status'],
        logs: s.logs.map(log => `[${new Date().toLocaleTimeString()}] ${log}`),
        startTime: s.startTime,
        endTime: s.endTime,
      }));

      const currentIdx = mappedSteps.findIndex(s => s.status === 'running');
      
      setDeploymentStatus(prev => ({
        ...prev,
        steps: mappedSteps,
        currentStepIndex: currentIdx >= 0 ? currentIdx : prev.currentStepIndex,
        overallStatus: serverDeployment.status as typeof prev.overallStatus,
        isDeploying: serverDeployment.status === 'running',
        endTime: serverDeployment.endTime,
      }));

      // Handle completion
      if (serverDeployment.status === 'completed') {
        toast.success('Deployment completed successfully!');
        saveToHistory();
      } else if (serverDeployment.status === 'failed') {
        toast.error('Deployment failed');
      }
    }
  }, [deploymentStatusQuery.data]);

  // Start deployment execution
  const startDeployment = async () => {
    // Initialize deployment steps
    const steps: DeploymentStep[] = INITIAL_DEPLOYMENT_STEPS.map(s => ({ ...s, logs: [] }));
    
    setDeploymentStatus({
      isDeploying: true,
      currentStepIndex: 0,
      steps,
      startTime: Date.now(),
      overallStatus: 'running'
    });
    setShowDeploymentPanel(true);
    toast.info('Starting deployment...');

    // Helper to update a step
    const updateStep = (index: number, updates: Partial<DeploymentStep>) => {
      setDeploymentStatus(prev => {
        const newSteps = [...prev.steps];
        newSteps[index] = { ...newSteps[index], ...updates };
        return { ...prev, steps: newSteps };
      });
    };

    // Helper to add log entry
    const addLog = (index: number, message: string) => {
      setDeploymentStatus(prev => {
        const newSteps = [...prev.steps];
        newSteps[index] = { 
          ...newSteps[index], 
          logs: [...newSteps[index].logs, `[${new Date().toLocaleTimeString()}] ${message}`]
        };
        return { ...prev, steps: newSteps };
      });
    };

    try {
      // Determine host ID based on hostname
      const hostId = config.hostname.includes('139') || config.hostname.includes('alpha') ? 'alpha' : 'beta';

      // Step 1: Test SSH Connection
      setDeploymentStatus(prev => ({ ...prev, currentStepIndex: 0 }));
      updateStep(0, { status: 'running', startTime: Date.now() });
      addLog(0, `Testing SSH connection to ${hostId}...`);
      
      const connResult = await testConnectionMutation.mutateAsync({ hostId });
      
      if (!connResult.success) {
        throw new Error(connResult.error || 'SSH connection failed');
      }
      
      addLog(0, connResult.message || 'Connection established');
      addLog(0, `Latency: ${connResult.latencyMs}ms`);
      updateStep(0, { status: 'completed', endTime: Date.now() });

      // Step 2: Check GPU and Disk Space
      setDeploymentStatus(prev => ({ ...prev, currentStepIndex: 1 }));
      updateStep(1, { status: 'running', startTime: Date.now() });
      addLog(1, 'Checking GPU availability...');
      
      const gpuResult = await checkGPUMutation.mutateAsync({ hostId });
      if (gpuResult.success && gpuResult.available) {
        addLog(1, `Found ${gpuResult.gpuCount} GPU(s): ${gpuResult.gpus?.map(g => g.name).join(', ')}`);
      } else {
        addLog(1, 'No GPU detected (continuing without GPU support)');
      }

      addLog(1, 'Checking disk space...');
      const diskResult = await checkDiskMutation.mutateAsync({ hostId, path: '/opt', requiredGB: 10 });
      if (diskResult.success) {
        addLog(1, `Disk: ${diskResult.availableGB}GB available of ${diskResult.totalGB}GB (${diskResult.usedPercent}% used)`);
        if (!diskResult.available) {
          addLog(1, `Warning: Less than ${diskResult.requiredGB}GB available`);
        }
      }
      updateStep(1, { status: 'completed', endTime: Date.now() });

      // Step 3-6: Start real deployment via backend
      setDeploymentStatus(prev => ({ ...prev, currentStepIndex: 2 }));
      updateStep(2, { status: 'running', startTime: Date.now() });
      addLog(2, 'Initiating deployment on remote host...');

      // Prepare files for upload
      const files = Object.entries(generatedFiles).map(([name, content]) => ({
        name,
        content,
        path: name.includes('compose') || name.includes('Dockerfile') ? '' : 'config',
      }));

      // Prepare environment variables
      const envVars: Record<string, string> = {
        NODE_ENV: 'production',
        PORT: '3000',
      };
      if (config.jwtSecret) envVars.JWT_SECRET = config.jwtSecret;
      if (config.ngcApiKey) envVars.NGC_API_KEY = config.ngcApiKey;
      if (config.huggingfaceToken) envVars.HUGGINGFACE_TOKEN = config.huggingfaceToken;
      if (config.enableVllm) {
        envVars.VLLM_API_URL = `http://localhost:${config.vllmPort}`;
      }

      const deployResult = await startDeploymentMutation.mutateAsync({
        hostId,
        deploymentMethod: config.deploymentMethod,
        config: {
          appName: 'nemo-command-center',
          deployPath: '/opt/nemo-command-center',
          port: 3000,
          enableNginx: config.enableNginx,
          enableSystemd: true,
          envVars,
        },
        files,
      });

      if (!deployResult.success) {
        throw new Error('Failed to start deployment');
      }

      // Store deployment ID for status polling
      setDeploymentStatus(prev => ({
        ...prev,
        deploymentId: deployResult.deploymentId,
      }));

      addLog(2, `Deployment started: ${deployResult.deploymentId}`);
      addLog(2, 'Monitoring deployment progress...');

      // The rest of the deployment will be tracked via the polling query
      // which will update the UI as steps complete on the server

    } catch (error) {
      const currentIdx = deploymentStatus.currentStepIndex;
      updateStep(currentIdx, { status: 'failed', endTime: Date.now() });
      addLog(currentIdx, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      setDeploymentStatus(prev => ({
        ...prev,
        isDeploying: false,
        endTime: Date.now(),
        overallStatus: 'failed',
        error: error instanceof Error ? error.message : 'Deployment failed'
      }));
      toast.error('Deployment failed');
    }
  };

  // Cancel deployment
  const cancelDeployment = async () => {
    if (deploymentStatus.deploymentId) {
      try {
        await cancelDeploymentMutation.mutateAsync({ deploymentId: deploymentStatus.deploymentId });
      } catch (error) {
        console.error('Failed to cancel deployment on server:', error);
      }
    }
    setDeploymentStatus(prev => ({
      ...prev,
      isDeploying: false,
      endTime: Date.now(),
      overallStatus: 'cancelled'
    }));
    toast.warning('Deployment cancelled');
  };

  // Calculate deployment duration
  const getDeploymentDuration = () => {
    if (!deploymentStatus.startTime) return '0s';
    const end = deploymentStatus.endTime || Date.now();
    const duration = Math.round((end - deploymentStatus.startTime) / 1000);
    if (duration < 60) return `${duration}s`;
    return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  };

  // Calculate overall progress
  const getOverallProgress = () => {
    const completed = deploymentStatus.steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / deploymentStatus.steps.length) * 100);
  };

  const nextStep = () => {
    // Validate current step before advancing
    if (stepHasErrors(currentStep)) {
      toast.error("Please fix validation errors before continuing");
      return;
    }
    if (currentStep < 5) {
      // Save current files for diff comparison when entering step 5
      if (currentStep === 4) {
        setPreviousFiles({ ...generatedFiles });
      }
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
        <div className="flex items-center gap-2">
          {selectedPreset && (
            <Badge variant="outline" className="text-purple-400 border-purple-400/50">
              <Sparkles className="w-3 h-3 mr-1" />
              {DEPLOYMENT_PRESETS.find(p => p.id === selectedPreset)?.name} Preset
            </Badge>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={importConfig}
            accept=".json"
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportConfig}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowHistory(!showHistory)}
            className={showHistory ? 'bg-purple-500/20 border-purple-500/50' : ''}
          >
            <History className="w-4 h-4 mr-2" />
            History ({deploymentHistory.length})
          </Button>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
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

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="bg-card/50 border-border/50 mb-6">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  <CardTitle className="text-sm">Deployment History</CardTitle>
                </div>
                {deploymentHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearHistory} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {deploymentHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No deployment history yet. Save configurations to see them here.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {deploymentHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            entry.deploymentMethod === 'ai-workbench' 
                              ? 'bg-blue-500/20 text-blue-400' 
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {entry.deploymentMethod === 'ai-workbench' ? <Cloud className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{entry.summary}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => loadFromHistory(entry)}>
                            <Upload className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteFromHistory(entry.id)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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

                    {/* Quick Start Presets */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Quick Start Presets
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {DEPLOYMENT_PRESETS.map((preset) => {
                          const PresetIcon = preset.icon;
                          const colorClasses = {
                            blue: 'border-blue-500 bg-blue-500/10 text-blue-400',
                            green: 'border-green-500 bg-green-500/10 text-green-400',
                            orange: 'border-orange-500 bg-orange-500/10 text-orange-400',
                            purple: 'border-purple-500 bg-purple-500/10 text-purple-400',
                          };
                          const isSelected = selectedPreset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              onClick={() => applyPreset(preset)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? colorClasses[preset.color as keyof typeof colorClasses]
                                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <PresetIcon className={`w-4 h-4 ${isSelected ? '' : 'text-muted-foreground'}`} />
                                <span className={`text-sm font-medium ${isSelected ? '' : 'text-foreground'}`}>
                                  {preset.name}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {preset.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
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
                            className={errors.hostname ? 'border-red-500' : ''}
                          />
                          {errors.hostname && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.hostname}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>SSH Port</Label>
                            <Input
                              type="number"
                              value={config.sshPort}
                              onChange={(e) => updateConfig('sshPort', parseInt(e.target.value) || 0)}
                              className={errors.sshPort ? 'border-red-500' : ''}
                            />
                            {errors.sshPort && (
                              <p className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.sshPort}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>SSH Username</Label>
                            <Input
                              value={config.sshUsername}
                              onChange={(e) => updateConfig('sshUsername', e.target.value)}
                              placeholder="ubuntu"
                              className={errors.sshUsername ? 'border-red-500' : ''}
                            />
                            {errors.sshUsername && (
                              <p className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.sshUsername}
                              </p>
                            )}
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
                              onChange={(e) => updateConfig('cpuCores', parseInt(e.target.value) || 0)}
                              className={errors.cpuCores ? 'border-red-500' : ''}
                            />
                            {errors.cpuCores && (
                              <p className="text-[10px] text-red-400">{errors.cpuCores}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Memory (GB)</Label>
                            <Input
                              type="number"
                              value={config.memoryGB}
                              onChange={(e) => updateConfig('memoryGB', parseInt(e.target.value) || 0)}
                              className={errors.memoryGB ? 'border-red-500' : ''}
                            />
                            {errors.memoryGB && (
                              <p className="text-[10px] text-red-400">{errors.memoryGB}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Storage (GB)</Label>
                            <Input
                              type="number"
                              value={config.storageGB}
                              onChange={(e) => updateConfig('storageGB', parseInt(e.target.value) || 0)}
                              className={errors.storageGB ? 'border-red-500' : ''}
                            />
                            {errors.storageGB && (
                              <p className="text-[10px] text-red-400">{errors.storageGB}</p>
                            )}
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
                                className={`text-sm ${errors.databasePath ? 'border-red-500' : ''}`}
                              />
                              {errors.databasePath && (
                                <p className="text-[10px] text-red-400">{errors.databasePath}</p>
                              )}
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
                                onChange={(e) => updateConfig('vllmPort', parseInt(e.target.value) || 0)}
                                className={`text-sm ${errors.vllmPort ? 'border-red-500' : ''}`}
                              />
                              {errors.vllmPort && (
                                <p className="text-[10px] text-red-400">{errors.vllmPort}</p>
                              )}
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
                                onChange={(e) => updateConfig('jupyterPort', parseInt(e.target.value) || 0)}
                                className={`text-sm ${errors.jupyterPort ? 'border-red-500' : ''}`}
                              />
                              {errors.jupyterPort && (
                                <p className="text-[10px] text-red-400">{errors.jupyterPort}</p>
                              )}
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
                                className={`text-sm ${errors.domain ? 'border-red-500' : ''}`}
                              />
                              {errors.domain && (
                                <p className="text-[10px] text-red-400">{errors.domain}</p>
                              )}
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
                              className={`font-mono text-xs ${errors.jwtSecret ? 'border-red-500' : ''}`}
                            />
                            <Button variant="outline" onClick={generateJwtSecret}>
                              Generate
                            </Button>
                          </div>
                          {errors.jwtSecret && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.jwtSecret}
                            </p>
                          )}
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={runValidationChecks}
                          disabled={isValidating}
                        >
                          {isValidating ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <PlayCircle className="w-4 h-4 mr-2" />
                          )}
                          Validate
                        </Button>
                        <Button variant="outline" size="sm" onClick={saveToHistory}>
                          <History className="w-4 h-4 mr-2" />
                          Save to History
                        </Button>
                        {Object.keys(previousFiles).length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDiff(!showDiff)}
                            className={showDiff ? 'bg-purple-500/20 border-purple-500/50' : ''}
                          >
                            <GitCompare className="w-4 h-4 mr-2" />
                            {showDiff ? 'Hide Diff' : 'Show Diff'}
                          </Button>
                        )}
                        <Button onClick={downloadAllFiles} className="bg-purple-600 hover:bg-purple-700">
                          <Download className="w-4 h-4 mr-2" />
                          Download All
                        </Button>
                        <Button 
                          onClick={startDeployment} 
                          disabled={deploymentStatus.isDeploying}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {deploymentStatus.isDeploying ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Rocket className="w-4 h-4 mr-2" />
                          )}
                          Deploy Now
                        </Button>
                      </div>
                    </div>

                    {/* Deployment Status Panel */}
                    {(showDeploymentPanel || deploymentStatus.overallStatus !== 'idle') && (
                      <Card className={`border-2 ${
                        deploymentStatus.overallStatus === 'completed' ? 'border-green-500/50 bg-green-500/5' :
                        deploymentStatus.overallStatus === 'failed' ? 'border-red-500/50 bg-red-500/5' :
                        deploymentStatus.overallStatus === 'cancelled' ? 'border-yellow-500/50 bg-yellow-500/5' :
                        'border-blue-500/50 bg-blue-500/5'
                      }`}>
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              {deploymentStatus.overallStatus === 'running' && <Activity className="w-4 h-4 text-blue-400 animate-pulse" />}
                              {deploymentStatus.overallStatus === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                              {deploymentStatus.overallStatus === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                              {deploymentStatus.overallStatus === 'cancelled' && <Ban className="w-4 h-4 text-yellow-400" />}
                              Deployment Status
                              <Badge variant="outline" className={`ml-2 ${
                                deploymentStatus.overallStatus === 'completed' ? 'text-green-400 border-green-400/50' :
                                deploymentStatus.overallStatus === 'failed' ? 'text-red-400 border-red-400/50' :
                                deploymentStatus.overallStatus === 'cancelled' ? 'text-yellow-400 border-yellow-400/50' :
                                'text-blue-400 border-blue-400/50'
                              }`}>
                                {deploymentStatus.overallStatus === 'running' ? `${getOverallProgress()}%` : deploymentStatus.overallStatus}
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {getDeploymentDuration()}
                              </span>
                              {deploymentStatus.isDeploying && (
                                <Button variant="ghost" size="sm" onClick={cancelDeployment} className="text-red-400 hover:text-red-300">
                                  <StopCircle className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              )}
                              {deploymentStatus.overallStatus !== 'idle' && !deploymentStatus.isDeploying && (
                                <Button variant="ghost" size="sm" onClick={() => setShowDeploymentPanel(false)}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {/* Progress bar */}
                          {deploymentStatus.isDeploying && (
                            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${getOverallProgress()}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="space-y-2">
                            {deploymentStatus.steps.map((step, idx) => (
                              <div key={step.id} className="border border-border/50 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setExpandedLogs(expandedLogs === step.id ? null : step.id)}
                                  className={`w-full flex items-center justify-between p-3 transition-colors ${
                                    step.status === 'running' ? 'bg-blue-500/10' :
                                    step.status === 'completed' ? 'bg-green-500/5' :
                                    step.status === 'failed' ? 'bg-red-500/5' :
                                    'bg-muted/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-full ${
                                      step.status === 'running' ? 'bg-blue-500/20' :
                                      step.status === 'completed' ? 'bg-green-500/20' :
                                      step.status === 'failed' ? 'bg-red-500/20' :
                                      'bg-muted/30'
                                    }`}>
                                      {step.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                                      {step.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                      {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                                      {step.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground" />}
                                      {step.status === 'skipped' && <Ban className="w-4 h-4 text-yellow-400" />}
                                    </div>
                                    <div className="text-left">
                                      <p className="text-sm font-medium">{step.name}</p>
                                      <p className="text-xs text-muted-foreground">{step.description}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {step.progress !== undefined && step.status === 'running' && (
                                      <span className="text-xs text-blue-400">{step.progress}%</span>
                                    )}
                                    {step.startTime && step.endTime && (
                                      <span className="text-xs text-muted-foreground">
                                        {Math.round((step.endTime - step.startTime) / 1000)}s
                                      </span>
                                    )}
                                    {step.logs.length > 0 && (
                                      expandedLogs === step.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                  </div>
                                </button>
                                <AnimatePresence>
                                  {expandedLogs === step.id && step.logs.length > 0 && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-3 bg-black/50 border-t border-border/50 max-h-[150px] overflow-y-auto">
                                        <pre className="text-xs font-mono space-y-1">
                                          {step.logs.map((log, logIdx) => (
                                            <div key={logIdx} className="text-muted-foreground">
                                              {log}
                                            </div>
                                          ))}
                                        </pre>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ))}
                          </div>
                          
                          {/* Completion summary */}
                          {deploymentStatus.overallStatus === 'completed' && (
                            <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                              <h4 className="text-sm font-medium text-green-400 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Deployment Successful!
                              </h4>
                              <p className="text-xs text-muted-foreground mt-2">
                                Your application is now running at <span className="text-green-400 font-mono">http://{config.hostname}:3000</span>
                              </p>
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" variant="outline" className="text-green-400 border-green-400/50">
                                  <Wifi className="w-3 h-3 mr-1" />
                                  Open App
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Terminal className="w-3 h-3 mr-1" />
                                  View Logs
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {deploymentStatus.overallStatus === 'failed' && (
                            <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                              <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Deployment Failed
                              </h4>
                              <p className="text-xs text-muted-foreground mt-2">
                                {deploymentStatus.error || 'An error occurred during deployment'}
                              </p>
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" variant="outline" onClick={startDeployment} className="text-blue-400 border-blue-400/50">
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Retry
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Pre-flight Validation Panel */}
                    {validationChecks.length > 0 && (
                      <Card className="bg-muted/30 border-border/50">
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-400" />
                            Pre-flight Validation
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {validationChecks.map((check, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border ${
                                  check.status === 'passed' ? 'bg-green-500/10 border-green-500/30' :
                                  check.status === 'failed' ? 'bg-red-500/10 border-red-500/30' :
                                  check.status === 'running' ? 'bg-blue-500/10 border-blue-500/30' :
                                  'bg-muted/30 border-border/50'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {check.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  {check.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                                  {check.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                                  {check.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground" />}
                                  <span className="text-xs font-medium">{check.name}</span>
                                </div>
                                {check.message && (
                                  <p className="text-[10px] text-muted-foreground ml-6">{check.message}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid gap-4">
                      <Tabs defaultValue={Object.keys(generatedFiles)[0]} className="w-full">
                        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
                          {Object.keys(generatedFiles).map((filename) => {
                            const hasChanges = previousFiles[filename] && previousFiles[filename] !== generatedFiles[filename];
                            return (
                              <TabsTrigger
                                key={filename}
                                value={filename}
                                className={`text-xs px-3 py-1.5 ${hasChanges ? 'ring-1 ring-yellow-500/50' : ''}`}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                {filename}
                                {hasChanges && <span className="ml-1 w-2 h-2 rounded-full bg-yellow-500" />}
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>
                        {Object.entries(generatedFiles).map(([filename, content]) => {
                          const previousContent = previousFiles[filename] || '';
                          const hasChanges = previousContent && previousContent !== content;
                          const diffLines = hasChanges ? calculateDiff(previousContent, content) : [];
                          
                          return (
                            <TabsContent key={filename} value={filename} className="mt-4">
                              <Card className="bg-muted/30 border-border/50">
                                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <FileCode className="w-4 h-4 text-purple-400" />
                                    <span className="font-mono text-sm">{filename}</span>
                                    {hasChanges && (
                                      <Badge variant="outline" className="text-yellow-400 border-yellow-400/50 text-[10px]">
                                        Modified
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {hasChanges && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowDiff(!showDiff)}
                                        className="text-xs"
                                      >
                                        {showDiff ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </Button>
                                    )}
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
                                  </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                  {showDiff && hasChanges ? (
                                    <pre className="p-4 overflow-x-auto text-xs font-mono bg-black/30 rounded-b-lg max-h-[400px] overflow-y-auto">
                                      <code>
                                        {diffLines.map((line, idx) => (
                                          <div
                                            key={idx}
                                            className={`${
                                              line.type === 'added' ? 'bg-green-500/20 text-green-300' :
                                              line.type === 'removed' ? 'bg-red-500/20 text-red-300' :
                                              ''
                                            }`}
                                          >
                                            <span className="inline-block w-8 text-right pr-2 text-muted-foreground select-none">
                                              {line.lineNumber}
                                            </span>
                                            <span className="inline-block w-4 text-center select-none">
                                              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                                            </span>
                                            {line.content}
                                          </div>
                                        ))}
                                      </code>
                                    </pre>
                                  ) : (
                                    <pre className="p-4 overflow-x-auto text-xs font-mono bg-black/30 rounded-b-lg max-h-[400px] overflow-y-auto">
                                      <code>{content}</code>
                                    </pre>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>
                          );
                        })}
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
