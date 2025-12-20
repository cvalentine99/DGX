import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  Download,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileJson,
  Database,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  Layers,
  Brain,
  Target,
  Shield,
  Network,
  Globe,
  Activity,
  Server,
  HardDrive,
  Pencil,
  Trash2,
  Save,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import ValidationPanel from "./ValidationPanel";
import {
  validateExtraHopResponse,
  getValidationStatusColor,
  getValidationStatusLabel,
  formatValidationErrors,
  ValidationResult,
  VALID_METRIC_CATEGORIES,
  VALID_OBJECT_TYPES,
} from "@/lib/extrahopSchema";

// Playbook icon mapping
const playbookIcons: Record<string, React.ElementType> = {
  slow_database: Database,
  http_errors: AlertCircle,
  ssl_audit: Shield,
  network_congestion: Network,
  threat_detection: Target,
  dns_analysis: Globe,
  voip_quality: Activity,
  ldap_auth: Server,
  dhcp_health: Network,
  storage_ops: HardDrive,
  site_tcp_overview: Layers,
};

// Playbook category colors
const categoryColors: Record<string, string> = {
  db_server: "text-purple-400 bg-purple-500/10",
  http_server: "text-blue-400 bg-blue-500/10",
  ssl_server: "text-green-400 bg-green-500/10",
  tcp: "text-orange-400 bg-orange-500/10",
  net: "text-red-400 bg-red-500/10",
  dns_server: "text-cyan-400 bg-cyan-500/10",
  sip: "text-pink-400 bg-pink-500/10",
  ldap_server: "text-indigo-400 bg-indigo-500/10",
  dhcp_server: "text-yellow-400 bg-yellow-500/10",
  nas: "text-emerald-400 bg-emerald-500/10",
};

interface GeneratedExample {
  id: string;
  playbook: string;
  category: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    reasoning_content?: string;
  }[];
  metadata: {
    timeRange: string;
    metrics: string[];
    objectType: string;
    generatedAt: string;
  };
  // Editing state
  status?: "original" | "edited" | "deleted";
  originalMessages?: {
    role: "user" | "assistant";
    content: string;
    reasoning_content?: string;
  }[];
  // Validation state
  validationResult?: ValidationResult;
}

interface GenerationResult {
  examples: GeneratedExample[];
  stats: {
    total: number;
    positive: number;
    negative: number;
    byPlaybook: Record<string, number>;
    byCategory: Record<string, number>;
  };
  format: string;
  generatedAt: string;
}

