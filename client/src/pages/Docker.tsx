import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Container,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Download,
  RefreshCw,
  Server,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Box,
  Network,
  GitBranch,
  X,
  Upload,
  Rocket,
  Zap,
  Sparkles,
  Terminal,
  Send,
  ScrollText,
  Plus,
  HardDrive,
  Link,
  Unlink,
  Info,
  Settings,
  MessageSquare,
  Beaker,
  Cpu,
  BarChart3,
  Copy,
  Clock,
  History,
} from "lucide-react";
import { toast } from "sonner";

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports?: string;
  created?: string;
  state?: string;
}

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  createdAt: string;
  fullName: string;
}

// NVIDIA AI Workshop compose templates
const NVIDIA_WORKSHOP_TEMPLATES = [
  {
    id: "nim-llm",
    name: "NIM LLM Inference",
    description: "Deploy NVIDIA NIM for large language model inference with optimized performance",
    icon: Zap,
    compose: `version: '3.8'
services:
  nim-llm:
    image: nvcr.io/nim/meta/llama-3.1-8b-instruct:latest
    runtime: nvidia
    environment:
      - NGC_API_KEY=\${NGC_API_KEY}
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
`,
    envVars: ["NGC_API_KEY"],
  },
  {
    id: "nemo-curator",
    name: "NeMo Curator",
    description: "Data curation pipeline for training high-quality AI models",
    icon: Sparkles,
    compose: `version: '3.8'
services:
  nemo-curator:
    image: nvcr.io/nvidia/nemo:24.05
    runtime: nvidia
    volumes:
      - ./data:/workspace/data
    command: python -m nemo_curator.scripts.main
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
`,
    envVars: [],
  },
  {
    id: "triton-server",
    name: "Triton Inference Server",
    description: "High-performance inference serving for any AI model",
    icon: Rocket,
    compose: `version: '3.8'
services:
  triton:
    image: nvcr.io/nvidia/tritonserver:24.05-py3
    runtime: nvidia
    ports:
      - "8000:8000"
      - "8001:8001"
      - "8002:8002"
    volumes:
      - ./models:/models
    command: tritonserver --model-repository=/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
`,
    envVars: [],
  },
  {
    id: "rag-pipeline",
    name: "RAG Pipeline",
    description: "Retrieval-Augmented Generation with vector database and LLM",
    icon: Network,
    compose: `version: '3.8'
services:
  milvus:
    image: milvusdb/milvus:v2.4.0
    ports:
      - "19530:19530"
    volumes:
      - ./milvus_data:/var/lib/milvus
    environment:
      - ETCD_USE_EMBED=true
      
  rag-service:
    image: nvcr.io/nvidia/nemo:24.05
    runtime: nvidia
    depends_on:
      - milvus
    environment:
      - MILVUS_HOST=milvus
      - NGC_API_KEY=\${NGC_API_KEY}
    ports:
      - "8080:8080"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
`,
    envVars: ["NGC_API_KEY"],
  },
];

