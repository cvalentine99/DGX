/*
 * Training - Fine-Tuning Studio
 * 
 * Design: Recipe builder for SFT/PEFT/DPO, MoE hyperparameters,
 * job orchestration, and real-time training telemetry.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import {
  Brain,
  Play,
  Pause,
  Square,
  Settings,
  Layers,
  Zap,
  TrendingDown,
  Clock,
  Activity,
  FileText,
  Sliders,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";

// Training Recipes
const TRAINING_RECIPES = [
  { id: "sft", name: "Supervised Fine-Tuning", description: "Standard instruction tuning", icon: Brain },
  { id: "peft", name: "PEFT/LoRA", description: "Parameter-efficient fine-tuning", icon: Layers },
  { id: "dpo", name: "DPO", description: "Direct Preference Optimization", icon: TrendingDown },
];

// MoE Hyperparameters
const MOE_PARAMS = {
  numExperts: 128,
  activeExperts: 8,
  auxiliaryLossCoef: 0.01,
  routerZLoss: 0.001,
  sinkhornIterations: 10,
  loadBalancing: true,
};

// Simulated Training Job
const TRAINING_JOB = {
  id: "job-001",
  status: "running",
  recipe: "PEFT/LoRA",
  dataset: "custom-instruct-v1",
  startTime: "2024-12-20 14:30:00",
  currentEpoch: 2,
  totalEpochs: 5,
  currentStep: 1247,
  totalSteps: 5000,
  loss: 0.342,
  learningRate: 2e-5,
  throughput: 1842,
  eta: "2h 15m",
};

// Loss History (simulated)
const LOSS_HISTORY = [
  { step: 0, loss: 2.45 },
  { step: 200, loss: 1.82 },
  { step: 400, loss: 1.24 },
  { step: 600, loss: 0.89 },
  { step: 800, loss: 0.62 },
  { step: 1000, loss: 0.48 },
  { step: 1200, loss: 0.35 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function RecipeBuilderCard() {
  const [selectedRecipe, setSelectedRecipe] = useState("peft");
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-nvidia-green" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">Recipe Builder</CardTitle>
            <p className="text-xs text-muted-foreground">Configure training methodology</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Recipe Selection */}
        <div className="grid grid-cols-3 gap-3">
          {TRAINING_RECIPES.map((recipe) => {
            const Icon = recipe.icon;
            const isSelected = selectedRecipe === recipe.id;
            return (
              <button
                key={recipe.id}
                onClick={() => setSelectedRecipe(recipe.id)}
                className={cn(
                  "p-4 rounded-lg border transition-all text-left",
                  isSelected 
                    ? "bg-nvidia-green/10 border-nvidia-green/50 glow-green" 
                    : "bg-muted/30 border-border/50 hover:border-border"
                )}
              >
                <Icon className={cn("w-5 h-5 mb-2", isSelected ? "text-nvidia-green" : "text-muted-foreground")} />
                <div className="text-sm font-semibold">{recipe.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{recipe.description}</div>
              </button>
            );
          })}
        </div>
        
        {/* Basic Parameters */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground">Training Parameters</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Learning Rate</Label>
              <Select defaultValue="2e-5">
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1e-5">1e-5</SelectItem>
                  <SelectItem value="2e-5">2e-5</SelectItem>
                  <SelectItem value="5e-5">5e-5</SelectItem>
                  <SelectItem value="1e-4">1e-4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Batch Size</Label>
              <Select defaultValue="8">
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                  <SelectItem value="32">32</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Epochs</Label>
              <Select defaultValue="5">
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Warmup Steps</Label>
              <Select defaultValue="100">
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* LoRA Specific */}
          {selectedRecipe === "peft" && (
            <div className="pt-4 border-t border-border/50 space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground">LoRA Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">LoRA Rank</Label>
                  <Select defaultValue="16">
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8</SelectItem>
                      <SelectItem value="16">16</SelectItem>
                      <SelectItem value="32">32</SelectItem>
                      <SelectItem value="64">64</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">LoRA Alpha</Label>
                  <Select defaultValue="32">
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16">16</SelectItem>
                      <SelectItem value="32">32</SelectItem>
                      <SelectItem value="64">64</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MoEParametersCard() {
  const [params, setParams] = useState(MOE_PARAMS);
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-nvidia-teal" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">MoE Parameters</CardTitle>
            <p className="text-xs text-muted-foreground">Mixture of Experts Configuration</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Total Experts</div>
            <div className="text-xl font-mono font-bold text-nvidia-green">{params.numExperts}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Active per Token</div>
            <div className="text-xl font-mono font-bold text-nvidia-teal">{params.activeExperts}</div>
          </div>
        </div>
        
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auxiliary Loss Coefficient</Label>
              <span className="text-xs font-mono text-nvidia-green">{params.auxiliaryLossCoef}</span>
            </div>
            <Slider 
              defaultValue={[params.auxiliaryLossCoef * 100]} 
              max={10} 
              step={0.1}
              className="[&_[role=slider]]:bg-nvidia-green"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Router Z-Loss</Label>
              <span className="text-xs font-mono text-nvidia-teal">{params.routerZLoss}</span>
            </div>
            <Slider 
              defaultValue={[params.routerZLoss * 1000]} 
              max={10} 
              step={0.1}
              className="[&_[role=slider]]:bg-nvidia-teal"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Sinkhorn Iterations</Label>
              <span className="text-xs font-mono">{params.sinkhornIterations}</span>
            </div>
            <Slider 
              defaultValue={[params.sinkhornIterations]} 
              max={20} 
              step={1}
            />
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <Label className="text-xs">Load Balancing</Label>
            <Switch defaultChecked={params.loadBalancing} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingTelemetryCard() {
  const job = TRAINING_JOB;
  const progress = (job.currentStep / job.totalSteps) * 100;
  
  return (
    <Card className="cyber-panel-glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center animate-pulse">
              <Activity className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">Training Telemetry</CardTitle>
              <p className="text-xs text-muted-foreground">Job: {job.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => toast.info("Feature coming soon")}>
              <Pause className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-nvidia-critical hover:text-nvidia-critical" onClick={() => toast.info("Feature coming soon")}>
              <Square className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono">
              Step {job.currentStep.toLocaleString()} / {job.totalSteps.toLocaleString()}
            </span>
          </div>
          <div className="progress-glow">
            <div className="progress-glow-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Epoch {job.currentEpoch}/{job.totalEpochs}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ETA: {job.eta}
            </span>
          </div>
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3 h-3 text-nvidia-green" />
              <span className="text-xs text-muted-foreground">Loss</span>
            </div>
            <div className="text-lg font-mono font-bold text-nvidia-green">{job.loss}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3 h-3 text-nvidia-teal" />
              <span className="text-xs text-muted-foreground">Learning Rate</span>
            </div>
            <div className="text-lg font-mono font-bold">{job.learningRate}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3 h-3 text-nvidia-teal" />
              <span className="text-xs text-muted-foreground">Throughput</span>
            </div>
            <div className="text-lg font-mono font-bold">{job.throughput} <span className="text-xs text-muted-foreground">tok/s</span></div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Recipe</span>
            </div>
            <div className="text-sm font-semibold">{job.recipe}</div>
          </div>
        </div>
        
        {/* Loss Chart (Simplified) */}
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Loss Curve</span>
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="h-24 flex items-end gap-1">
            {LOSS_HISTORY.map((point, index) => {
              const height = ((2.5 - point.loss) / 2.5) * 100;
              return (
                <div 
                  key={index}
                  className="flex-1 bg-nvidia-green/30 rounded-t transition-all hover:bg-nvidia-green/50"
                  style={{ height: `${height}%` }}
                  title={`Step ${point.step}: ${point.loss}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
            <span>0</span>
            <span>{LOSS_HISTORY[LOSS_HISTORY.length - 1].step}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobQueueCard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJob, setNewJob] = useState({
    name: "",
    description: "",
    baseModel: "nemotron-3-nano-30b",
    trainingType: "lora" as const,
    datasetPath: "/workspace/datasets/custom-instruct",
    epochs: 3,
    batchSize: 4,
    learningRate: "2e-5",
    hostId: "alpha" as const,
    gpuCount: 1,
  });

  // Fetch training jobs
  const { data: jobsData, isLoading, refetch } = trpc.training.getJobs.useQuery(
    { limit: 10 },
    { refetchInterval: 5000 }
  );

  // Fetch base models
  const { data: modelsData } = trpc.training.getBaseModels.useQuery();

  // Fetch stats
  const { data: stats } = trpc.training.getStats.useQuery(undefined, {
    refetchInterval: 5000
  });

  // Mutations
  const createJobMutation = trpc.training.createJob.useMutation({
    onSuccess: () => {
      toast.success("Training job created", { description: "Job added to queue" });
      setShowCreateModal(false);
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to create job", { description: error.message });
    }
  });

  const startJobMutation = trpc.training.startJob.useMutation({
    onSuccess: () => {
      toast.success("Training job started");
      refetch();
    }
  });

  const cancelJobMutation = trpc.training.cancelJob.useMutation({
    onSuccess: () => {
      toast.info("Training job cancelled");
      refetch();
    }
  });

  const deleteJobMutation = trpc.training.deleteJob.useMutation({
    onSuccess: () => {
      toast.success("Job deleted");
      refetch();
    }
  });

  const jobs = jobsData?.jobs || [];
  const baseModels = modelsData?.models || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "queued":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Queued</Badge>;
      case "preparing":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Preparing</Badge>;
      case "running":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Running</Badge>;
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      case "cancelled":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCreateJob = () => {
    createJobMutation.mutate(newJob);
  };

  return (
    <>
      <Card className="cyber-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Play className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-display tracking-wide">Job Queue</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {stats?.running || 0} running • {stats?.queued || 0} queued
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                New Job
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No training jobs yet</p>
              <p className="text-xs">Create a new job to get started</p>
            </div>
          ) : (
            jobs.slice(0, 5).map((job: any) => (
              <div key={job.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{job.name}</span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="flex gap-1">
                    {job.status === "queued" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startJobMutation.mutate({ id: job.id })}
                        className="h-7 w-7 p-0"
                      >
                        <Play className="h-3 w-3 text-green-400" />
                      </Button>
                    )}
                    {(job.status === "running" || job.status === "preparing") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelJobMutation.mutate({ id: job.id })}
                        className="h-7 w-7 p-0"
                      >
                        <Square className="h-3 w-3 text-yellow-400" />
                      </Button>
                    )}
                    {(job.status === "completed" || job.status === "failed" || job.status === "cancelled") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteJobMutation.mutate({ id: job.id })}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{job.trainingType.toUpperCase()}</span>
                  <span>•</span>
                  <span>{job.baseModel}</span>
                  {job.progress > 0 && (
                    <>
                      <span>•</span>
                      <span>{job.progress}%</span>
                    </>
                  )}
                </div>
                {job.status === "running" && job.progress > 0 && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nvidia-green transition-all"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create Job Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-nvidia-green" />
              Create Training Job
            </DialogTitle>
            <DialogDescription>
              Configure and submit a new fine-tuning job
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Job Name</Label>
              <Input
                value={newJob.name}
                onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                placeholder="My Fine-tuning Job"
                className="bg-black/50 border-gray-700"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newJob.description}
                onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                placeholder="Optional description..."
                className="bg-black/50 border-gray-700 h-20"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Model</Label>
                <Select
                  value={newJob.baseModel}
                  onValueChange={(v) => setNewJob({ ...newJob, baseModel: v })}
                >
                  <SelectTrigger className="bg-black/50 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {baseModels.map((model: any) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Training Type</Label>
                <Select
                  value={newJob.trainingType}
                  onValueChange={(v: any) => setNewJob({ ...newJob, trainingType: v })}
                >
                  <SelectTrigger className="bg-black/50 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lora">LoRA</SelectItem>
                    <SelectItem value="qlora">QLoRA</SelectItem>
                    <SelectItem value="sft">Full SFT</SelectItem>
                    <SelectItem value="full">Full Fine-tune</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Dataset Path</Label>
              <Input
                value={newJob.datasetPath}
                onChange={(e) => setNewJob({ ...newJob, datasetPath: e.target.value })}
                placeholder="/workspace/datasets/my-dataset"
                className="bg-black/50 border-gray-700"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Epochs</Label>
                <Input
                  type="number"
                  value={newJob.epochs}
                  onChange={(e) => setNewJob({ ...newJob, epochs: parseInt(e.target.value) || 3 })}
                  className="bg-black/50 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Batch Size</Label>
                <Input
                  type="number"
                  value={newJob.batchSize}
                  onChange={(e) => setNewJob({ ...newJob, batchSize: parseInt(e.target.value) || 4 })}
                  className="bg-black/50 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Learning Rate</Label>
                <Input
                  value={newJob.learningRate}
                  onChange={(e) => setNewJob({ ...newJob, learningRate: e.target.value })}
                  className="bg-black/50 border-gray-700"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Host</Label>
                <Select
                  value={newJob.hostId}
                  onValueChange={(v: any) => setNewJob({ ...newJob, hostId: v })}
                >
                  <SelectTrigger className="bg-black/50 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alpha">DGX Spark Alpha</SelectItem>
                    <SelectItem value="beta">DGX Spark Beta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>GPU Count</Label>
                <Input
                  type="number"
                  value={newJob.gpuCount}
                  onChange={(e) => setNewJob({ ...newJob, gpuCount: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={8}
                  className="bg-black/50 border-gray-700"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              disabled={!newJob.name || !newJob.datasetPath || createJobMutation.isPending}
              className="bg-nvidia-green hover:bg-nvidia-green/90"
            >
              {createJobMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Job
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Training() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-display font-bold tracking-wider text-foreground">
          TRAINING STUDIO
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fine-tuning recipes, MoE configuration, and training telemetry
        </p>
      </motion.div>
      
      {/* Active Training Job */}
      <motion.div variants={itemVariants}>
        <TrainingTelemetryCard />
      </motion.div>
      
      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <RecipeBuilderCard />
        </motion.div>
        <motion.div variants={itemVariants} className="space-y-6">
          <MoEParametersCard />
          <JobQueueCard />
        </motion.div>
      </div>
    </motion.div>
  );
}