export default function TrainingDataGenerator() {
  const [count, setCount] = useState(100);
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<string[]>([]);
  const [includeNegatives, setIncludeNegatives] = useState(true);
  const [negativeRatio, setNegativeRatio] = useState(0.1);
  const [exportFormat, setExportFormat] = useState<"jsonl" | "json" | "chatml">("jsonl");
  const [generatedData, setGeneratedData] = useState<GenerationResult | null>(null);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedPlaybooks, setExpandedPlaybooks] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  
  // Editing state
  const [editingExample, setEditingExample] = useState<GeneratedExample | null>(null);
  const [editedUserContent, setEditedUserContent] = useState("");
  const [editedAssistantContent, setEditedAssistantContent] = useState("");
  const [editedReasoningContent, setEditedReasoningContent] = useState("");
  const [selectedExamples, setSelectedExamples] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "original" | "edited" | "deleted" | "valid" | "invalid">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Real-time validation for edit dialog
  const [editValidation, setEditValidation] = useState<ValidationResult | null>(null);

  // Fetch playbooks
  const { data: playbooks, isLoading: playbooksLoading } = trpc.trainingData.getPlaybooks.useQuery();
  
  // Fetch stats
  const { data: stats } = trpc.trainingData.getStats.useQuery();
  
  // Validate all examples when data changes
  const validateAllExamples = (examples: GeneratedExample[]): GeneratedExample[] => {
    return examples.map(ex => ({
      ...ex,
      validationResult: validateExtraHopResponse(ex.messages[1]?.content || ""),
    }));
  };
  
  // Generate mutation
  const generateMutation = trpc.trainingData.generate.useMutation({
    onSuccess: (data) => {
      // Add status and validation to each example
      const examplesWithStatus = data.examples.map(ex => ({
        ...ex,
        status: "original" as const,
        originalMessages: JSON.parse(JSON.stringify(ex.messages)),
        validationResult: validateExtraHopResponse(ex.messages[1]?.content || ""),
      }));
      setGeneratedData({ ...data, examples: examplesWithStatus });
      setIsGenerating(false);
      setSelectedExamples(new Set());
      setSelectedExampleId(null);
      
      // Count validation results
      const validCount = examplesWithStatus.filter(ex => ex.validationResult?.isValid).length;
      const invalidCount = examplesWithStatus.length - validCount;
      
      toast.success(`Generated ${data.stats.total} examples (${validCount} valid, ${invalidCount} need review)`);
    },
    onError: (error) => {
      setIsGenerating(false);
      toast.error(`Generation failed: ${error.message}`);
    },
  });

  // Export mutation
  const exportMutation = trpc.trainingData.export.useMutation({
    onSuccess: (data) => {
      const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `training-data-${Date.now()}.${exportFormat === "jsonl" ? "jsonl" : "json"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Training data exported successfully");
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate({
      count,
      playbooks: selectedPlaybooks.length > 0 ? selectedPlaybooks : undefined,
      includeNegatives,
      negativeRatio,
    });
  };

  const handleExport = () => {
    if (!generatedData) return;
    // Only export non-deleted examples
    const exportableExamples = generatedData.examples.filter(ex => ex.status !== "deleted");
    exportMutation.mutate({
      examples: exportableExamples,
      format: exportFormat,
    });
  };

  const togglePlaybook = (playbookId: string) => {
    setSelectedPlaybooks(prev =>
      prev.includes(playbookId)
        ? prev.filter(id => id !== playbookId)
        : [...prev, playbookId]
    );
  };

  const selectAllPlaybooks = () => {
    if (playbooks) {
      setSelectedPlaybooks(playbooks.map(p => p.id));
    }
  };

  const clearPlaybooks = () => {
    setSelectedPlaybooks([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Get the currently selected example for preview
  const selectedExample = generatedData?.examples.find(ex => ex.id === selectedExampleId);

  // Filter examples based on status, validation, and search
  const filteredExamples = useMemo(() => {
    if (!generatedData) return [];
    
    return generatedData.examples.filter(ex => {
      // Status filter
      if (filterStatus === "valid") {
        if (!ex.validationResult?.isValid) return false;
      } else if (filterStatus === "invalid") {
        if (ex.validationResult?.isValid !== false) return false;
      } else if (filterStatus !== "all" && ex.status !== filterStatus) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          ex.id.toLowerCase().includes(query) ||
          ex.playbook.toLowerCase().includes(query) ||
          ex.messages[0].content.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [generatedData, filterStatus, searchQuery]);

  // Start editing an example
  const startEditing = (example: GeneratedExample) => {
    setEditingExample(example);
    setEditedUserContent(example.messages[0].content);
    setEditedAssistantContent(example.messages[1].content);
    setEditedReasoningContent(example.messages[1].reasoning_content || "");
    // Validate immediately
    setEditValidation(validateExtraHopResponse(example.messages[1].content));
  };

  // Real-time validation as user edits
  const handleAssistantContentChange = (value: string) => {
    setEditedAssistantContent(value);
    // Debounced validation
    setEditValidation(validateExtraHopResponse(value));
  };

  // Save edited example
  const saveEdit = () => {
    if (!editingExample || !generatedData) return;

    const newValidation = validateExtraHopResponse(editedAssistantContent);
    
    const updatedExamples = generatedData.examples.map(ex => {
      if (ex.id === editingExample.id) {
        return {
          ...ex,
          status: "edited" as const,
          messages: [
            { ...ex.messages[0], content: editedUserContent },
            { 
              ...ex.messages[1], 
              content: editedAssistantContent,
              reasoning_content: editedReasoningContent || undefined,
            },
          ],
          validationResult: newValidation,
        };
      }
      return ex;
    });

    setGeneratedData({ ...generatedData, examples: updatedExamples });
    setEditingExample(null);
    setEditValidation(null);
    
    if (newValidation.isValid) {
      toast.success("Example updated and validated successfully");
    } else {
      toast.warning("Example saved with validation errors");
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingExample(null);
    setEditValidation(null);
  };

  // Revert an edited example to original
  const revertExample = (exampleId: string) => {
    if (!generatedData) return;

    const updatedExamples = generatedData.examples.map(ex => {
      if (ex.id === exampleId && ex.originalMessages) {
        const originalContent = ex.originalMessages[1]?.content || "";
        return {
          ...ex,
          status: "original" as const,
          messages: JSON.parse(JSON.stringify(ex.originalMessages)),
          validationResult: validateExtraHopResponse(originalContent),
        };
      }
      return ex;
    });

    setGeneratedData({ ...generatedData, examples: updatedExamples });
    toast.success("Example reverted to original");
  };

  // Delete single example
  const deleteExample = (exampleId: string) => {
    if (!generatedData) return;

    const updatedExamples = generatedData.examples.map(ex => {
      if (ex.id === exampleId) {
        return { ...ex, status: "deleted" as const };
      }
      return ex;
    });

    setGeneratedData({ ...generatedData, examples: updatedExamples });
    if (selectedExampleId === exampleId) {
      setSelectedExampleId(null);
    }
    toast.success("Example marked for deletion");
  };

  // Restore deleted example
  const restoreExample = (exampleId: string) => {
    if (!generatedData) return;

    const updatedExamples = generatedData.examples.map(ex => {
      if (ex.id === exampleId) {
        const wasEdited = ex.originalMessages && 
          JSON.stringify(ex.messages) !== JSON.stringify(ex.originalMessages);
        return { ...ex, status: wasEdited ? "edited" as const : "original" as const };
      }
      return ex;
    });

    setGeneratedData({ ...generatedData, examples: updatedExamples });
    toast.success("Example restored");
  };

  // Toggle example selection
  const toggleExampleSelection = (exampleId: string) => {
    const newSelected = new Set(selectedExamples);
    if (newSelected.has(exampleId)) {
      newSelected.delete(exampleId);
    } else {
      newSelected.add(exampleId);
    }
    setSelectedExamples(newSelected);
  };

  // Select all visible examples
  const selectAllVisible = () => {
    const visibleIds = filteredExamples.map(ex => ex.id);
    setSelectedExamples(new Set(visibleIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedExamples(new Set());
  };

  // Bulk delete selected examples
  const bulkDelete = () => {
    if (!generatedData || selectedExamples.size === 0) return;

    const updatedExamples = generatedData.examples.map(ex => {
      if (selectedExamples.has(ex.id)) {
        return { ...ex, status: "deleted" as const };
      }
      return ex;
    });

    setGeneratedData({ ...generatedData, examples: updatedExamples });
    setSelectedExamples(new Set());
    setShowDeleteConfirm(false);
    toast.success(`${selectedExamples.size} examples marked for deletion`);
  };

  // Get counts by status
  const statusCounts = useMemo(() => {
    if (!generatedData) return { total: 0, original: 0, edited: 0, deleted: 0, valid: 0, invalid: 0 };
    
    return {
      total: generatedData.examples.length,
      original: generatedData.examples.filter(ex => ex.status === "original").length,
      edited: generatedData.examples.filter(ex => ex.status === "edited").length,
      deleted: generatedData.examples.filter(ex => ex.status === "deleted").length,
      valid: generatedData.examples.filter(ex => ex.status !== "deleted" && ex.validationResult?.isValid).length,
      invalid: generatedData.examples.filter(ex => ex.status !== "deleted" && ex.validationResult?.isValid === false).length,
    };
  }, [generatedData]);

  // Get status badge color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "edited": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "deleted": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-green-500/20 text-green-400 border-green-500/30";
    }
  };

  // Get validation icon
  const getValidationIcon = (result?: ValidationResult) => {
    if (!result) return null;
    if (!result.isValid) return <ShieldX className="w-3 h-3 text-red-400" />;
    if (result.warnings.length > 0) return <ShieldAlert className="w-3 h-3 text-yellow-400" />;
    return <ShieldCheck className="w-3 h-3 text-green-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Playbooks</p>
                <p className="text-2xl font-bold text-primary">{stats?.playbooks || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Query Templates</p>
                <p className="text-2xl font-bold">{stats?.totalQueryTemplates || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Metrics Covered</p>
                <p className="text-2xl font-bold">{stats?.totalMetrics || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Est. Combinations</p>
                <p className="text-2xl font-bold">{stats?.estimatedCombinations?.toLocaleString() || "∞"}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Configuration Panel */}
        <Card className="xl:col-span-3 bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Generator Configuration
            </CardTitle>
            <CardDescription>
              Configure synthetic training data generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Count Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Examples to Generate</Label>
                <span className="text-sm font-mono text-primary">{count}</span>
              </div>
              <Slider
                value={[count]}
                onValueChange={([v]) => setCount(v)}
                min={10}
                max={1000}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10</span>
                <span>500</span>
                <span>1000</span>
              </div>
            </div>

            {/* Playbook Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Playbooks</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAllPlaybooks} className="h-6 px-2 text-xs">
                    All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearPlaybooks} className="h-6 px-2 text-xs">
                    Clear
                  </Button>
                </div>
              </div>
              <Collapsible open={expandedPlaybooks} onOpenChange={setExpandedPlaybooks}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>
                      {selectedPlaybooks.length === 0
                        ? "All Playbooks"
                        : `${selectedPlaybooks.length} selected`}
                    </span>
                    {expandedPlaybooks ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <ScrollArea className="h-[200px] rounded-md border border-border p-2">
                    {playbooksLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {playbooks?.map(playbook => {
                          const Icon = playbookIcons[playbook.id] || Layers;
                          return (
                            <div
                              key={playbook.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                selectedPlaybooks.includes(playbook.id)
                                  ? "bg-primary/20"
                                  : "hover:bg-white/5"
                              }`}
                              onClick={() => togglePlaybook(playbook.id)}
                            >
                              <Checkbox
                                checked={selectedPlaybooks.includes(playbook.id)}
                                className="pointer-events-none"
                              />
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm truncate">{playbook.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Negative Examples */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Include Negative Examples</Label>
                <Switch
                  checked={includeNegatives}
                  onCheckedChange={setIncludeNegatives}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Queries the agent should refuse
              </p>
            </div>

            {includeNegatives && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Negative Ratio</Label>
                  <span className="text-sm font-mono">{Math.round(negativeRatio * 100)}%</span>
                </div>
                <Slider
                  value={[negativeRatio]}
                  onValueChange={([v]) => setNegativeRatio(v)}
                  min={0.05}
                  max={0.3}
                  step={0.05}
                  className="w-full"
                />
              </div>
            )}

            {/* Export Format */}
            <div className="space-y-3">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jsonl">JSONL (One per line)</SelectItem>
                  <SelectItem value="json">JSON Array</SelectItem>
                  <SelectItem value="chatml">ChatML Format</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate Training Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Example Browser */}
        <Card className="xl:col-span-5 bg-card/50 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Example Browser
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {filteredExamples.length} exportable examples
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {generatedData ? (
              <div className="space-y-3">
                {/* Status Filter Tabs */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filterStatus === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("all")}
                  >
                    All ({statusCounts.total})
                  </Button>
                  <Button
                    variant={filterStatus === "original" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("original")}
                  >
                    Original ({statusCounts.original})
                  </Button>
                  <Button
                    variant={filterStatus === "edited" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("edited")}
                  >
                    Edited ({statusCounts.edited})
                  </Button>
                  <Button
                    variant={filterStatus === "deleted" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("deleted")}
                  >
                    Deleted ({statusCounts.deleted})
                  </Button>
                  <div className="border-l border-border mx-1" />
                  <Button
                    variant={filterStatus === "valid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("valid")}
                    className="gap-1"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Valid ({statusCounts.valid})
                  </Button>
                  <Button
                    variant={filterStatus === "invalid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("invalid")}
                    className="gap-1"
                  >
                    <ShieldX className="w-3 h-3" />
                    Invalid ({statusCounts.invalid})
                  </Button>
                </div>

                {/* Search and Bulk Actions */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Search examples..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={selectAllVisible}
                    title="Select all visible"
                  >
                    <CheckSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={clearSelection}
                    title="Clear selection"
                    disabled={selectedExamples.size === 0}
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                </div>

                {/* Example List */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 pr-2">
                    {filteredExamples.map(example => (
                      <motion.div
                        key={example.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-2 rounded-lg border cursor-pointer transition-all ${
                          selectedExampleId === example.id
                            ? "bg-primary/20 border-primary/50"
                            : "bg-black/20 border-white/5 hover:bg-white/5"
                        } ${example.status === "deleted" ? "opacity-50" : ""}`}
                        onClick={() => setSelectedExampleId(example.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedExamples.has(example.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExampleSelection(example.id);
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">
                                {example.id}
                              </span>
                              <Badge className={`text-xs ${getStatusColor(example.status)}`}>
                                {example.status || "original"}
                              </Badge>
                              <Tooltip>
                                <TooltipTrigger>
                                  {getValidationIcon(example.validationResult)}
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-semibold mb-1">
                                    {getValidationStatusLabel(example.validationResult!)}
                                  </p>
                                  {example.validationResult && (example.validationResult.errors.length > 0 || example.validationResult.warnings.length > 0) && (
                                    <pre className="text-xs whitespace-pre-wrap">
                                      {formatValidationErrors(example.validationResult)}
                                    </pre>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <p className="text-sm truncate mt-1">
                              {example.messages[0].content}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {example.playbook}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {example.status !== "deleted" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(example);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteExample(example.id);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  restoreExample(example.id);
                                }}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Bulk Actions */}
                {selectedExamples.size > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-sm">
                      {selectedExamples.size} selected
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Selected
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Database className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Generate training data to browse examples</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Example Detail Panel */}
        <Card className="xl:col-span-4 bg-card/50 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Example Detail
                </CardTitle>
                <CardDescription>
                  {selectedExample ? selectedExample.id : "Select an example to view details"}
                </CardDescription>
              </div>
              {generatedData && (
                <div className="flex gap-2">
                  <Button
                    variant={showValidation ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowValidation(!showValidation)}
                    className="gap-1"
                  >
                    <Shield className="w-3 h-3" />
                    Validate
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleExport} 
                    className="gap-1"
                    disabled={statusCounts.total - statusCounts.deleted === 0}
                  >
                    <Download className="w-3 h-3" />
                    Export ({statusCounts.total - statusCounts.deleted})
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedExample ? (
              <ScrollArea className="h-[450px]">
                <div className="space-y-4 pr-2">
                  {/* Status and Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(selectedExample.status)}>
                        {selectedExample.status || "original"}
                      </Badge>
                      <Badge variant="outline">{selectedExample.playbook}</Badge>
                      <Badge variant="outline">{selectedExample.category}</Badge>
                    </div>
                    <div className="flex gap-1">
                      {selectedExample.status === "edited" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revertExample(selectedExample.id)}
                          className="gap-1 text-yellow-400"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Revert
                        </Button>
                      )}
                      {selectedExample.status !== "deleted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(selectedExample)}
                          className="gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Validation Status */}
                  {selectedExample.validationResult && (
                    <div className={`p-3 rounded-lg border ${getValidationStatusColor(selectedExample.validationResult)}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {getValidationIcon(selectedExample.validationResult)}
                        <span className="text-sm font-medium">
                          Schema Validation: {getValidationStatusLabel(selectedExample.validationResult)}
                        </span>
                      </div>
                      {(selectedExample.validationResult.errors.length > 0 || selectedExample.validationResult.warnings.length > 0) && (
                        <div className="text-xs space-y-1">
                          {selectedExample.validationResult.errors.map((err, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <X className="w-3 h-3 mt-0.5 text-red-400 shrink-0" />
                              <span><strong>{err.field}:</strong> {err.message}</span>
                            </div>
                          ))}
                          {selectedExample.validationResult.warnings.map((warn, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-400 shrink-0" />
                              <span><strong>{warn.field}:</strong> {warn.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* User Message */}
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-blue-400">User Query</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(selectedExample.messages[0].content)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-sm">{selectedExample.messages[0].content}</p>
                  </div>

                  {/* Assistant Reasoning */}
                  {selectedExample.messages[1].reasoning_content && (
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-purple-400">Reasoning</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(selectedExample.messages[1].reasoning_content || "")}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedExample.messages[1].reasoning_content}
                      </p>
                    </div>
                  )}

                  {/* Assistant Response */}
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-green-400">Response</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(selectedExample.messages[1].content)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {selectedExample.messages[1].content.startsWith("{")
                        ? JSON.stringify(JSON.parse(selectedExample.messages[1].content), null, 2)
                        : selectedExample.messages[1].content}
                    </pre>
                  </div>

                  {/* Metadata */}
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <Label className="text-xs text-muted-foreground mb-2 block">Metadata</Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Database className="w-3 h-3" />
                        {selectedExample.metadata.objectType}
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-xs">
                        Time: {selectedExample.metadata.timeRange}
                      </Badge>
                      {selectedExample.metadata.metrics.slice(0, 3).map(metric => (
                        <Badge key={metric} variant="outline" className="text-xs">
                          {metric}
                        </Badge>
                      ))}
                      {selectedExample.metadata.metrics.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{selectedExample.metadata.metrics.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-[450px] text-muted-foreground">
                <Eye className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Select an example from the browser</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation Panel */}
      {showValidation && generatedData && (
        <ValidationPanel
          examples={generatedData.examples.filter(ex => ex.status !== "deleted")}
          onValidationComplete={(result) => {
            console.log("Validation complete:", result);
          }}
        />
      )}

      {/* Edit Dialog with Real-time Validation */}
      <Dialog open={!!editingExample} onOpenChange={(open) => !open && cancelEdit()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit Training Example
            </DialogTitle>
            <DialogDescription>
              {editingExample?.id} - {editingExample?.playbook}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-4">
            {/* Left Column - Editor */}
            <div className="space-y-4">
              {/* User Query */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-400">User Query</Badge>
                </Label>
                <Textarea
                  value={editedUserContent}
                  onChange={(e) => setEditedUserContent(e.target.value)}
                  className="min-h-[80px] font-mono text-sm"
                  placeholder="Enter user query..."
                />
              </div>

              {/* Reasoning */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Badge variant="outline" className="text-purple-400">Reasoning (Optional)</Badge>
                </Label>
                <Textarea
                  value={editedReasoningContent}
                  onChange={(e) => setEditedReasoningContent(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                  placeholder="Enter chain-of-thought reasoning..."
                />
              </div>

              {/* Response */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-400">Assistant Response</Badge>
                  {editValidation && (
                    <Badge className={getValidationStatusColor(editValidation)}>
                      {getValidationStatusLabel(editValidation)}
                    </Badge>
                  )}
                </Label>
                <Textarea
                  value={editedAssistantContent}
                  onChange={(e) => handleAssistantContentChange(e.target.value)}
                  className={`min-h-[150px] font-mono text-sm ${
                    editValidation && !editValidation.isValid ? "border-red-500/50" : ""
                  }`}
                  placeholder="Enter assistant response (JSON or text)..."
                />
              </div>
            </div>

            {/* Right Column - Validation Details */}
            <div className="space-y-4">
              {/* Validation Status Card */}
              <Card className={`border ${editValidation ? getValidationStatusColor(editValidation) : "border-border"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Schema Validation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editValidation ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {getValidationIcon(editValidation)}
                        <span className="font-medium">
                          {editValidation.isValid ? "Valid ExtraHop API Request" : "Invalid Response"}
                        </span>
                      </div>

                      {/* Errors */}
                      {editValidation.errors.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-red-400">Errors ({editValidation.errors.length})</Label>
                          <div className="space-y-1">
                            {editValidation.errors.map((err, i) => (
                              <div key={i} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs">
                                <span className="font-mono text-red-400">{err.field}</span>
                                <p className="text-muted-foreground mt-1">{err.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {editValidation.warnings.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-yellow-400">Warnings ({editValidation.warnings.length})</Label>
                          <div className="space-y-1">
                            {editValidation.warnings.map((warn, i) => (
                              <div key={i} className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs">
                                <span className="font-mono text-yellow-400">{warn.field}</span>
                                <p className="text-muted-foreground mt-1">{warn.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parsed Response Preview */}
                      {editValidation.parsedResponse && (
                        <div className="space-y-2">
                          <Label className="text-xs text-green-400">Parsed Response</Label>
                          <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Category:</span>
                                <span className="ml-2 font-mono">{editValidation.parsedResponse.metric_category}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Object Type:</span>
                                <span className="ml-2 font-mono">{editValidation.parsedResponse.object_type}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Metrics:</span>
                                <span className="ml-2 font-mono">
                                  {editValidation.parsedResponse.metric_specs.map(m => m.name).join(", ")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Enter a JSON response to see validation results
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Schema Reference */}
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Schema Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div>
                    <Label className="text-muted-foreground">Required Fields:</Label>
                    <p className="font-mono">metric_category, object_type, metric_specs[]</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valid Categories:</Label>
                    <p className="font-mono text-xs">
                      {VALID_METRIC_CATEGORIES.slice(0, 6).join(", ")}...
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valid Object Types:</Label>
                    <p className="font-mono">{VALID_OBJECT_TYPES.join(", ")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={saveEdit}
              variant={editValidation?.isValid ? "default" : "secondary"}
            >
              <Save className="w-4 h-4 mr-2" />
              {editValidation?.isValid ? "Save Changes" : "Save Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Confirm Bulk Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to mark {selectedExamples.size} examples for deletion?
              They will be excluded from export but can be restored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={bulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedExamples.size} Examples
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
