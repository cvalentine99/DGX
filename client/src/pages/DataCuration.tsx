/*
 * Data Curation - Dataset Management Hub
 * 
 * Design: Dataset browser, quality metrics, preprocessing pipelines,
 * training data generation, and validation tools for NeMo workflows.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Database,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Search,
  BarChart2,
  Layers,
  RefreshCw,
  Eye,
  Plus,
  Sparkles,
  Folder,
  FolderOpen,
  File,
  FileJson,
  FileCode,
  FileArchive,
  ChevronRight,
  ArrowLeft,
  HardDrive,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import TrainingDataGenerator from "@/components/TrainingDataGenerator";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
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
            <Button variant="default" size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={() => toast.info("Feature coming soon")}>
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
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  dataset.status === "validated" ? "bg-blue-500/20" : "bg-yellow-500/20"
                )}>
                  <FileText className={cn(
                    "w-5 h-5",
                    dataset.status === "validated" ? "text-blue-400" : "text-yellow-400"
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
                      <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    ) : (
                      <RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" />
                    )}
                    <span className={cn(
                      "text-xs font-medium",
                      dataset.status === "validated" ? "text-blue-400" : "text-yellow-400"
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
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-cyan-400" />
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
            <div className="text-xl font-mono font-bold text-blue-400">{validationRate.toFixed(1)}%</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Duplicate Rate</span>
              <span className="font-mono text-yellow-400">{QUALITY_METRICS.duplicateRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div 
                className="h-full rounded-full bg-yellow-400"
                style={{ width: `${QUALITY_METRICS.duplicateRate * 10}%` }}
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
                    className="h-full rounded-full bg-cyan-400"
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
    <Card className="bg-card/50 border-border">
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
              pipeline.status === "active" ? "bg-blue-500/20 text-blue-400" :
              pipeline.status === "running" ? "bg-cyan-500/20 text-cyan-400" :
              "bg-muted text-muted-foreground"
            )}>
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{pipeline.name}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  pipeline.status === "active" ? "bg-blue-500/20 text-blue-400" :
                  pipeline.status === "running" ? "bg-cyan-500/20 text-cyan-400" :
                  "bg-muted text-muted-foreground"
                )}>
                  {pipeline.status.toUpperCase()}
                </span>
              </div>
              {pipeline.status === "running" && (
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pipeline.progress}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// File Browser Card - Browse DGX filesystem for datasets
function FileBrowserCard() {
  const [hostId, setHostId] = useState<"alpha" | "beta">("alpha");
  const [currentPath, setCurrentPath] = useState("/home/ubuntu");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: dirData, isLoading, refetch } = trpc.ssh.listDirectory.useQuery(
    { hostId, path: currentPath },
    { refetchOnWindowFocus: false }
  );

  const { data: searchResults, isLoading: isSearching } = trpc.ssh.searchFiles.useQuery(
    { hostId, basePath: currentPath, pattern: searchQuery, maxResults: 20 },
    { enabled: searchQuery.length > 2 }
  );

  const { data: filePreview, isLoading: isLoadingPreview } = trpc.ssh.readFile.useQuery(
    { hostId, path: previewFile || "", maxSize: 100 * 1024 },
    { enabled: !!previewFile && showPreview }
  );

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
  };

  const goUp = () => {
    if (dirData?.parentPath) {
      navigateTo(dirData.parentPath);
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "directory": return <Folder className="w-4 h-4 text-yellow-400" />;
      case "json": return <FileJson className="w-4 h-4 text-green-400" />;
      case "csv": return <FileText className="w-4 h-4 text-blue-400" />;
      case "parquet": return <Database className="w-4 h-4 text-purple-400" />;
      case "model": return <HardDrive className="w-4 h-4 text-orange-400" />;
      case "script": return <FileCode className="w-4 h-4 text-cyan-400" />;
      case "archive": return <FileArchive className="w-4 h-4 text-red-400" />;
      default: return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleSelectDataset = (path: string) => {
    setSelectedFile(path);
    toast.success(`Selected: ${path}`, { description: "Use this path in your training configuration" });
  };

  const canPreview = (fileType: string) => {
    return ["json", "csv", "text", "script", "markdown"].includes(fileType);
  };

  const handlePreviewFile = (path: string) => {
    setPreviewFile(path);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewFile(null);
  };

  const renderPreviewContent = () => {
    if (isLoadingPreview) {
      return (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!filePreview?.success || !filePreview.content) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mb-2" />
          <p>Failed to load file preview</p>
          <p className="text-xs mt-1">{filePreview?.error || "Unknown error"}</p>
        </div>
      );
    }

    const { content, fileType, truncated, fileSize } = filePreview;

    if (fileType === "json") {
      try {
        const parsed = JSON.parse(content);
        return (
          <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-96">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      } catch {
        // JSONL format - show line by line
        return (
          <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
            {content}
          </pre>
        );
      }
    }

    if (fileType === "csv") {
      const lines = content.split("\n").filter(Boolean).slice(0, 50);
      const headers = lines[0]?.split(",") || [];
      const rows = lines.slice(1).map(line => line.split(","));
      return (
        <div className="overflow-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium border-b border-border/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 border-b border-border/30 truncate max-w-[200px]">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Default text/code preview
    return (
      <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
        {content}
      </pre>
    );
  };

  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">DGX File Browser</CardTitle>
              <p className="text-xs text-muted-foreground">Browse datasets on DGX Spark hosts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={hostId} onValueChange={(v) => setHostId(v as "alpha" | "beta")}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alpha">DGX Spark Alpha</SelectItem>
                <SelectItem value="beta">DGX Spark Beta</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetch()}>
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Path Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goUp} disabled={currentPath === "/"}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50 overflow-x-auto">
            {currentPath.split("/").filter(Boolean).map((segment, i, arr) => (
              <div key={i} className="flex items-center">
                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground mx-1" />}
                <button
                  onClick={() => navigateTo("/" + arr.slice(0, i + 1).join("/"))}
                  className="text-xs hover:text-foreground text-muted-foreground transition-colors"
                >
                  {segment}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/30"
          />
        </div>

        {/* Search Results */}
        {searchQuery.length > 2 && searchResults?.results && searchResults.results.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-2">
            <p className="text-xs text-muted-foreground">Search Results ({searchResults.results.length})</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.results.map((file: { path: string; name: string }, i: number) => (
                <button
                  key={i}
                  onClick={() => handleSelectDataset(file.path)}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted/30 text-left text-xs"
                >
                  <File className="w-3 h-3 text-muted-foreground" />
                  <span className="truncate">{file.path}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File List */}
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border/50">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Modified</div>
            <div className="col-span-1 text-center">Preview</div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : dirData?.items && dirData.items.length > 0 ? (
              dirData.items.map((item: {
                name: string;
                path: string;
                isDirectory: boolean;
                fileType: string;
                sizeFormatted: string;
                modified: string;
              }, i: number) => (
                <div
                  key={i}
                  className={cn(
                    "w-full grid grid-cols-12 gap-2 px-4 py-2.5 text-xs hover:bg-muted/20 transition-colors text-left border-b border-border/30 last:border-0",
                    selectedFile === item.path && "bg-purple-500/10"
                  )}
                >
                  <button
                    onClick={() => item.isDirectory ? navigateTo(item.path) : handleSelectDataset(item.path)}
                    className="col-span-5 flex items-center gap-2 truncate text-left"
                  >
                    {getFileIcon(item.fileType)}
                    <span className={cn(item.isDirectory && "font-medium")}>{item.name}</span>
                  </button>
                  <div className="col-span-2 text-muted-foreground flex items-center">{item.isDirectory ? "--" : item.sizeFormatted}</div>
                  <div className="col-span-2 flex items-center">
                    <Badge variant="outline" className="text-[10px] h-5">{item.fileType}</Badge>
                  </div>
                  <div className="col-span-2 text-muted-foreground flex items-center">{item.modified}</div>
                  <div className="col-span-1 flex items-center justify-center">
                    {!item.isDirectory && canPreview(item.fileType) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewFile(item.path);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No files found</p>
                <p className="text-xs mt-1">This directory is empty or inaccessible</p>
              </div>
            )}
          </div>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Selected Dataset Path</p>
                <p className="text-sm font-mono mt-1">{selectedFile}</p>
              </div>
              <div className="flex gap-2">
                {canPreview(selectedFile.split(".").pop() || "") && (
                  <Button size="sm" variant="outline" onClick={() => handlePreviewFile(selectedFile)}>
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                )}
                <Button size="sm" onClick={() => {
                  navigator.clipboard.writeText(selectedFile);
                  toast.success("Path copied to clipboard");
                }}>
                  Copy Path
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* File Preview Modal */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-sm font-mono truncate pr-4">
                  {previewFile?.split("/").pop()}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {filePreview?.truncated && (
                    <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-400/50">
                      Truncated (showing first 100KB)
                    </Badge>
                  )}
                  {filePreview?.success && filePreview.content && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        const blob = new Blob([filePreview.content], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = previewFile?.split("/").pop() || "download.txt";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success("File downloaded", { description: previewFile?.split("/").pop() });
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground truncate">{previewFile}</p>
            </DialogHeader>
            <div className="mt-4 overflow-auto">
              {renderPreviewContent()}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function DataCuration() {
  const [activeTab, setActiveTab] = useState("datasets");

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
          Dataset management, synthetic data generation, and preprocessing pipelines
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 bg-muted/30">
            <TabsTrigger value="datasets" className="gap-2">
              <Database className="w-4 h-4" />
              Datasets
            </TabsTrigger>
            <TabsTrigger value="generator" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Training Generator
            </TabsTrigger>
            <TabsTrigger value="browser" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              File Browser
            </TabsTrigger>
          </TabsList>

          <TabsContent value="datasets" className="mt-6 space-y-6">
            {/* Dataset Catalog */}
            <DatasetCatalogCard />
            
            {/* Quality & Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <QualityMetricsCard />
              <PreprocessingPipelineCard />
            </div>
          </TabsContent>

          <TabsContent value="generator" className="mt-6">
            <TrainingDataGenerator />
          </TabsContent>

          <TabsContent value="browser" className="mt-6">
            <FileBrowserCard />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
