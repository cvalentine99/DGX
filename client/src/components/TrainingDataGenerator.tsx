import { useState, useCallback } from "react";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import ValidationPanel from "./ValidationPanel";

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
  const [filterStatus, setFilterStatus] = useState<"all" | "original" | "edited" | "deleted">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch playbooks
  const { data: playbooks, isLoading: playbooksLoading } = trpc.trainingData.getPlaybooks.useQuery();
  
  // Fetch stats
  const { data: stats } = trpc.trainingData.getStats.useQuery();
  
  // Generate mutation
  const generateMutation = trpc.trainingData.generate.useMutation({
    onSuccess: (data) => {
      // Add status to each example
      const examplesWithStatus = data.examples.map(ex => ({
        ...ex,
        status: "original" as const,
        originalMessages: JSON.parse(JSON.stringify(ex.messages)),
      }));
      setGeneratedData({ ...data, examples: examplesWithStatus });
      setIsGenerating(false);
      setSelectedExamples(new Set());
      setSelectedExampleId(null);
      toast.success(`Generated ${data.stats.total} training examples`);
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

  // Filter examples based on status and search
  const filteredExamples = generatedData?.examples.filter(ex => {
    const matchesStatus = filterStatus === "all" || ex.status === filterStatus;
    const matchesSearch = searchQuery === "" || 
      ex.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.playbook.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.messages[0].content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }) || [];

  // Start editing an example
  const startEditing = (example: GeneratedExample) => {
    setEditingExample(example);
    setEditedUserContent(example.messages[0].content);
    setEditedAssistantContent(example.messages[1].content);
    setEditedReasoningContent(example.messages[1].reasoning_content || "");
  };

  // Save edited example
  const saveEdit = () => {
    if (!editingExample || !generatedData) return;

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
        };
      }
      return ex;
    });

    setGeneratedData({ ...generatedData, examples: updatedExamples });
    setEditingExample(null);
    toast.success("Example updated successfully");
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingExample(null);
  };

  // Revert an edited example to original
  const revertExample = (exampleId: string) => {
    if (!generatedData) return;

    const updatedExamples = generatedData.examples.map(ex => {
      if (ex.id === exampleId && ex.originalMessages) {
        return {
          ...ex,
          status: "original" as const,
          messages: JSON.parse(JSON.stringify(ex.originalMessages)),
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

    const example = generatedData.examples.find(ex => ex.id === exampleId);
    const updatedExamples = generatedData.examples.map(ex => {
      if (ex.id === exampleId) {
        // Check if it was edited before deletion
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
  const statusCounts = {
    total: generatedData?.examples.length || 0,
    original: generatedData?.examples.filter(ex => ex.status === "original").length || 0,
    edited: generatedData?.examples.filter(ex => ex.status === "edited").length || 0,
    deleted: generatedData?.examples.filter(ex => ex.status === "deleted").length || 0,
  };

  // Get status badge color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "edited": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "deleted": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-green-500/20 text-green-400 border-green-500/30";
    }
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
                <div className="flex gap-2">
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
                  <ScrollArea className="h-[200px] rounded-md border p-2">
                    {playbooksLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {playbooks?.map((playbook) => {
                          const Icon = playbookIcons[playbook.id] || Layers;
                          return (
                            <div
                              key={playbook.id}
                              className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                              onClick={() => togglePlaybook(playbook.id)}
                            >
                              <Checkbox
                                checked={selectedPlaybooks.includes(playbook.id)}
                                onCheckedChange={() => togglePlaybook(playbook.id)}
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
                <div>
                  <Label>Include Negative Examples</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Queries the agent should refuse
                  </p>
                </div>
                <Switch
                  checked={includeNegatives}
                  onCheckedChange={setIncludeNegatives}
                />
              </div>
              {includeNegatives && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Negative Ratio</Label>
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
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as typeof exportFormat)}>
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

        {/* Example Browser Panel */}
        <Card className="xl:col-span-4 bg-card/50 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-primary" />
                  Example Browser
                </CardTitle>
                <CardDescription>
                  {generatedData ? `${statusCounts.total - statusCounts.deleted} exportable examples` : "Generate examples to browse"}
                </CardDescription>
              </div>
              {generatedData && selectedExamples.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete ({selectedExamples.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {generatedData && (
              <>
                {/* Status Filter Tabs */}
                <div className="flex gap-1 p-1 bg-black/20 rounded-lg">
                  {[
                    { value: "all", label: "All", count: statusCounts.total },
                    { value: "original", label: "Original", count: statusCounts.original },
                    { value: "edited", label: "Edited", count: statusCounts.edited },
                    { value: "deleted", label: "Deleted", count: statusCounts.deleted },
                  ].map(tab => (
                    <button
                      key={tab.value}
                      onClick={() => setFilterStatus(tab.value as typeof filterStatus)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                        filterStatus === tab.value
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-white/5"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* Search and Selection Controls */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Search examples..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-8 text-sm bg-black/20"
                  />
                  <Button variant="ghost" size="sm" onClick={selectAllVisible} className="h-8 px-2">
                    <CheckSquare className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 px-2">
                    <Square className="w-4 h-4" />
                  </Button>
                </div>

                {/* Example List */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 pr-2">
                    {filteredExamples.map((example) => (
                      <div
                        key={example.id}
                        className={`group p-2 rounded-lg border cursor-pointer transition-all ${
                          selectedExampleId === example.id
                            ? "bg-primary/10 border-primary/50"
                            : example.status === "deleted"
                            ? "bg-red-500/5 border-red-500/20 opacity-60"
                            : "bg-black/20 border-white/5 hover:border-white/20"
                        }`}
                        onClick={() => setSelectedExampleId(example.id)}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={selectedExamples.has(example.id)}
                            onCheckedChange={() => toggleExampleSelection(example.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground truncate">
                                {example.id}
                              </span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${getStatusColor(example.status)}`}>
                                {example.status || "original"}
                              </Badge>
                            </div>
                            <p className="text-xs text-foreground mt-1 line-clamp-2">
                              {example.messages[0].content}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {example.playbook}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {example.status !== "deleted" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(example);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
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
                                size="sm"
                                className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
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
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            {!generatedData && (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Generate examples to browse and edit</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Example Detail/Editor Panel */}
        <Card className="xl:col-span-5 bg-card/50 border-border">
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

      {/* Edit Dialog */}
      <Dialog open={!!editingExample} onOpenChange={(open) => !open && cancelEdit()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit Training Example
            </DialogTitle>
            <DialogDescription>
              {editingExample?.id} - {editingExample?.playbook}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
              </Label>
              <Textarea
                value={editedAssistantContent}
                onChange={(e) => setEditedAssistantContent(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
                placeholder="Enter assistant response (JSON or text)..."
              />
              {editedAssistantContent.startsWith("{") && (
                <div className="text-xs text-muted-foreground">
                  Detected JSON format - will be validated on save
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={saveEdit}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
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
