/*
 * Data Curation - Dataset Management Hub
 * 
 * Design: Dataset browser, quality metrics, preprocessing pipelines,
 * and data validation tools for NeMo training workflows.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  BarChart2,
  Layers,
  RefreshCw,
  Eye,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// Dataset Catalog
const DATASETS = [
  {
    id: "custom-instruct-v1",
    name: "Custom Instruct Dataset v1",
    type: "Instruction",
    format: "JSONL",
    samples: 125000,
    size: "2.4 GB",
    quality: 94.2,
    status: "validated",
    lastModified: "2024-12-19",
  },
  {
    id: "dolly-15k",
    name: "Databricks Dolly 15k",
    type: "Instruction",
    format: "JSONL",
    samples: 15011,
    size: "48 MB",
    quality: 89.5,
    status: "validated",
    lastModified: "2024-12-15",
  },
  {
    id: "code-alpaca",
    name: "Code Alpaca 20k",
    type: "Code",
    format: "JSONL",
    samples: 20022,
    size: "156 MB",
    quality: 91.8,
    status: "validated",
    lastModified: "2024-12-10",
  },
  {
    id: "preference-v1",
    name: "DPO Preference Dataset",
    type: "Preference",
    format: "Parquet",
    samples: 45000,
    size: "890 MB",
    quality: 87.3,
    status: "processing",
    lastModified: "2024-12-20",
  },
];

// Quality Metrics
const QUALITY_METRICS = {
  totalSamples: 205033,
  validatedSamples: 192856,
  duplicateRate: 2.3,
  avgTokenLength: 847,
  languageDistribution: [
    { lang: "English", percent: 78 },
    { lang: "Code", percent: 15 },
    { lang: "Other", percent: 7 },
  ],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function DatasetCatalogCard() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredDatasets = DATASETS.filter(ds => 
    ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ds.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">Dataset Catalog</CardTitle>
              <p className="text-xs text-muted-foreground">{DATASETS.length} datasets available</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Feature coming soon")}>
              <Upload className="w-4 h-4" />
              Upload
            </Button>
            <Button variant="default" size="sm" className="gap-2 bg-nvidia-green hover:bg-nvidia-green/90" onClick={() => toast.info("Feature coming soon")}>
              <Plus className="w-4 h-4" />
              New Dataset
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/30"
          />
        </div>
        
        {/* Dataset List */}
        <div className="space-y-2">
          {filteredDatasets.map((dataset) => (
            <div 
              key={dataset.id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-nvidia-green/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  dataset.status === "validated" ? "bg-nvidia-green/20" : "bg-nvidia-warning/20"
                )}>
                  <FileText className={cn(
                    "w-5 h-5",
                    dataset.status === "validated" ? "text-nvidia-green" : "text-nvidia-warning"
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{dataset.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {dataset.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    <span>{dataset.samples.toLocaleString()} samples</span>
                    <span>{dataset.size}</span>
                    <span>{dataset.format}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    {dataset.status === "validated" ? (
                      <CheckCircle2 className="w-3 h-3 text-nvidia-green" />
                    ) : (
                      <RefreshCw className="w-3 h-3 text-nvidia-warning animate-spin" />
                    )}
                    <span className={cn(
                      "text-xs font-medium",
                      dataset.status === "validated" ? "text-nvidia-green" : "text-nvidia-warning"
                    )}>
                      {dataset.quality}% quality
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{dataset.lastModified}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Feature coming soon")}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Feature coming soon")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QualityMetricsCard() {
  const validationRate = (QUALITY_METRICS.validatedSamples / QUALITY_METRICS.totalSamples) * 100;
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-nvidia-teal" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">Quality Metrics</CardTitle>
            <p className="text-xs text-muted-foreground">Aggregate statistics</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Total Samples</div>
            <div className="text-xl font-mono font-bold">{QUALITY_METRICS.totalSamples.toLocaleString()}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Validation Rate</div>
            <div className="text-xl font-mono font-bold text-nvidia-green">{validationRate.toFixed(1)}%</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Duplicate Rate</span>
              <span className="font-mono text-nvidia-warning">{QUALITY_METRICS.duplicateRate}%</span>
            </div>
            <div className="progress-glow">
              <div 
                className="progress-glow-fill"
                style={{ 
                  width: `${QUALITY_METRICS.duplicateRate * 10}%`,
                  background: 'linear-gradient(90deg, oklch(0.75 0.18 55), oklch(0.58 0.22 25))'
                }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Avg Token Length</span>
            <span className="font-mono">{QUALITY_METRICS.avgTokenLength}</span>
          </div>
        </div>
        
        {/* Language Distribution */}
        <div className="pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground">Language Distribution</span>
          <div className="mt-2 space-y-2">
            {QUALITY_METRICS.languageDistribution.map((item) => (
              <div key={item.lang} className="flex items-center gap-2">
                <span className="text-xs w-16">{item.lang}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-nvidia-teal"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-10 text-right">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PreprocessingPipelineCard() {
  const pipelines = [
    { name: "Text Normalization", status: "active", progress: 100 },
    { name: "Deduplication", status: "active", progress: 100 },
    { name: "Quality Filtering", status: "running", progress: 67 },
    { name: "Tokenization", status: "pending", progress: 0 },
  ];

  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Layers className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-display tracking-wide">Preprocessing Pipeline</CardTitle>
            <p className="text-xs text-muted-foreground">Data transformation stages</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {pipelines.map((pipeline, index) => (
          <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono",
              pipeline.status === "active" ? "bg-nvidia-green/20 text-nvidia-green" :
              pipeline.status === "running" ? "bg-nvidia-teal/20 text-nvidia-teal" :
              "bg-muted text-muted-foreground"
            )}>
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{pipeline.name}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  pipeline.status === "active" ? "bg-nvidia-green/20 text-nvidia-green" :
                  pipeline.status === "running" ? "bg-nvidia-teal/20 text-nvidia-teal" :
                  "bg-muted text-muted-foreground"
                )}>
                  {pipeline.status.toUpperCase()}
                </span>
              </div>
              {pipeline.status === "running" && (
                <div className="progress-glow">
                  <div className="progress-glow-fill" style={{ width: `${pipeline.progress}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DataCuration() {
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
          DATA CURATION
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dataset management, quality metrics, and preprocessing pipelines
        </p>
      </motion.div>
      
      {/* Dataset Catalog */}
      <motion.div variants={itemVariants}>
        <DatasetCatalogCard />
      </motion.div>
      
      {/* Quality & Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <QualityMetricsCard />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PreprocessingPipelineCard />
        </motion.div>
      </div>
    </motion.div>
  );
}
