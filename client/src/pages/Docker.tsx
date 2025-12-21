import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Cpu,
  HardDrive,
  GitBranch,
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

export default function Docker() {
  const [selectedHost, setSelectedHost] = useState<"alpha" | "beta">("alpha");
  const [pullImageTag, setPullImageTag] = useState("");
  const [pullTargetHost, setPullTargetHost] = useState<"alpha" | "beta" | "both">("alpha");
  const [isPulling, setIsPulling] = useState(false);
  const [isPullingPlaybook, setIsPullingPlaybook] = useState(false);
  const [playbookHost, setPlaybookHost] = useState<"alpha" | "beta">("alpha");

  // Container list query
  const { data: containerData, refetch: refetchContainers, isLoading: isLoadingContainers } = trpc.ssh.listAllContainers.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 10000 }
  );

  // K8s status query
  const { data: k8sStatus, isLoading: isLoadingK8s } = trpc.ssh.getKubernetesStatus.useQuery(
    { hostId: selectedHost },
    { refetchInterval: 30000 }
  );

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

  const handlePullPlaybookImages = () => {
    setIsPullingPlaybook(true);
    pullPlaybookMutation.mutate({ hostId: playbookHost });
  };

  const runningContainers = containerData?.running || [];
  const stoppedContainers = containerData?.stopped || [];

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
            onClick={() => refetchContainers()}
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
                          onClick={() => toast.info("Logs feature coming soon")}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-yellow-500 hover:text-yellow-400"
                          onClick={() => stopContainerMutation.mutate({ hostId: selectedHost, containerId: container.id })}
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
                  {/* Cluster Info */}
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
    </div>
  );
}
