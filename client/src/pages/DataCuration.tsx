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
  Trash2,
  Move,
  Shield,
  CheckSquare,
  Square,
  Archive,
  Package,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Demo data imports - only used when DEMO_MODE is enabled
import {
  DEMO_MODE,
  DEMO_DATASETS,
  DEMO_QUALITY_METRICS,
  type DemoDataset,
  type DemoQualityMetrics,
} from "@/demo";

// Use demo data when DEMO_MODE is enabled, otherwise empty arrays (production fetches from API)
const DATASETS: DemoDataset[] = DEMO_MODE ? DEMO_DATASETS : [];
const QUALITY_METRICS: DemoQualityMetrics = DEMO_MODE ? DEMO_QUALITY_METRICS : {
  totalSamples: 0,
  validatedSamples: 0,
  duplicateRate: 0,
  avgTokenLength: 0,
  languageDistribution: [],
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
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [fileToRename, setFileToRename] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  // Multi-select state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [bulkMoveDestination, setBulkMoveDestination] = useState("");
  
  // Permissions state
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionsFile, setPermissionsFile] = useState<string | null>(null);
  
  // Drag and drop state
  const [draggedFiles, setDraggedFiles] = useState<string[]>([]);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Archive state
  const [showCreateArchive, setShowCreateArchive] = useState(false);
  const [archiveName, setArchiveName] = useState("");
  const [showExtractArchive, setShowExtractArchive] = useState(false);
  const [archiveToExtract, setArchiveToExtract] = useState<string | null>(null);
  const [extractSubfolder, setExtractSubfolder] = useState(true);

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

  const uploadFileMutation = trpc.ssh.uploadFile.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("File uploaded successfully", { description: data.path });
        refetch();
        setShowUpload(false);
      } else {
        toast.error("Upload failed", { description: data.error });
      }
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: (error) => {
      toast.error("Upload failed", { description: error.message });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  // Delete file mutation
  const deleteFileMutation = trpc.ssh.deleteFile.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Deleted successfully", { description: data.message });
        refetch();
      } else {
        toast.error("Delete failed", { description: data.error });
      }
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    },
    onError: (error) => {
      toast.error("Delete failed", { description: error.message });
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    },
  });

  // Rename file mutation
  const renameFileMutation = trpc.ssh.renameFile.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Renamed successfully", { description: data.message });
        refetch();
      } else {
        toast.error("Rename failed", { description: data.error });
      }
      setShowRename(false);
      setFileToRename(null);
      setNewFileName("");
    },
    onError: (error) => {
      toast.error("Rename failed", { description: error.message });
      setShowRename(false);
      setFileToRename(null);
      setNewFileName("");
    },
  });

  // Create directory mutation
  const createDirMutation = trpc.ssh.createDirectory.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Folder created", { description: data.path });
        refetch();
      } else {
        toast.error("Create folder failed", { description: data.error });
      }
      setShowCreateFolder(false);
      setNewFolderName("");
    },
    onError: (error) => {
      toast.error("Create folder failed", { description: error.message });
      setShowCreateFolder(false);
      setNewFolderName("");
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = trpc.ssh.bulkDelete.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message, { 
          description: (data.failCount ?? 0) > 0 ? `${data.failCount} items failed` : undefined 
        });
        refetch();
        setSelectedFiles(new Set());
      } else {
        toast.error("Bulk delete failed", { description: data.error });
      }
      setShowBulkDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error("Bulk delete failed", { description: error.message });
      setShowBulkDeleteConfirm(false);
    },
  });

  // Bulk move mutation
  const bulkMoveMutation = trpc.ssh.bulkMove.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message, { 
          description: (data.failCount ?? 0) > 0 ? `${data.failCount} items failed` : undefined 
        });
        refetch();
        setSelectedFiles(new Set());
      } else {
        toast.error("Bulk move failed", { description: data.error });
      }
      setShowBulkMove(false);
      setBulkMoveDestination("");
    },
    onError: (error) => {
      toast.error("Bulk move failed", { description: error.message });
      setShowBulkMove(false);
      setBulkMoveDestination("");
    },
  });

  // Permissions query
  const { data: permissionsData, isLoading: isLoadingPermissions, refetch: refetchPermissions } = trpc.ssh.getFilePermissions.useQuery(
    { hostId, path: permissionsFile || "" },
    { enabled: !!permissionsFile && showPermissions }
  );

  // Set permissions mutation
  const setPermissionsMutation = trpc.ssh.setFilePermissions.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Permissions updated", { description: data.message });
        refetchPermissions();
      } else {
        toast.error("Failed to update permissions", { description: data.error });
      }
    },
    onError: (error) => {
      toast.error("Failed to update permissions", { description: error.message });
    },
  });

  // Disk usage query
  const { data: diskUsageData } = trpc.ssh.getDiskUsage.useQuery(
    { hostId, path: currentPath },
    { refetchOnWindowFocus: false, refetchInterval: 30000 }
  );

  // Create archive mutation
  const createArchiveMutation = trpc.ssh.createArchive.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Archive created", { 
          description: `${data.archiveSizeFormatted} - ${data.filesIncluded} files` 
        });
        refetch();
        setSelectedFiles(new Set());
      } else {
        toast.error("Failed to create archive", { description: data.error });
      }
      setShowCreateArchive(false);
      setArchiveName("");
    },
    onError: (error) => {
      toast.error("Failed to create archive", { description: error.message });
      setShowCreateArchive(false);
    },
  });

  // Extract archive mutation
  const extractArchiveMutation = trpc.ssh.extractArchive.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Archive extracted", { 
          description: `${data.filesExtracted} files to ${data.extractDir}` 
        });
        refetch();
      } else {
        toast.error("Failed to extract archive", { description: data.error });
      }
      setShowExtractArchive(false);
      setArchiveToExtract(null);
    },
    onError: (error) => {
      toast.error("Failed to extract archive", { description: error.message });
      setShowExtractArchive(false);
    },
  });

  // Multi-select handlers
  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const selectAllFiles = () => {
    if (dirData?.items) {
      setSelectedFiles(new Set(dirData.items.map((item: any) => item.path)));
    }
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedFiles.size > 0) {
      setShowBulkDeleteConfirm(true);
    }
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate({ hostId, paths: Array.from(selectedFiles) });
  };

  const handleBulkMove = () => {
    if (selectedFiles.size > 0) {
      setBulkMoveDestination(currentPath);
      setShowBulkMove(true);
    }
  };

  const confirmBulkMove = () => {
    if (bulkMoveDestination) {
      bulkMoveMutation.mutate({ 
        hostId, 
        paths: Array.from(selectedFiles), 
        destinationDir: bulkMoveDestination 
      });
    }
  };

  const handleViewPermissions = (path: string) => {
    setPermissionsFile(path);
    setShowPermissions(true);
  };

  // Drag and drop handlers for file moving
  const handleFileDragStart = (e: React.DragEvent, filePath: string) => {
    // If the file is selected, drag all selected files
    // Otherwise, just drag this file
    const filesToDrag = selectedFiles.has(filePath) 
      ? Array.from(selectedFiles) 
      : [filePath];
    
    setDraggedFiles(filesToDrag);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(filesToDrag));
  };

  const handleFileDragEnd = () => {
    setDraggedFiles([]);
    setDropTargetFolder(null);
    setIsDragging(false);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragging && !draggedFiles.includes(folderPath)) {
      setDropTargetFolder(folderPath);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetFolder(null);
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedFiles.length > 0 && !draggedFiles.includes(targetFolder)) {
      // Move files to target folder
      bulkMoveMutation.mutate({
        hostId,
        paths: draggedFiles,
        destinationDir: targetFolder,
      });
    }
    
    setDraggedFiles([]);
    setDropTargetFolder(null);
    setIsDragging(false);
  };

  // Archive handlers
  const handleCreateArchive = () => {
    if (selectedFiles.size > 0) {
      const defaultName = selectedFiles.size === 1 
        ? Array.from(selectedFiles)[0].split("/").pop()?.replace(/\.[^.]+$/, "") || "archive"
        : "archive";
      setArchiveName(defaultName);
      setShowCreateArchive(true);
    }
  };

  const confirmCreateArchive = () => {
    if (archiveName && selectedFiles.size > 0) {
      createArchiveMutation.mutate({
        hostId,
        paths: Array.from(selectedFiles),
        archiveName,
        destinationDir: currentPath,
      });
    }
  };

  const handleExtractArchive = (archivePath: string) => {
    setArchiveToExtract(archivePath);
    setShowExtractArchive(true);
  };

  const confirmExtractArchive = () => {
    if (archiveToExtract) {
      extractArchiveMutation.mutate({
        hostId,
        archivePath: archiveToExtract,
        destinationDir: currentPath,
        createSubfolder: extractSubfolder,
      });
    }
  };

  const isArchiveFile = (fileType: string) => {
    return ["tar.gz", "tgz", "tar.bz2", "tar.xz", "tar", "zip", "archive"].includes(fileType.toLowerCase());
  };

  const handleDelete = (filePath: string) => {
    setFileToDelete(filePath);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (fileToDelete) {
      deleteFileMutation.mutate({ hostId, filePath: fileToDelete });
    }
  };

  const handleRename = (filePath: string) => {
    setFileToRename(filePath);
    const fileName = filePath.split("/").pop() || "";
    setNewFileName(fileName);
    setShowRename(true);
  };

  const confirmRename = () => {
    if (fileToRename && newFileName) {
      const parentPath = fileToRename.substring(0, fileToRename.lastIndexOf("/"));
      const newPath = `${parentPath}/${newFileName}`;
      renameFileMutation.mutate({ hostId, sourcePath: fileToRename, destinationPath: newPath });
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName) {
      const newPath = `${currentPath}/${newFolderName}`;
      createDirMutation.mutate({ hostId, path: newPath });
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB limit

    if (file.size > maxSize) {
      toast.error("File too large", { description: "Maximum file size is 10MB" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 50));
        }
      };
      reader.onload = async () => {
        setUploadProgress(60);
        const base64 = (reader.result as string).split(",")[1];
        setUploadProgress(80);
        
        await uploadFileMutation.mutateAsync({
          hostId,
          destinationPath: currentPath,
          fileName: file.name,
          content: base64,
          overwrite: false,
        });
        setUploadProgress(100);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploading(false);
        setUploadProgress(0);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error("Upload failed", { description: error.message });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

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
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1.5" 
              onClick={() => setShowUpload(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1.5" 
              onClick={() => setShowCreateFolder(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              New Folder
            </Button>
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

        {/* Disk Usage Bar */}
        {diskUsageData?.success && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Disk Usage</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {diskUsageData.formatted?.used} / {diskUsageData.formatted?.total} ({diskUsageData.usePercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  (diskUsageData.usePercent ?? 0) > 90 ? "bg-red-500" :
                  (diskUsageData.usePercent ?? 0) > 70 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${diskUsageData.usePercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>Available: {diskUsageData.formatted?.available}</span>
              <span>Current folder: {diskUsageData.formatted?.directorySize}</span>
            </div>
          </div>
        )}

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

        {/* Bulk Actions Toolbar */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
                {selectedFiles.size} selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={deselectAllFiles}
              >
                Clear selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleCreateArchive}
              >
                <Archive className="w-3.5 h-3.5" />
                Compress
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleBulkMove}
              >
                <Move className="w-3.5 h-3.5" />
                Move
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs text-red-400 border-red-400/50 hover:bg-red-500/10"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>
          </div>
        )}

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
            <div className="col-span-1 flex items-center">
              <Checkbox
                checked={dirData?.items && selectedFiles.size === dirData.items.length && dirData.items.length > 0}
                onCheckedChange={(checked) => checked ? selectAllFiles() : deselectAllFiles()}
                className="h-4 w-4"
              />
            </div>
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Modified</div>
            <div className="col-span-2 text-center">Actions</div>
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
                  draggable
                  onDragStart={(e) => handleFileDragStart(e, item.path)}
                  onDragEnd={handleFileDragEnd}
                  onDragOver={item.isDirectory ? (e) => handleFolderDragOver(e, item.path) : undefined}
                  onDragLeave={item.isDirectory ? handleFolderDragLeave : undefined}
                  onDrop={item.isDirectory ? (e) => handleFolderDrop(e, item.path) : undefined}
                  className={cn(
                    "w-full grid grid-cols-12 gap-2 px-4 py-2.5 text-xs hover:bg-muted/20 transition-colors text-left border-b border-border/30 last:border-0 cursor-grab active:cursor-grabbing",
                    selectedFile === item.path && "bg-purple-500/10",
                    selectedFiles.has(item.path) && "bg-purple-500/5",
                    draggedFiles.includes(item.path) && "opacity-50",
                    dropTargetFolder === item.path && "bg-green-500/20 border-green-500/50 border-2"
                  )}
                >
                  <div className="col-span-1 flex items-center">
                    <Checkbox
                      checked={selectedFiles.has(item.path)}
                      onCheckedChange={() => toggleFileSelection(item.path)}
                      className="h-4 w-4"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <button
                    onClick={() => item.isDirectory ? navigateTo(item.path) : handleSelectDataset(item.path)}
                    className="col-span-3 flex items-center gap-2 truncate text-left"
                  >
                    {getFileIcon(item.fileType)}
                    <span className={cn(item.isDirectory && "font-medium")}>{item.name}</span>
                    {item.isDirectory && isDragging && !draggedFiles.includes(item.path) && (
                      <span className="text-[10px] text-green-400 ml-1">(drop here)</span>
                    )}
                  </button>
                  <div className="col-span-2 text-muted-foreground flex items-center">{item.isDirectory ? "--" : item.sizeFormatted}</div>
                  <div className="col-span-2 flex items-center">
                    <Badge variant="outline" className="text-[10px] h-5">{item.fileType}</Badge>
                  </div>
                  <div className="col-span-2 text-muted-foreground flex items-center">{item.modified}</div>
                  <div className="col-span-2 flex items-center justify-center gap-1">
                    {!item.isDirectory && canPreview(item.fileType) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewFile(item.path);
                        }}
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {!item.isDirectory && isArchiveFile(item.fileType) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtractArchive(item.path);
                        }}
                        title="Extract Archive"
                      >
                        <Package className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPermissions(item.path);
                      }}
                      title="Permissions"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(item.path);
                      }}
                      title="Rename"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.path);
                      }}
                      title="Delete"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
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

        {/* Upload Modal */}
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                Upload File to DGX
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Destination:</span> {currentPath}
              </div>
              
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  dragOver ? "border-purple-500 bg-purple-500/10" : "border-border/50 hover:border-border",
                  isUploading && "pointer-events-none opacity-50"
                )}
              >
                {isUploading ? (
                  <div className="space-y-3">
                    <RefreshCw className="w-8 h-8 mx-auto animate-spin text-purple-400" />
                    <p className="text-sm">Uploading...</p>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm">Drag and drop a file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or</p>
                    <label className="mt-3 inline-block">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                      <span className="px-4 py-2 rounded-md bg-purple-500 hover:bg-purple-600 text-white text-sm cursor-pointer transition-colors">
                        Browse Files
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-4">Maximum file size: 10MB</p>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Confirm Delete
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">Are you sure you want to delete:</p>
              <p className="text-sm font-mono mt-2 p-2 bg-muted/30 rounded truncate">{fileToDelete}</p>
              <p className="text-xs text-red-400 mt-3">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={deleteFileMutation.isPending}
              >
                {deleteFileMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={showRename} onOpenChange={setShowRename}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rename File</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current name:</p>
                <p className="text-sm font-mono p-2 bg-muted/30 rounded truncate">{fileToRename?.split("/").pop()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">New name:</p>
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Enter new name"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRename(false)}>Cancel</Button>
              <Button 
                onClick={confirmRename}
                disabled={renameFileMutation.isPending || !newFileName.trim()}
              >
                {renameFileMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Renaming...</>
                ) : (
                  "Rename"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Folder Dialog */}
        <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Location:</p>
                <p className="text-sm font-mono p-2 bg-muted/30 rounded truncate">{currentPath}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Folder name:</p>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateFolder(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateFolder}
                disabled={createDirMutation.isPending || !newFolderName.trim()}
              >
                {createDirMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  "Create Folder"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <Trash2 className="w-5 h-5" />
                Delete {selectedFiles.size} Items
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-3">The following items will be deleted:</p>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-muted/30 rounded-lg">
                {Array.from(selectedFiles).map((path, i) => (
                  <p key={i} className="text-xs font-mono truncate">{path}</p>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={confirmBulkDelete}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
                ) : (
                  `Delete ${selectedFiles.size} Items`
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Move Dialog */}
        <Dialog open={showBulkMove} onOpenChange={setShowBulkMove}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Move className="w-5 h-5 text-purple-400" />
                Move {selectedFiles.size} Items
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Items to move:</p>
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted/30 rounded-lg">
                  {Array.from(selectedFiles).map((path, i) => (
                    <p key={i} className="text-xs font-mono truncate">{path.split("/").pop()}</p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Destination directory:</p>
                <Input
                  value={bulkMoveDestination}
                  onChange={(e) => setBulkMoveDestination(e.target.value)}
                  placeholder="/home/ubuntu/destination"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkMove(false)}>Cancel</Button>
              <Button 
                onClick={confirmBulkMove}
                disabled={bulkMoveMutation.isPending || !bulkMoveDestination.trim()}
              >
                {bulkMoveMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Moving...</>
                ) : (
                  "Move Items"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={showPermissions} onOpenChange={setShowPermissions}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                File Permissions
              </DialogTitle>
              <DialogDescription className="font-mono text-xs truncate">
                {permissionsFile}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {isLoadingPermissions ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : permissionsData?.success ? (
                <>
                  {/* Current Permissions */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Octal</p>
                      <p className="text-lg font-mono font-bold text-green-400">{permissionsData.octal}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Symbolic</p>
                      <p className="text-lg font-mono font-bold">{permissionsData.symbolic}</p>
                    </div>
                  </div>

                  {/* Owner/Group */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Owner</p>
                      <p className="text-sm font-mono">{permissionsData.owner}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Group</p>
                      <p className="text-sm font-mono">{permissionsData.group}</p>
                    </div>
                  </div>

                  {/* Permission Matrix */}
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border/50">
                      <div></div>
                      <div className="text-center">Read</div>
                      <div className="text-center">Write</div>
                      <div className="text-center">Execute</div>
                    </div>
                    {(["owner", "group", "others"] as const).map((entity) => (
                      <div key={entity} className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-border/30 last:border-0">
                        <div className="text-xs font-medium capitalize">{entity}</div>
                        <div className="flex justify-center">
                          <div className={cn(
                            "w-6 h-6 rounded flex items-center justify-center text-xs",
                            permissionsData.permissions?.[entity]?.read 
                              ? "bg-green-500/20 text-green-400" 
                              : "bg-muted/30 text-muted-foreground"
                          )}>
                            {permissionsData.permissions?.[entity]?.read ? "r" : "-"}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <div className={cn(
                            "w-6 h-6 rounded flex items-center justify-center text-xs",
                            permissionsData.permissions?.[entity]?.write 
                              ? "bg-yellow-500/20 text-yellow-400" 
                              : "bg-muted/30 text-muted-foreground"
                          )}>
                            {permissionsData.permissions?.[entity]?.write ? "w" : "-"}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <div className={cn(
                            "w-6 h-6 rounded flex items-center justify-center text-xs",
                            permissionsData.permissions?.[entity]?.execute 
                              ? "bg-blue-500/20 text-blue-400" 
                              : "bg-muted/30 text-muted-foreground"
                          )}>
                            {permissionsData.permissions?.[entity]?.execute ? "x" : "-"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick chmod */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Quick chmod:</p>
                    <div className="flex gap-2">
                      {["644", "755", "777", "600"].map((mode) => (
                        <Button
                          key={mode}
                          variant="outline"
                          size="sm"
                          className="font-mono"
                          onClick={() => {
                            if (permissionsFile) {
                              setPermissionsMutation.mutate({ hostId, path: permissionsFile, mode });
                            }
                          }}
                          disabled={setPermissionsMutation.isPending}
                        >
                          {mode}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mb-2" />
                  <p className="text-sm">Failed to load permissions</p>
                  <p className="text-xs mt-1">{permissionsData?.error}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowPermissions(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Archive Dialog */}
        <Dialog open={showCreateArchive} onOpenChange={setShowCreateArchive}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-purple-400" />
                Create Archive
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Files to compress:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {Array.from(selectedFiles).map((path, i) => (
                    <div key={i} className="text-xs truncate">
                      {path.split("/").pop()}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Archive Name</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={archiveName}
                    onChange={(e) => setArchiveName(e.target.value)}
                    placeholder="archive-name"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">.tar.gz</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Archive will be created in: {currentPath}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateArchive(false)}>Cancel</Button>
              <Button 
                onClick={confirmCreateArchive}
                disabled={!archiveName || createArchiveMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {createArchiveMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Archive className="w-4 h-4 mr-2" /> Create Archive</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Extract Archive Dialog */}
        <Dialog open={showExtractArchive} onOpenChange={setShowExtractArchive}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-400" />
                Extract Archive
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Archive:</p>
                <p className="text-sm font-medium truncate">{archiveToExtract?.split("/").pop()}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Destination</label>
                <Input value={currentPath} disabled className="bg-muted/30" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="subfolder"
                  checked={extractSubfolder}
                  onCheckedChange={(checked) => setExtractSubfolder(!!checked)}
                />
                <label htmlFor="subfolder" className="text-sm">
                  Create subfolder for extracted files
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowExtractArchive(false)}>Cancel</Button>
              <Button 
                onClick={confirmExtractArchive}
                disabled={extractArchiveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {extractArchiveMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Extracting...</>
                ) : (
                  <><Package className="w-4 h-4 mr-2" /> Extract</>
                )}
              </Button>
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
