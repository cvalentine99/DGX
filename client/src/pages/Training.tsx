/*
 * Training - Fine-Tuning Studio
 * 
 * Design: Recipe builder for SFT/PEFT/DPO, MoE hyperparameters,
 * job orchestration, and real-time training telemetry.
 */

import { useState } from "react";
import { motion } from "framer-motion";
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
  const handleStartJob = () => {
    toast.success("Training job started", {
      description: "Job queued on DGX Spark Alpha"
    });
  };

  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Play className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">Job Orchestration</CardTitle>
              <p className="text-xs text-muted-foreground">NeMo Run Integration</p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Target Host</Label>
          <Select defaultValue="spark-1">
            <SelectTrigger className="bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spark-1">DGX Spark Alpha (192.168.50.139)</SelectItem>
              <SelectItem value="spark-2">DGX Spark Beta (192.168.50.110)</SelectItem>
              <SelectItem value="both">Both Hosts (Distributed)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">Dataset</Label>
          <Select defaultValue="custom">
            <SelectTrigger className="bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">custom-instruct-v1</SelectItem>
              <SelectItem value="dolly">databricks-dolly-15k</SelectItem>
              <SelectItem value="alpaca">alpaca-cleaned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button className="w-full gap-2 bg-nvidia-green hover:bg-nvidia-green/90" onClick={handleStartJob}>
          <Play className="w-4 h-4" />
          Start Training Job
        </Button>
      </CardContent>
    </Card>
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
