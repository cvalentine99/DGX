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
            <div className="p-2 rounded-lg bg-[#76b900]/20">
              <Container className="h-8 w-8 text-[#76b900]" />
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
          <TabsTrigger value="kubernetes" className="gap-2">
            <Network className="h-4 w-4" />
            Kubernetes
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
                    <Play className="h-5 w-5 text-green-500" />
                    Running Containers
                    <Badge variant="outline" className="ml-2 border-green-500 text-green-500">
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
                  <Loader2 className="h-6 w-6 animate-spin text-[#76b900]" />
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
                        <div className="p-2 rounded bg-green-500/20">
                          <Container className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{container.name}</p>
                          <p className="text-xs text-gray-400">{container.image}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-green-500 text-green-500">
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
                          className="text-green-500 hover:text-green-400"
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
                <Download className="h-5 w-5 text-[#76b900]" />
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
                  className="bg-[#76b900] hover:bg-[#76b900]/90"
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
                    <Layers className="h-5 w-5 text-[#76b900]" />
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
                  <Loader2 className="h-6 w-6 animate-spin text-[#76b900]" />
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
                        <div className="p-2 rounded bg-[#76b900]/20">
                          <Layers className="h-4 w-4 text-[#76b900]" />
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
                <GitBranch className="h-5 w-5 text-[#76b900]" />
                DGX Spark Playbook Images
              </CardTitle>
              <CardDescription>
                Pull all container images referenced in NVIDIA dgx-spark-playbooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-black/30 border border-gray-800">
                <div className="flex items-start gap-3 mb-4">
                  <Server className="h-5 w-5 text-[#76b900] mt-0.5" />
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
                    className="border-[#76b900] text-[#76b900] hover:bg-[#76b900]/10"
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
                <Sparkles className="h-5 w-5 text-[#76b900]" />
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
                      className="p-4 rounded-lg bg-black/30 border border-gray-800 hover:border-[#76b900] transition-colors cursor-pointer group"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded bg-[#76b900]/20 group-hover:bg-[#76b900]/30 transition-colors">
                          <Icon className="h-5 w-5 text-[#76b900]" />
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
                    <Upload className="h-5 w-5 text-[#76b900]" />
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
                  className="border-[#76b900] text-[#76b900]"
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
                        <div className="p-2 rounded bg-[#76b900]/20">
                          <Upload className="h-4 w-4 text-[#76b900]" />
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

        {/* Kubernetes Tab */}
        <TabsContent value="kubernetes" className="space-y-6">
          <Card className="bg-black/40 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-[#76b900]" />
                    Kubernetes Cluster
                  </CardTitle>
                  <CardDescription>
                    Kubernetes cluster status and management
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={k8sStatus?.connected ? "border-green-500 text-green-500" : "border-gray-500 text-gray-500"}
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
                  <Loader2 className="h-6 w-6 animate-spin text-[#76b900]" />
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
                  <Button variant="outline" className="border-[#76b900] text-[#76b900]">
                    View Setup Guide
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Container Logs Modal */}
      <Dialog open={logsModalOpen} onOpenChange={setLogsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#76b900]" />
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
                className={autoRefreshLogs ? "bg-[#76b900]" : ""}
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
                <Loader2 className="h-6 w-6 animate-spin text-[#76b900]" />
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
              <Upload className="h-5 w-5 text-[#76b900]" />
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
                  className="bg-[#76b900] hover:bg-[#76b900]/90"
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
              <Download className="h-5 w-5 text-[#76b900]" />
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
                <span className="text-[#76b900] font-medium">{pullProgressData?.progress || 0}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#76b900] to-[#9be22d] transition-all duration-500"
                  style={{ width: `${pullProgressData?.progress || 0}%` }}
                />
              </div>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2">
              {pullProgressData?.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : pullProgressData?.status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-[#76b900]" />
              )}
              <span className={`font-medium ${
                pullProgressData?.status === 'completed' ? 'text-green-500' :
                pullProgressData?.status === 'error' ? 'text-red-500' : 'text-[#76b900]'
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
              <ScrollText className="h-5 w-5 text-[#76b900]" />
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
                className={composeLogsAutoRefresh ? "bg-[#76b900]" : ""}
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
                <Loader2 className="h-6 w-6 animate-spin text-[#76b900]" />
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