export default function Docker() {
  const [selectedHost, setSelectedHost] = useState<"alpha" | "beta">("alpha");
  const [pullImageTag, setPullImageTag] = useState("");
  const [pullTargetHost, setPullTargetHost] = useState<"alpha" | "beta" | "both">("alpha");
  const [isPulling, setIsPulling] = useState(false);
  const [isPullingPlaybook, setIsPullingPlaybook] = useState(false);
  const [playbookHost, setPlaybookHost] = useState<"alpha" | "beta">("alpha");
  
  // Logs modal state
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Compose modal state
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeContent, setComposeContent] = useState("");
  const [composeProjectName, setComposeProjectName] = useState("");
  const [composeEnvVars, setComposeEnvVars] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<typeof NVIDIA_WORKSHOP_TEMPLATES[0] | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  // Exec terminal state
  const [execModalOpen, setExecModalOpen] = useState(false);
  const [execContainer, setExecContainer] = useState<ContainerInfo | null>(null);
  const [execCommand, setExecCommand] = useState("");
  const [execHistory, setExecHistory] = useState<Array<{ command: string; output: string; timestamp: Date }>>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const execEndRef = useRef<HTMLDivElement>(null);

  // Image pull progress state
  const [pullProgressModalOpen, setPullProgressModalOpen] = useState(false);
  const [activePull, setActivePull] = useState<{ pullId: string; logFile: string; imageName: string; hostId: "alpha" | "beta" } | null>(null);

  // Compose logs state
  const [composeLogsModalOpen, setComposeLogsModalOpen] = useState(false);
  const [selectedComposeProject, setSelectedComposeProject] = useState<string | null>(null);
  const [composeLogsAutoRefresh, setComposeLogsAutoRefresh] = useState(true);
  const composeLogsEndRef = useRef<HTMLDivElement>(null);

  // Container list query
  const { data: containerData, refetch: refetchContainers, isLoading: isLoadingContainers } = trpc.ssh.listAllContainers.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 10000 }
  );

  // Docker images query
  const { data: imagesData, refetch: refetchImages, isLoading: isLoadingImages } = trpc.ssh.listDockerImages.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 30000 }
  );

  // Compose projects query
  const { data: composeData, refetch: refetchCompose } = trpc.ssh.listComposeProjects.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 15000 }
  );

  // K8s status query
  const { data: k8sStatus, isLoading: isLoadingK8s } = trpc.ssh.getKubernetesStatus.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 30000 }
  );

  // Container logs query
  const { data: logsData, refetch: refetchLogs, isLoading: isLoadingLogs } = trpc.ssh.getContainerLogs.useQuery(
    { hostId: selectedHost, containerId: selectedContainer?.id || "", tail: 200 },
    { 
      enabled: logsModalOpen && !!selectedContainer,
      refetchInterval: autoRefreshLogs ? 3000 : false,
    }
  );

  // Image pull progress query
  const { data: pullProgressData, refetch: refetchPullProgress } = trpc.ssh.getImagePullProgress.useQuery(
    { 
      hostId: activePull?.hostId || "alpha", 
      logFile: activePull?.logFile || "", 
      imageName: activePull?.imageName || "" 
    },
    { 
      enabled: pullProgressModalOpen && !!activePull,
      refetchInterval: activePull ? 2000 : false,
    }
  );

  // Compose stack logs query
  const { data: composeLogsData, refetch: refetchComposeLogs, isLoading: isLoadingComposeLogs } = trpc.ssh.getComposeStackLogs.useQuery(
    { hostId: selectedHost, projectName: selectedComposeProject || "", tail: 200 },
    { 
      enabled: composeLogsModalOpen && !!selectedComposeProject,
      refetchInterval: composeLogsAutoRefresh ? 3000 : false,
    }
  );

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current && logsData?.logs) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData?.logs]);

  // Auto-scroll exec history
  useEffect(() => {
    if (execEndRef.current) {
      execEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [execHistory]);

  // Auto-scroll compose logs
  useEffect(() => {
    if (composeLogsEndRef.current && composeLogsData?.logs) {
      composeLogsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [composeLogsData?.logs]);

  // Close pull progress modal when complete
  useEffect(() => {
    if (pullProgressData?.status === 'completed' && pullProgressData?.progress === 100) {
      toast.success(`Image ${activePull?.imageName} pulled successfully`);
      refetchImages();
      setTimeout(() => {
        setPullProgressModalOpen(false);
        setActivePull(null);
      }, 2000);
    } else if (pullProgressData?.status === 'error') {
      toast.error(`Failed to pull image`);
    }
  }, [pullProgressData?.status, pullProgressData?.progress]);

  // Container mutations
  const startContainerMutation = trpc.ssh.startContainer.useMutation({
    onSuccess: () => {
      toast.success("Container started");
      refetchContainers();
    },
    onError: (err) => toast.error(`Failed to start: ${err.message}`),
  });

  const stopContainerMutation = trpc.ssh.stopContainer.useMutation({
    onSuccess: () => {
      toast.success("Container stopped");
      refetchContainers();
    },
    onError: (err) => toast.error(`Failed to stop: ${err.message}`),
  });

  const restartContainerMutation = trpc.ssh.restartContainer.useMutation({
    onSuccess: () => {
      toast.success("Container restarted");
      refetchContainers();
    },
    onError: (err) => toast.error(`Failed to restart: ${err.message}`),
  });

  const removeContainerMutation = trpc.ssh.removeContainer.useMutation({
    onSuccess: () => {
      toast.success("Container removed");
      refetchContainers();
    },
    onError: (err) => toast.error(`Failed to remove: ${err.message}`),
  });

  const pullImageMutation = trpc.ssh.pullDockerImage.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Image pulled successfully`);
        refetchImages();
      } else {
        toast.error(data.error || "Failed to pull image");
      }
      setIsPulling(false);
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
      setIsPulling(false);
    },
  });

  const deleteImageMutation = trpc.ssh.deleteDockerImage.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Image deleted");
        refetchImages();
      } else {
        toast.error(data.error || "Failed to delete image");
      }
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const pullPlaybookMutation = trpc.ssh.pullPlaybookImages.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Found ${data.images?.length || 0} images to pull`);
      } else {
        toast.error(data.error || "Failed to pull playbook images");
      }
      setIsPullingPlaybook(false);
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
      setIsPullingPlaybook(false);
    },
  });

  const deployComposeMutation = trpc.ssh.deployComposeStack.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Stack deployed successfully`);
        setComposeModalOpen(false);
        refetchCompose();
        refetchContainers();
      } else {
        toast.error(data.error || "Failed to deploy stack");
      }
      setIsDeploying(false);
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
      setIsDeploying(false);
    },
  });

  const stopComposeMutation = trpc.ssh.stopComposeStack.useMutation({
    onSuccess: () => {
      toast.success("Stack stopped");
      refetchCompose();
      refetchContainers();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Start image pull with progress tracking
  const startPullMutation = trpc.ssh.startImagePull.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setActivePull({
          pullId: data.pullId,
          logFile: data.logFile,
          imageName: data.imageName,
          hostId: pullTargetHost === "both" ? "alpha" : pullTargetHost,
        });
        setPullProgressModalOpen(true);
        setIsPulling(false);
      } else {
        toast.error(data.error || "Failed to start image pull");
        setIsPulling(false);
      }
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
      setIsPulling(false);
    },
  });

  // Exec command in container
  const execCommandMutation = trpc.ssh.execContainerCommand.useMutation({
    onSuccess: (data) => {
      setExecHistory(prev => [...prev, {
        command: execCommand,
        output: data.output || (data.success ? 'Command executed successfully' : 'Command failed'),
        timestamp: new Date(),
      }]);
      setExecCommand("");
      setIsExecuting(false);
    },
    onError: (err) => {
      setExecHistory(prev => [...prev, {
        command: execCommand,
        output: `Error: ${err.message}`,
        timestamp: new Date(),
      }]);
      setExecCommand("");
      setIsExecuting(false);
    },
  });

  const handlePullImage = () => {
    if (!pullImageTag) return;
    setIsPulling(true);
    // Use the new progress-tracking pull
    startPullMutation.mutate({ hostId: pullTargetHost === "both" ? "alpha" : pullTargetHost, imageName: pullImageTag });
  };

  const handlePullPlaybookImages = () => {
    setIsPullingPlaybook(true);
    pullPlaybookMutation.mutate({ hostId: playbookHost });
  };

  const handleOpenLogs = (container: ContainerInfo) => {
    setSelectedContainer(container);
    setLogsModalOpen(true);
  };

  const handleOpenExec = (container: ContainerInfo) => {
    setExecContainer(container);
    setExecHistory([]);
    setExecCommand("");
    setExecModalOpen(true);
  };

  const handleExecCommand = () => {
    if (!execCommand.trim() || !execContainer) return;
    setIsExecuting(true);
    execCommandMutation.mutate({
      hostId: selectedHost,
      containerId: execContainer.id,
      command: execCommand,
    });
  };

  const handleOpenComposeLogs = (projectName: string) => {
    setSelectedComposeProject(projectName);
    setComposeLogsModalOpen(true);
  };

  const handleSelectTemplate = (template: typeof NVIDIA_WORKSHOP_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setComposeContent(template.compose);
    setComposeProjectName(template.id);
    const envVars: Record<string, string> = {};
    template.envVars.forEach(v => { envVars[v] = ""; });
    setComposeEnvVars(envVars);
    setComposeModalOpen(true);
  };

  const handleDeployCompose = () => {
    if (!composeProjectName || !composeContent) {
      toast.error("Project name and compose content required");
      return;
    }
    setIsDeploying(true);
    deployComposeMutation.mutate({
      hostId: selectedHost,
      projectName: composeProjectName,
      composeContent,
      envVars: Object.keys(composeEnvVars).length > 0 ? composeEnvVars : undefined,
    });
  };

  const runningContainers = containerData?.running || [];
  const stoppedContainers = containerData?.stopped || [];
  const images = imagesData?.images || [];
  const composeProjects = composeData?.projects || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#3b82f6]/20">
              <Container className="h-8 w-8 text-[#3b82f6]" />
            </div>
            Docker & Kubernetes
          </h1>
          <p className="text-muted-foreground mt-1">
            Container orchestration and management for DGX Spark hosts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedHost}
            onChange={(e) => setSelectedHost(e.target.value as "alpha" | "beta")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium"
          >
            <option value="alpha">DGX Spark Alpha</option>
            <option value="beta">DGX Spark Beta</option>
          </select>
          <Button
            variant="outline"
            onClick={() => {
              refetchContainers();
              refetchImages();
              refetchCompose();
            }}
            disabled={isLoadingContainers}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingContainers ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="containers" className="space-y-6">
        <TabsList className="bg-black/40 border border-gray-800">
          <TabsTrigger value="containers" className="gap-2">
            <Box className="h-4 w-4" />
            Containers
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <Layers className="h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-2">
            <Upload className="h-4 w-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="networks" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Networks
          </TabsTrigger>
          <TabsTrigger value="volumes" className="gap-2">
            <Server className="h-4 w-4" />
            Volumes
          </TabsTrigger>
          <TabsTrigger value="kubernetes" className="gap-2">
            <Network className="h-4 w-4" />
            Kubernetes
          </TabsTrigger>
          <TabsTrigger value="quicklaunch" className="gap-2">
            <Rocket className="h-4 w-4" />
            Quick Launch
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Containers Tab */}
        <TabsContent value="containers" className="space-y-6">
          {/* Running Containers */}
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5 text-blue-500" />
                    Running Containers
                    <Badge variant="outline" className="ml-2 border-blue-500 text-blue-500">
                      {runningContainers.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Active containers on {selectedHost === 'alpha' ? 'DGX Spark Alpha' : 'DGX Spark Beta'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingContainers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
                </div>
              ) : runningContainers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Container className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No running containers</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {runningContainers.map((container: ContainerInfo) => (
                    <div
                      key={container.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-blue-500/20">
                          <Container className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{container.name}</p>
                          <p className="text-xs text-gray-400">{container.image}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-blue-500 text-blue-500">
                          {container.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenLogs(container)}
                          title="View Logs"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenExec(container)}
                          title="Terminal"
                          className="text-cyan-500 hover:text-cyan-400"
                        >
                          <Terminal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-yellow-500 hover:text-yellow-400"
                          onClick={() => stopContainerMutation.mutate({ hostId: selectedHost, containerId: container.id })}
                          title="Stop"
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-500 hover:text-blue-400"
                          onClick={() => restartContainerMutation.mutate({ hostId: selectedHost, containerId: container.id })}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stopped Containers */}
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Square className="h-5 w-5 text-gray-500" />
                Stopped Containers
                <Badge variant="outline" className="ml-2 border-gray-500 text-gray-500">
                  {stoppedContainers.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Inactive containers available to start or remove
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stoppedContainers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No stopped containers</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {stoppedContainers.map((container: ContainerInfo) => (
                    <div
                      key={container.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-gray-500/20">
                          <Container className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{container.name}</p>
                          <p className="text-xs text-gray-400">{container.image}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-gray-600 text-gray-400">
                          Exited
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-500 hover:text-blue-400"
                          onClick={() => startContainerMutation.mutate({ hostId: selectedHost, containerId: container.id })}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-400"
                          onClick={() => {
                            if (confirm(`Remove container ${container.name}?`)) {
                              removeContainerMutation.mutate({ hostId: selectedHost, containerId: container.id, force: true });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-6">
          {/* Pull Image */}
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-[#3b82f6]" />
                Pull Container Image
              </CardTitle>
              <CardDescription>
                Pull a Docker image from NGC or Docker Hub
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="nvcr.io/nvidia/pytorch:24.01-py3"
                  value={pullImageTag}
                  onChange={(e) => setPullImageTag(e.target.value)}
                  className="flex-1 bg-black/30 border-gray-700"
                />
                <select
                  value={pullTargetHost}
                  onChange={(e) => setPullTargetHost(e.target.value as "alpha" | "beta" | "both")}
                  className="h-10 rounded-md border border-gray-700 bg-black/30 px-3 text-sm"
                >
                  <option value="alpha">DGX Spark Alpha</option>
                  <option value="beta">DGX Spark Beta</option>
                  <option value="both">Both Hosts</option>
                </select>
                <Button
                  className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                  disabled={!pullImageTag || isPulling}
                  onClick={handlePullImage}
                >
                  {isPulling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Pull Image
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Image List */}
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-[#3b82f6]" />
                    Local Images
                    <Badge variant="outline" className="ml-2">
                      {images.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Docker images available on {selectedHost === 'alpha' ? 'DGX Spark Alpha' : 'DGX Spark Beta'}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchImages()}>
                  <RefreshCw className={`h-4 w-4 ${isLoadingImages ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingImages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No images found</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {images.map((image: DockerImage) => (
                    <div
                      key={image.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded bg-[#3b82f6]/20">
                          <Layers className="h-4 w-4 text-[#3b82f6]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white truncate">{image.repository}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Badge variant="outline" className="text-xs">{image.tag}</Badge>
                            <span>{image.size}</span>
                            <span className="truncate">{image.id.substring(0, 12)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-400"
                        onClick={() => {
                          if (confirm(`Delete image ${image.fullName}?`)) {
                            deleteImageMutation.mutate({ hostId: selectedHost, imageId: image.id, force: true });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* DGX Spark Playbook Images */}
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-[#3b82f6]" />
                DGX Spark Playbook Images
              </CardTitle>
              <CardDescription>
                Pull all container images referenced in NVIDIA dgx-spark-playbooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-black/30 border border-gray-800">
                <div className="flex items-start gap-3 mb-4">
                  <Server className="h-5 w-5 text-[#3b82f6] mt-0.5" />
                  <div>
                    <p className="font-medium text-white">Automated Image Pull</p>
                    <p className="text-sm text-gray-400">
                      This will clone the dgx-spark-playbooks repository, extract all container image references, and pull them to the selected host.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={playbookHost}
                    onChange={(e) => setPlaybookHost(e.target.value as "alpha" | "beta")}
                    className="h-10 rounded-md border border-gray-700 bg-black/30 px-3 text-sm"
                  >
                    <option value="alpha">DGX Spark Alpha</option>
                    <option value="beta">DGX Spark Beta</option>
                  </select>
                  <Button
                    variant="outline"
                    onClick={handlePullPlaybookImages}
                    disabled={isPullingPlaybook}
                    className="border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10"
                  >
                    {isPullingPlaybook ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Pull All Playbook Images
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6">
          {/* NVIDIA AI Workshop Templates */}
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#3b82f6]" />
                NVIDIA AI Workshop Templates
              </CardTitle>
              <CardDescription>
                Pre-configured Docker Compose stacks for common AI workloads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {NVIDIA_WORKSHOP_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <div
                      key={template.id}
                      className="p-4 rounded-lg bg-black/30 border border-gray-800 hover:border-[#3b82f6] transition-colors cursor-pointer group"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded bg-[#3b82f6]/20 group-hover:bg-[#3b82f6]/30 transition-colors">
                          <Icon className="h-5 w-5 text-[#3b82f6]" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{template.name}</p>
                          <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Active Compose Projects */}
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-[#3b82f6]" />
                    Active Compose Projects
                    <Badge variant="outline" className="ml-2">
                      {composeProjects.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Running Docker Compose stacks
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setComposeContent("");
                    setComposeProjectName("");
                    setComposeEnvVars({});
                    setComposeModalOpen(true);
                  }}
                  className="border-[#3b82f6] text-[#3b82f6]"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Deploy Custom Stack
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {composeProjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Upload className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active compose projects</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {composeProjects.map((project) => (
                    <div
                      key={project.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-[#3b82f6]/20">
                          <Upload className="h-4 w-4 text-[#3b82f6]" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{project.name}</p>
                          <p className="text-xs text-gray-400">{project.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenComposeLogs(project.name)}
                          title="View Logs"
                        >
                          <ScrollText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-400"
                          title="Stop Stack"
                          onClick={() => {
                            if (confirm(`Stop and remove stack ${project.name}?`)) {
                              stopComposeMutation.mutate({ hostId: selectedHost, projectName: project.name });
                            }
                          }}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Networks Tab */}
        <TabsContent value="networks" className="space-y-6">
          <NetworksTab selectedHost={selectedHost} />
        </TabsContent>

        {/* Volumes Tab */}
        <TabsContent value="volumes" className="space-y-6">
          <VolumesTab selectedHost={selectedHost} />
        </TabsContent>

        {/* Kubernetes Tab */}
        <TabsContent value="kubernetes" className="space-y-6">
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-[#3b82f6]" />
                    Kubernetes Cluster
                  </CardTitle>
                  <CardDescription>
                    Kubernetes cluster status and management
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={k8sStatus?.connected ? "border-blue-500 text-blue-500" : "border-gray-500 text-gray-500"}
                >
                  {k8sStatus?.connected ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not Configured
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingK8s ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
                </div>
              ) : k8sStatus?.connected ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-black/30 border border-gray-800">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Server className="h-4 w-4" />
                        <span className="text-sm">Nodes</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{k8sStatus.nodes || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-black/30 border border-gray-800">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Box className="h-4 w-4" />
                        <span className="text-sm">Pods</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{k8sStatus.pods || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-black/30 border border-gray-800">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Network className="h-4 w-4" />
                        <span className="text-sm">Services</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{k8sStatus.services || 0}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Network className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-lg font-medium text-white mb-2">Kubernetes is not configured on this cluster</h3>
                  <p className="text-gray-400 mb-6">
                    Deploy K8s using NVIDIA GPU Operator for container orchestration.
                  </p>
                  <Button variant="outline" className="border-[#3b82f6] text-[#3b82f6]">
                    View Setup Guide
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Launch Tab */}
        <TabsContent value="quicklaunch" className="space-y-6">
          <QuickLaunchTab selectedHost={selectedHost} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <HistoryTab selectedHost={selectedHost} />
        </TabsContent>
      </Tabs>

      {/* Container Logs Modal */}
      <Dialog open={logsModalOpen} onOpenChange={setLogsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#3b82f6]" />
              Container Logs: {selectedContainer?.name}
            </DialogTitle>
            <DialogDescription>
              Real-time logs from {selectedContainer?.image}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button
                variant={autoRefreshLogs ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                className={autoRefreshLogs ? "bg-[#3b82f6]" : ""}
              >
                {autoRefreshLogs ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                <RefreshCw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="bg-black rounded-lg border border-gray-800 p-4 h-[400px] overflow-y-auto font-mono text-sm">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
              </div>
            ) : logsData?.logs ? (
              <pre className="whitespace-pre-wrap text-gray-300">{logsData.logs}</pre>
            ) : (
              <p className="text-gray-500">No logs available</p>
            )}
            <div ref={logsEndRef} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Deploy Modal */}
      <Dialog open={composeModalOpen} onOpenChange={setComposeModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-black/95 border-gray-800 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#3b82f6]" />
              {selectedTemplate ? `Deploy ${selectedTemplate.name}` : "Deploy Docker Compose Stack"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description || "Configure and deploy a Docker Compose stack"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Project Name</label>
              <Input
                value={composeProjectName}
                onChange={(e) => setComposeProjectName(e.target.value)}
                placeholder="my-project"
                className="mt-1 bg-black/30 border-gray-700"
              />
            </div>
            
            {selectedTemplate && selectedTemplate.envVars.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Environment Variables</label>
                {selectedTemplate.envVars.map((envVar) => (
                  <div key={envVar}>
                    <label className="text-xs text-gray-400">{envVar}</label>
                    <Input
                      value={composeEnvVars[envVar] || ""}
                      onChange={(e) => setComposeEnvVars({ ...composeEnvVars, [envVar]: e.target.value })}
                      placeholder={`Enter ${envVar}`}
                      className="mt-1 bg-black/30 border-gray-700"
                      type={envVar.includes("KEY") || envVar.includes("SECRET") ? "password" : "text"}
                    />
                  </div>
                ))}
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-gray-300">Docker Compose Content</label>
              <Textarea
                value={composeContent}
                onChange={(e) => setComposeContent(e.target.value)}
                placeholder="version: '3.8'&#10;services:&#10;  ..."
                className="mt-1 bg-black/30 border-gray-700 font-mono text-sm h-64"
              />
            </div>
            
            <div className="flex items-center justify-between pt-4">
              <select
                value={selectedHost}
                onChange={(e) => setSelectedHost(e.target.value as "alpha" | "beta")}
                className="h-10 rounded-md border border-gray-700 bg-black/30 px-3 text-sm"
              >
                <option value="alpha">Deploy to Alpha</option>
                <option value="beta">Deploy to Beta</option>
              </select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setComposeModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                  onClick={handleDeployCompose}
                  disabled={isDeploying || !composeProjectName || !composeContent}
                >
                  {isDeploying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4 mr-2" />
                  )}
                  Deploy Stack
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exec Terminal Modal */}
      <Dialog open={execModalOpen} onOpenChange={setExecModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-cyan-500" />
              Terminal: {execContainer?.name}
            </DialogTitle>
            <DialogDescription>
              Execute commands in {execContainer?.image}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-black rounded-lg border border-gray-800 p-4 h-[300px] overflow-y-auto font-mono text-sm">
            {execHistory.length === 0 ? (
              <p className="text-gray-500">Type a command below to execute in the container...</p>
            ) : (
              execHistory.map((entry, idx) => (
                <div key={idx} className="mb-4">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <span className="text-gray-500">$</span>
                    <span>{entry.command}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-gray-300 mt-1 ml-4">{entry.output}</pre>
                </div>
              ))
            )}
            <div ref={execEndRef} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                value={execCommand}
                onChange={(e) => setExecCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isExecuting) {
                    handleExecCommand();
                  }
                }}
                placeholder="ls -la, cat /etc/os-release, nvidia-smi..."
                className="pl-7 bg-black/30 border-gray-700 font-mono"
                disabled={isExecuting}
              />
            </div>
            <Button
              onClick={handleExecCommand}
              disabled={isExecuting || !execCommand.trim()}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            Common commands: <code className="bg-gray-800 px-1 rounded">ls</code>, <code className="bg-gray-800 px-1 rounded">pwd</code>, <code className="bg-gray-800 px-1 rounded">cat</code>, <code className="bg-gray-800 px-1 rounded">nvidia-smi</code>, <code className="bg-gray-800 px-1 rounded">python --version</code>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Pull Progress Modal */}
      <Dialog open={pullProgressModalOpen} onOpenChange={(open) => {
        if (!open && pullProgressData?.status !== 'completed') {
          // Don't close if still pulling - user can dismiss after completion
        }
        setPullProgressModalOpen(open);
      }}>
        <DialogContent className="max-w-2xl bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-[#3b82f6]" />
              Pulling Image
            </DialogTitle>
            <DialogDescription>
              {activePull?.imageName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Progress</span>
                <span className="text-[#3b82f6] font-medium">{pullProgressData?.progress || 0}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#3b82f6] to-[#9be22d] transition-all duration-500"
                  style={{ width: `${pullProgressData?.progress || 0}%` }}
                />
              </div>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2">
              {pullProgressData?.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              ) : pullProgressData?.status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-[#3b82f6]" />
              )}
              <span className={`font-medium ${
                pullProgressData?.status === 'completed' ? 'text-blue-500' :
                pullProgressData?.status === 'error' ? 'text-red-500' : 'text-[#3b82f6]'
              }`}>
                {pullProgressData?.status === 'completed' ? 'Download Complete' :
                 pullProgressData?.status === 'error' ? 'Download Failed' : 'Downloading...'}
              </span>
            </div>
            
            {/* Log Output */}
            <div className="bg-black rounded-lg border border-gray-800 p-3 h-[200px] overflow-y-auto font-mono text-xs">
              <pre className="whitespace-pre-wrap text-gray-400">
                {pullProgressData?.output || 'Waiting for pull to start...'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Stack Logs Modal */}
      <Dialog open={composeLogsModalOpen} onOpenChange={setComposeLogsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-[#3b82f6]" />
              Stack Logs: {selectedComposeProject}
            </DialogTitle>
            <DialogDescription>
              Aggregated logs from all services in the compose stack
              {composeLogsData?.services && composeLogsData.services.length > 0 && (
                <span className="ml-2">
                  Services: {composeLogsData.services.join(', ')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button
                variant={composeLogsAutoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setComposeLogsAutoRefresh(!composeLogsAutoRefresh)}
                className={composeLogsAutoRefresh ? "bg-[#3b82f6]" : ""}
              >
                {composeLogsAutoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchComposeLogs()}>
                <RefreshCw className={`h-4 w-4 ${isLoadingComposeLogs ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="bg-black rounded-lg border border-gray-800 p-4 h-[400px] overflow-y-auto font-mono text-sm">
            {isLoadingComposeLogs ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
              </div>
            ) : composeLogsData?.logs ? (
              <pre className="whitespace-pre-wrap text-gray-300">{composeLogsData.logs}</pre>
            ) : (
              <p className="text-gray-500">No logs available</p>
            )}
            <div ref={composeLogsEndRef} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Networks Tab Component
function NetworksTab({ selectedHost }: { selectedHost: "alpha" | "beta" }) {
  const [createNetworkOpen, setCreateNetworkOpen] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDriver, setNewNetworkDriver] = useState<"bridge" | "host" | "overlay" | "macvlan" | "none">("bridge");
  const [newNetworkSubnet, setNewNetworkSubnet] = useState("");
  const [newNetworkGateway, setNewNetworkGateway] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [connectContainerOpen, setConnectContainerOpen] = useState(false);
  const [connectContainerId, setConnectContainerId] = useState("");

  const { data: networksData, refetch: refetchNetworks, isLoading } = trpc.ssh.listNetworks.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 30000 }
  );

  const { data: networkDetails, isLoading: isLoadingDetails } = trpc.ssh.getNetworkDetails.useQuery(
    { hostId: selectedHost, networkId: selectedNetwork || "" },
    { enabled: !!selectedNetwork }
  );

  const { data: containersData } = trpc.ssh.listAllContainers.useQuery(
    { hostId: selectedHost }
  );

  const createNetworkMutation = trpc.ssh.createNetwork.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Network ${newNetworkName} created`);
        setCreateNetworkOpen(false);
        setNewNetworkName("");
        setNewNetworkSubnet("");
        setNewNetworkGateway("");
        refetchNetworks();
      } else {
        toast.error(data.error || "Failed to create network");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteNetworkMutation = trpc.ssh.deleteNetwork.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Network deleted");
        setSelectedNetwork(null);
        refetchNetworks();
      } else {
        toast.error(data.error || "Failed to delete network");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const connectMutation = trpc.ssh.connectContainerToNetwork.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Container connected to network");
        setConnectContainerOpen(false);
        setConnectContainerId("");
      } else {
        toast.error(data.error || "Failed to connect container");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnectMutation = trpc.ssh.disconnectContainerFromNetwork.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Container disconnected from network");
      } else {
        toast.error(data.error || "Failed to disconnect container");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const networks = networksData?.networks || [];

  return (
    <div className="space-y-6">
      {/* Create Network */}
      <Card className="bg-black/40 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-[#3b82f6]" />
                Docker Networks
                <Badge variant="outline" className="ml-2">{networks.length}</Badge>
              </CardTitle>
              <CardDescription>Manage Docker networks on {selectedHost === 'alpha' ? 'DGX Spark Alpha' : 'DGX Spark Beta'}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchNetworks()}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button className="bg-[#3b82f6] hover:bg-[#3b82f6]/90" onClick={() => setCreateNetworkOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Network
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
            </div>
          ) : networks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No custom networks found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {networks.map((network) => (
                <div
                  key={network.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedNetwork === network.id
                      ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                      : 'border-gray-800 bg-black/30 hover:border-gray-700'
                  }`}
                  onClick={() => setSelectedNetwork(selectedNetwork === network.id ? null : network.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{network.name}</span>
                    <Badge variant="outline" className="text-xs">{network.driver}</Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    <span>Scope: {network.scope}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Details */}
      {selectedNetwork && (
        <Card className="bg-black/40 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-cyan-500" />
                  Network Details
                </CardTitle>
                <CardDescription>{networkDetails?.network?.name}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConnectContainerOpen(true)}
                >
                  <Link className="h-4 w-4 mr-2" />
                  Connect Container
                </Button>
                {!['bridge', 'host', 'none'].includes(networkDetails?.network?.name || '') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-400"
                    onClick={() => {
                      if (confirm(`Delete network ${networkDetails?.network?.name}?`)) {
                        deleteNetworkMutation.mutate({ hostId: selectedHost, networkId: selectedNetwork });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
              </div>
            ) : networkDetails?.network ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Driver</div>
                    <div className="font-medium">{networkDetails.network.driver}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Subnet</div>
                    <div className="font-medium font-mono text-sm">{networkDetails.network.subnet || 'N/A'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Gateway</div>
                    <div className="font-medium font-mono text-sm">{networkDetails.network.gateway || 'N/A'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Scope</div>
                    <div className="font-medium">{networkDetails.network.scope}</div>
                  </div>
                </div>

                {/* Connected Containers */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Connected Containers ({networkDetails.network.containers?.length || 0})</h4>
                  {networkDetails.network.containers && networkDetails.network.containers.length > 0 ? (
                    <div className="space-y-2">
                      {networkDetails.network.containers.map((container: any) => (
                        <div key={container.id} className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-gray-800">
                          <div>
                            <span className="font-medium">{container.name}</span>
                            <span className="text-xs text-gray-500 ml-2 font-mono">{container.ipv4}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-400"
                            onClick={() => {
                              if (confirm(`Disconnect ${container.name} from this network?`)) {
                                disconnectMutation.mutate({
                                  hostId: selectedHost,
                                  networkId: selectedNetwork,
                                  containerId: container.id,
                                });
                              }
                            }}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No containers connected</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Failed to load network details</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Network Dialog */}
      <Dialog open={createNetworkOpen} onOpenChange={setCreateNetworkOpen}>
        <DialogContent className="bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Create Docker Network</DialogTitle>
            <DialogDescription>Create a new Docker network for container communication</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Network Name</label>
              <Input
                value={newNetworkName}
                onChange={(e) => setNewNetworkName(e.target.value)}
                placeholder="my-network"
                className="bg-black/30 border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Driver</label>
              <select
                value={newNetworkDriver}
                onChange={(e) => setNewNetworkDriver(e.target.value as any)}
                className="w-full h-10 rounded-md border border-gray-700 bg-black/30 px-3 text-sm"
              >
                <option value="bridge">Bridge (default)</option>
                <option value="host">Host</option>
                <option value="overlay">Overlay</option>
                <option value="macvlan">Macvlan</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400">Subnet (optional)</label>
              <Input
                value={newNetworkSubnet}
                onChange={(e) => setNewNetworkSubnet(e.target.value)}
                placeholder="172.20.0.0/16"
                className="bg-black/30 border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Gateway (optional)</label>
              <Input
                value={newNetworkGateway}
                onChange={(e) => setNewNetworkGateway(e.target.value)}
                placeholder="172.20.0.1"
                className="bg-black/30 border-gray-700"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateNetworkOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                onClick={() => {
                  createNetworkMutation.mutate({
                    hostId: selectedHost,
                    name: newNetworkName,
                    driver: newNetworkDriver,
                    subnet: newNetworkSubnet || undefined,
                    gateway: newNetworkGateway || undefined,
                  });
                }}
                disabled={!newNetworkName || createNetworkMutation.isPending}
              >
                {createNetworkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connect Container Dialog */}
      <Dialog open={connectContainerOpen} onOpenChange={setConnectContainerOpen}>
        <DialogContent className="bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Connect Container to Network</DialogTitle>
            <DialogDescription>Select a container to connect to {networkDetails?.network?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <select
              value={connectContainerId}
              onChange={(e) => setConnectContainerId(e.target.value)}
              className="w-full h-10 rounded-md border border-gray-700 bg-black/30 px-3 text-sm"
            >
              <option value="">Select a container...</option>
              {[...(containersData?.running || []), ...(containersData?.stopped || [])].map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.image})</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConnectContainerOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                onClick={() => {
                  if (selectedNetwork && connectContainerId) {
                    connectMutation.mutate({
                      hostId: selectedHost,
                      networkId: selectedNetwork,
                      containerId: connectContainerId,
                    });
                  }
                }}
                disabled={!connectContainerId || connectMutation.isPending}
              >
                {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Volumes Tab Component
function VolumesTab({ selectedHost }: { selectedHost: "alpha" | "beta" }) {
  const [createVolumeOpen, setCreateVolumeOpen] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState("");
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null);

  const { data: volumesData, refetch: refetchVolumes, isLoading } = trpc.ssh.listVolumes.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 30000 }
  );

  const { data: volumeDetails, isLoading: isLoadingDetails } = trpc.ssh.getVolumeDetails.useQuery(
    { hostId: selectedHost, volumeName: selectedVolume || "" },
    { enabled: !!selectedVolume }
  );

  const { data: volumeContainers } = trpc.ssh.getVolumeContainers.useQuery(
    { hostId: selectedHost, volumeName: selectedVolume || "" },
    { enabled: !!selectedVolume }
  );

  const createVolumeMutation = trpc.ssh.createVolume.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Volume ${newVolumeName} created`);
        setCreateVolumeOpen(false);
        setNewVolumeName("");
        refetchVolumes();
      } else {
        toast.error(data.error || "Failed to create volume");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteVolumeMutation = trpc.ssh.deleteVolume.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Volume deleted");
        setSelectedVolume(null);
        refetchVolumes();
      } else {
        toast.error(data.error || "Failed to delete volume");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const pruneVolumesMutation = trpc.ssh.pruneVolumes.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Pruned unused volumes. Reclaimed: ${data.spaceReclaimed}`);
        refetchVolumes();
      } else {
        toast.error(data.error || "Failed to prune volumes");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const volumes = volumesData?.volumes || [];

  return (
    <div className="space-y-6">
      {/* Volumes List */}
      <Card className="bg-black/40 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-[#3b82f6]" />
                Docker Volumes
                <Badge variant="outline" className="ml-2">{volumes.length}</Badge>
              </CardTitle>
              <CardDescription>Persistent storage volumes on {selectedHost === 'alpha' ? 'DGX Spark Alpha' : 'DGX Spark Beta'}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchVolumes()}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-orange-500 hover:text-orange-400"
                onClick={() => {
                  if (confirm('Prune all unused volumes? This cannot be undone.')) {
                    pruneVolumesMutation.mutate({ hostId: selectedHost });
                  }
                }}
                disabled={pruneVolumesMutation.isPending}
              >
                {pruneVolumesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Prune Unused
              </Button>
              <Button className="bg-[#3b82f6] hover:bg-[#3b82f6]/90" onClick={() => setCreateVolumeOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Volume
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
            </div>
          ) : volumes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No volumes found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {volumes.map((volume) => (
                <div
                  key={volume.name}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedVolume === volume.name
                      ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                      : 'border-gray-800 bg-black/30 hover:border-gray-700'
                  }`}
                  onClick={() => setSelectedVolume(selectedVolume === volume.name ? null : volume.name)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white truncate" title={volume.name}>
                      {volume.name.length > 20 ? volume.name.substring(0, 20) + '...' : volume.name}
                    </span>
                    <Badge variant="outline" className="text-xs">{volume.driver}</Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    <span>Scope: {volume.scope}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Volume Details */}
      {selectedVolume && (
        <Card className="bg-black/40 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-cyan-500" />
                  Volume Details
                </CardTitle>
                <CardDescription className="font-mono text-xs">{selectedVolume}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-400"
                onClick={() => {
                  if (confirm(`Delete volume ${selectedVolume}? This cannot be undone.`)) {
                    deleteVolumeMutation.mutate({ hostId: selectedHost, volumeName: selectedVolume });
                  }
                }}
                disabled={deleteVolumeMutation.isPending}
              >
                {deleteVolumeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
              </div>
            ) : volumeDetails?.volume ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Driver</div>
                    <div className="font-medium">{volumeDetails.volume.driver}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Size</div>
                    <div className="font-medium">{volumeDetails.volume.size}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Scope</div>
                    <div className="font-medium">{volumeDetails.volume.scope}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1">Created</div>
                    <div className="font-medium text-xs">{volumeDetails.volume.createdAt ? new Date(volumeDetails.volume.createdAt).toLocaleDateString() : 'N/A'}</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-black/30 border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Mount Point</div>
                  <div className="font-mono text-sm text-gray-300 break-all">{volumeDetails.volume.mountpoint}</div>
                </div>

                {/* Containers using this volume */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Containers Using This Volume ({volumeContainers?.containers?.length || 0})</h4>
                  {volumeContainers?.containers && volumeContainers.containers.length > 0 ? (
                    <div className="space-y-2">
                      {volumeContainers.containers.map((container: any) => (
                        <div key={container.id} className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-gray-800">
                          <div>
                            <span className="font-medium">{container.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{container.image}</span>
                          </div>
                          <Badge variant="outline" className={container.status.includes('Up') ? 'border-blue-500 text-blue-500' : 'border-gray-500 text-gray-500'}>
                            {container.status.includes('Up') ? 'Running' : 'Stopped'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No containers using this volume</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Failed to load volume details</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Volume Dialog */}
      <Dialog open={createVolumeOpen} onOpenChange={setCreateVolumeOpen}>
        <DialogContent className="bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Create Docker Volume</DialogTitle>
            <DialogDescription>Create a new persistent storage volume</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Volume Name</label>
              <Input
                value={newVolumeName}
                onChange={(e) => setNewVolumeName(e.target.value)}
                placeholder="my-volume"
                className="bg-black/30 border-gray-700"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateVolumeOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                onClick={() => {
                  createVolumeMutation.mutate({
                    hostId: selectedHost,
                    name: newVolumeName,
                  });
                }}
                disabled={!newVolumeName || createVolumeMutation.isPending}
              >
                {createVolumeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// Quick Launch Tab Component
function QuickLaunchTab({ selectedHost }: { selectedHost: "alpha" | "beta" }) {
  const [customPort, setCustomPort] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [launchingPreset, setLaunchingPreset] = useState<any>(null);
  
  // Custom presets state
  const [createPresetOpen, setCreatePresetOpen] = useState(false);
  const [editPresetOpen, setEditPresetOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<any>(null);
  const [newPreset, setNewPreset] = useState({
    name: "",
    description: "",
    category: "Custom",
    icon: "box",
    image: "",
    defaultPort: 8080,
    gpuRequired: false,
    command: "",
    envVars: {} as Record<string, string>,
    volumes: [] as string[],
    networkMode: "bridge",
    restartPolicy: "no",
    isPublic: false,
  });
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [newVolume, setNewVolume] = useState("");
  
  // Import/Export state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState("");

  const { data: presetsData } = trpc.ssh.getQuickLaunchPresets.useQuery();
  const presets = presetsData?.presets || [];
  
  // Custom presets from database
  const { data: customPresetsData, refetch: refetchCustomPresets } = trpc.presets.getPresets.useQuery({
    includePublic: true,
  });
  const customPresets = customPresetsData?.presets || [];

  // Custom preset mutations
  const createPresetMutation = trpc.presets.createPreset.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Custom preset created successfully!");
        setCreatePresetOpen(false);
        resetNewPreset();
        refetchCustomPresets();
      } else {
        toast.error(data.error || "Failed to create preset");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePresetMutation = trpc.presets.updatePreset.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Preset updated successfully!");
        setEditPresetOpen(false);
        setEditingPreset(null);
        refetchCustomPresets();
      } else {
        toast.error(data.error || "Failed to update preset");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePresetMutation = trpc.presets.deletePreset.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Preset deleted successfully!");
        refetchCustomPresets();
      } else {
        toast.error(data.error || "Failed to delete preset");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Export presets query
  const { data: exportData, refetch: fetchExport } = trpc.presets.exportPresets.useQuery(
    {},
    { enabled: false } // Only fetch on demand
  );

  // Import presets mutation
  const importPresetsMutation = trpc.presets.importPresets.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Successfully imported ${data.imported} preset(s)!`);
        setImportModalOpen(false);
        setImportJson("");
        refetchCustomPresets();
      } else {
        toast.error(data.error || "Failed to import presets");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const launchMutation = trpc.ssh.launchQuickPreset.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(
          <div>
            <p className="font-medium">Container launched successfully!</p>
            <p className="text-sm text-gray-400">Access at: {data.accessUrl}</p>
          </div>
        );
        setLaunchModalOpen(false);
        setCustomPort("");
        setCustomName("");
      } else {
        toast.error(data.error || "Failed to launch container");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLaunch = (preset: any) => {
    setLaunchingPreset(preset);
    setCustomPort(preset.defaultPort.toString());
    setCustomName(`${preset.id || preset.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-6)}`);
    setLaunchModalOpen(true);
  };

  const resetNewPreset = () => {
    setNewPreset({
      name: "",
      description: "",
      category: "Custom",
      icon: "box",
      image: "",
      defaultPort: 8080,
      gpuRequired: false,
      command: "",
      envVars: {},
      volumes: [],
      networkMode: "bridge",
      restartPolicy: "no",
      isPublic: false,
    });
    setNewEnvKey("");
    setNewEnvValue("");
    setNewVolume("");
  };

  const handleClonePreset = (preset: any) => {
    // Pre-fill the create preset form with cloned data
    setNewPreset({
      name: `${preset.name} (Copy)`,
      description: preset.description || "",
      category: preset.category || "Custom",
      icon: preset.icon || "box",
      image: preset.image,
      defaultPort: preset.defaultPort || 8080,
      gpuRequired: preset.gpuRequired || false,
      command: preset.command || "",
      envVars: preset.envVars || {},
      volumes: preset.volumes || [],
      networkMode: preset.networkMode || "bridge",
      restartPolicy: preset.restartPolicy || "no",
      isPublic: false,
    });
    setCreatePresetOpen(true);
    toast.info(`Cloning "${preset.name}" - customize and save as your own preset`);
  };

  const handleCreatePreset = () => {
    if (!newPreset.name || !newPreset.image) {
      toast.error("Name and image are required");
      return;
    }
    createPresetMutation.mutate(newPreset);
  };

  const handleEditPreset = (preset: any) => {
    setEditingPreset(preset);
    setEditPresetOpen(true);
  };

  const handleUpdatePreset = () => {
    if (!editingPreset) return;
    updatePresetMutation.mutate({
      id: editingPreset.id,
      ...editingPreset,
    });
  };

  const handleDeletePreset = (presetId: number) => {
    if (confirm("Are you sure you want to delete this preset?")) {
      deletePresetMutation.mutate({ id: presetId });
    }
  };

  const addEnvVar = () => {
    if (newEnvKey && newEnvValue) {
      setNewPreset(prev => ({
        ...prev,
        envVars: { ...prev.envVars, [newEnvKey]: newEnvValue }
      }));
      setNewEnvKey("");
      setNewEnvValue("");
    }
  };

  const removeEnvVar = (key: string) => {
    setNewPreset(prev => {
      const { [key]: _, ...rest } = prev.envVars;
      return { ...prev, envVars: rest };
    });
  };

  const addVolume = () => {
    if (newVolume) {
      setNewPreset(prev => ({
        ...prev,
        volumes: [...prev.volumes, newVolume]
      }));
      setNewVolume("");
    }
  };

  const removeVolume = (index: number) => {
    setNewPreset(prev => ({
      ...prev,
      volumes: prev.volumes.filter((_, i) => i !== index)
    }));
  };

  const handleConfirmLaunch = () => {
    if (!launchingPreset) return;
    launchMutation.mutate({
      hostId: selectedHost,
      presetId: launchingPreset.id,
      containerName: customName || undefined,
      port: customPort ? parseInt(customPort) : undefined,
    });
  };

  // Export presets as JSON file
  const handleExportPresets = async () => {
    if (customPresets.length === 0) {
      toast.error("No custom presets to export");
      return;
    }
    
    // Build export data from current custom presets
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      presets: customPresets.map((p: any) => ({
        name: p.name,
        description: p.description,
        category: p.category,
        icon: p.icon,
        image: p.image,
        defaultPort: p.defaultPort,
        gpuRequired: p.gpuRequired,
        command: p.command,
        envVars: p.envVars || {},
        volumes: p.volumes || [],
        networkMode: p.networkMode,
        restartPolicy: p.restartPolicy,
      })),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nemo-presets-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${customPresets.length} preset(s)`);
  };

  // Import presets from JSON
  const handleImportPresets = () => {
    if (!importJson.trim()) {
      toast.error("Please paste JSON data to import");
      return;
    }
    try {
      JSON.parse(importJson); // Validate JSON
      importPresetsMutation.mutate({
        jsonData: importJson,
        overwriteExisting: false,
      });
    } catch (e) {
      toast.error("Invalid JSON format");
    }
  };

  // Handle file upload for import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setImportJson(content);
      };
      reader.readAsText(file);
    }
  };

  const presetIcons: Record<string, React.ReactNode> = {
    notebook: <FileText className="h-6 w-6" />,
    chart: <BarChart3 className="h-6 w-6" />,
    brain: <Sparkles className="h-6 w-6" />,
    server: <Server className="h-6 w-6" />,
    message: <MessageSquare className="h-6 w-6" />,
    code: <Terminal className="h-6 w-6" />,
    flask: <Beaker className="h-6 w-6" />,
    layout: <Layers className="h-6 w-6" />,
  };

  const categories = Array.from(new Set(presets.map((p: any) => p.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-[#3b82f6]/20 to-purple-500/20 border-[#3b82f6]/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#3b82f6]/20 border border-[#3b82f6]/30">
              <Rocket className="h-8 w-8 text-[#3b82f6]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Quick Launch</h2>
              <p className="text-gray-400">One-click deployment of common AI/ML applications</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Presets by Category */}
      {categories.map((category: string) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Zap className="h-5 w-5" />
            <h3 className="text-lg font-semibold">{category}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets.filter((p: any) => p.category === category).map((preset: any) => (
              <Card
                key={preset.id}
                className="bg-black/40 border-gray-800 hover:border-[#3b82f6]/50 transition-all cursor-pointer group"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] group-hover:bg-[#3b82f6]/20 transition-colors">
                      {presetIcons[preset.icon] || <Box className="h-6 w-6" />}
                    </div>
                    {preset.gpuRequired && (
                      <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-500">
                        <Cpu className="h-3 w-3 mr-1" />
                        GPU
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-white mb-1">{preset.name}</h4>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{preset.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Port: {preset.defaultPort}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClonePreset(preset);
                        }}
                        title="Clone as custom preset"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunch(preset);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Launch
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Custom Presets Section */}
      {customPresets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-lg font-semibold">My Custom Presets</h3>
              <Badge variant="outline" className="text-xs">{customPresets.length}</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPresets}
                className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportModalOpen(true)}
                className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreatePresetOpen(true)}
                className="border-[#3b82f6]/50 text-[#3b82f6] hover:bg-[#3b82f6]/10"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Preset
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customPresets.map((preset: any) => (
              <Card
                key={preset.id}
                className="bg-black/40 border-gray-800 hover:border-purple-500/50 transition-all group"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 transition-colors">
                      {presetIcons[preset.icon] || <Box className="h-6 w-6" />}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                        onClick={() => handleEditPreset(preset)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <h4 className="font-semibold text-white mb-1">{preset.name}</h4>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{preset.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Port: {preset.defaultPort}
                    </div>
                    <Button
                      size="sm"
                      className="bg-purple-500 hover:bg-purple-500/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunch(preset);
                      }}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Launch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create New Preset Button (if no custom presets) */}
      {customPresets.length === 0 && (
        <Card className="bg-black/40 border-dashed border-gray-700 hover:border-[#3b82f6]/50 transition-all cursor-pointer" onClick={() => setCreatePresetOpen(true)}>
          <CardContent className="py-8 text-center">
            <Plus className="h-12 w-12 mx-auto text-gray-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-400">Create Custom Preset</h3>
            <p className="text-sm text-gray-500">Save your container configurations for quick reuse</p>
          </CardContent>
        </Card>
      )}

      {/* Create Preset Modal */}
      <Dialog open={createPresetOpen} onOpenChange={setCreatePresetOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#3b82f6]" />
              Create Custom Preset
            </DialogTitle>
            <DialogDescription>
              Save a container configuration as a reusable preset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Name *</label>
                <Input
                  value={newPreset.name}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Custom Container"
                  className="bg-black/50 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Category</label>
                <select
                  value={newPreset.category}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full h-10 rounded-md border border-gray-700 bg-black/50 px-3 text-sm"
                >
                  <option value="Custom">Custom</option>
                  <option value="Development">Development</option>
                  <option value="Monitoring">Monitoring</option>
                  <option value="Training">Training</option>
                  <option value="Inference">Inference</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Description</label>
              <Textarea
                value={newPreset.description}
                onChange={(e) => setNewPreset(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this preset..."
                className="bg-black/50 border-gray-700"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Docker Image *</label>
              <Input
                value={newPreset.image}
                onChange={(e) => setNewPreset(prev => ({ ...prev, image: e.target.value }))}
                placeholder="nvcr.io/nvidia/pytorch:24.01-py3"
                className="bg-black/50 border-gray-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Default Port</label>
                <Input
                  type="number"
                  value={newPreset.defaultPort}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, defaultPort: parseInt(e.target.value) || 8080 }))}
                  className="bg-black/50 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Icon</label>
                <select
                  value={newPreset.icon}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, icon: e.target.value }))}
                  className="w-full h-10 rounded-md border border-gray-700 bg-black/50 px-3 text-sm"
                >
                  <option value="box">Box</option>
                  <option value="notebook">Notebook</option>
                  <option value="server">Server</option>
                  <option value="code">Code</option>
                  <option value="brain">Brain</option>
                  <option value="chart">Chart</option>
                  <option value="flask">Flask</option>
                  <option value="message">Message</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={newPreset.gpuRequired}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, gpuRequired: e.target.checked }))}
                  className="rounded border-gray-700"
                />
                Requires GPU
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={newPreset.isPublic}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, isPublic: e.target.checked }))}
                  className="rounded border-gray-700"
                />
                Public (share with others)
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Command (optional)</label>
              <Input
                value={newPreset.command}
                onChange={(e) => setNewPreset(prev => ({ ...prev, command: e.target.value }))}
                placeholder="jupyter lab --ip=0.0.0.0"
                className="bg-black/50 border-gray-700"
              />
            </div>
            {/* Environment Variables */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Environment Variables</label>
              <div className="flex gap-2">
                <Input
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  placeholder="KEY"
                  className="bg-black/50 border-gray-700 flex-1"
                />
                <Input
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder="value"
                  className="bg-black/50 border-gray-700 flex-1"
                />
                <Button variant="outline" onClick={addEnvVar}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {Object.entries(newPreset.envVars).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-sm bg-gray-900/50 rounded px-3 py-2">
                  <code className="text-[#3b82f6]">{key}</code>
                  <span className="text-gray-500">=</span>
                  <code className="text-gray-300 flex-1">{value}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeEnvVar(key)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {/* Volumes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Volume Mounts</label>
              <div className="flex gap-2">
                <Input
                  value={newVolume}
                  onChange={(e) => setNewVolume(e.target.value)}
                  placeholder="/host/path:/container/path"
                  className="bg-black/50 border-gray-700 flex-1"
                />
                <Button variant="outline" onClick={addVolume}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newPreset.volumes.map((vol, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-gray-900/50 rounded px-3 py-2">
                  <code className="text-gray-300 flex-1">{vol}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeVolume(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCreatePresetOpen(false); resetNewPreset(); }}>
              Cancel
            </Button>
            <Button
              className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
              onClick={handleCreatePreset}
              disabled={createPresetMutation.isPending || !newPreset.name || !newPreset.image}
            >
              {createPresetMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Launch Configuration Modal */}
      <Dialog open={launchModalOpen} onOpenChange={setLaunchModalOpen}>
        <DialogContent className="max-w-md bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-[#3b82f6]" />
              Launch {launchingPreset?.name}
            </DialogTitle>
            <DialogDescription>
              Configure and deploy to {selectedHost === 'alpha' ? 'DGX Spark Alpha' : 'DGX Spark Beta'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Container Name</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="my-container"
                className="bg-black/50 border-gray-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Port</label>
              <Input
                type="number"
                value={customPort}
                onChange={(e) => setCustomPort(e.target.value)}
                placeholder={launchingPreset?.defaultPort?.toString()}
                className="bg-black/50 border-gray-700"
              />
            </div>
            <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-800">
              <div className="text-xs text-gray-500 mb-2">Image</div>
              <code className="text-sm text-[#3b82f6]">{launchingPreset?.image}</code>
            </div>
            {launchingPreset?.gpuRequired && (
              <div className="flex items-center gap-2 text-yellow-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                This container requires GPU access
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLaunchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
              onClick={handleConfirmLaunch}
              disabled={launchMutation.isPending}
            >
              {launchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Launch Container
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Presets Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-xl bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#3b82f6]" />
              Import Presets
            </DialogTitle>
            <DialogDescription>
              Import container presets from a JSON file or paste JSON data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Upload JSON File</label>
              <Input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="bg-black/50 border-gray-700 file:bg-[#3b82f6]/20 file:text-[#3b82f6] file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-md"
              />
            </div>
            
            {/* Or paste JSON */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-2 text-gray-500">Or paste JSON</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">JSON Data</label>
              <Textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{\n  "version": "1.0",\n  "presets": [...]\n}'
                className="bg-black/50 border-gray-700 min-h-[200px] font-mono text-sm"
              />
            </div>
            
            {importJson && (
              <div className="text-sm text-gray-400">
                {(() => {
                  try {
                    const parsed = JSON.parse(importJson);
                    return (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Valid JSON - {parsed.presets?.length || 0} preset(s) found
                      </div>
                    );
                  } catch {
                    return (
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        Invalid JSON format
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImportPresets}
              disabled={!importJson.trim() || importPresetsMutation.isPending}
              className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"
            >
              {importPresetsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import Presets
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// History Tab Component
function HistoryTab({ selectedHost }: { selectedHost: "alpha" | "beta" }) {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch container action history
  const { data: historyData, isLoading, refetch } = trpc.containerHistory.getHistory.useQuery(
    { limit: 100 },
    { refetchInterval: 10000 } // Refresh every 10 seconds
  );

  const { data: hostHistoryData } = trpc.containerHistory.getHistoryByHost.useQuery(
    { hostId: selectedHost, limit: 50 }
  );

  const history = historyData?.history || [];
  const hostHistory = hostHistoryData?.history || [];

  // Filter history based on selected filters
  const filteredHistory = history.filter((item: any) => {
    if (filterAction !== "all" && item.action !== filterAction) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "pull": return <Download className="h-4 w-4" />;
      case "update": return <RefreshCw className="h-4 w-4" />;
      case "remove": return <Trash2 className="h-4 w-4" />;
      case "start": return <Play className="h-4 w-4" />;
      case "stop": return <Square className="h-4 w-4" />;
      default: return <Box className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "pull": return "text-blue-400 bg-blue-500/10";
      case "update": return "text-cyan-400 bg-cyan-500/10";
      case "remove": return "text-red-400 bg-red-500/10";
      case "start": return "text-green-400 bg-green-500/10";
      case "stop": return "text-yellow-400 bg-yellow-500/10";
      default: return "text-gray-400 bg-gray-500/10";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      case "started":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30">
                <History className="h-8 w-8 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Container Action History</h2>
                <p className="text-gray-400">Timeline of container operations across all hosts</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-black/40 border-gray-800">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Action:</span>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="bg-black/50 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
              >
                <option value="all">All Actions</option>
                <option value="pull">Pull</option>
                <option value="update">Update</option>
                <option value="remove">Remove</option>
                <option value="start">Start</option>
                <option value="stop">Stop</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-black/50 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="started">In Progress</option>
              </select>
            </div>
            <div className="ml-auto text-sm text-gray-500">
              {filteredHistory.length} action(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Timeline */}
      <Card className="bg-black/40 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            Recent Actions
          </CardTitle>
          <CardDescription>Container operations timeline</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No container actions recorded yet</p>
              <p className="text-sm mt-1">Actions will appear here when you pull, update, or remove images</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item: any, index: number) => (
                <div
                  key={item.id || index}
                  className="flex items-center gap-4 p-4 rounded-lg bg-black/30 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  {/* Action Icon */}
                  <div className={`p-2 rounded-lg ${getActionColor(item.action)}`}>
                    {getActionIcon(item.action)}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white capitalize">{item.action}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-sm text-gray-400 truncate">{item.imageTag}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        {item.hostName || item.hostId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(item.createdAt)}
                      </span>
                      {item.userName && (
                        <span className="text-gray-400">by {item.userName}</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3">
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Host-specific History */}
      <Card className="bg-black/40 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-[#3b82f6]" />
            {selectedHost === "alpha" ? "DGX Spark Alpha" : "DGX Spark Beta"} History
          </CardTitle>
          <CardDescription>Recent actions on selected host</CardDescription>
        </CardHeader>
        <CardContent>
          {hostHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No actions recorded for this host</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hostHistory.slice(0, 10).map((item: any, index: number) => (
                <div
                  key={item.id || index}
                  className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded ${getActionColor(item.action)}`}>
                      {getActionIcon(item.action)}
                    </div>
                    <div>
                      <span className="text-sm text-white capitalize">{item.action}</span>
                      <span className="text-gray-500 mx-2">•</span>
                      <span className="text-sm text-gray-400 truncate">{item.imageTag}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <span className="text-xs text-gray-500">{formatTimeAgo(item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
