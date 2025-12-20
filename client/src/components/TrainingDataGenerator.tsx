import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [previewExample, setPreviewExample] = useState<GeneratedExample | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedPlaybooks, setExpandedPlaybooks] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Fetch playbooks
  const { data: playbooks, isLoading: playbooksLoading } = trpc.trainingData.getPlaybooks.useQuery();
  
  // Fetch stats
  const { data: stats } = trpc.trainingData.getStats.useQuery();
  
  // Generate mutation
  const generateMutation = trpc.trainingData.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedData(data);
      setIsGenerating(false);
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
    exportMutation.mutate({
      examples: generatedData.examples,
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1 bg-card/50 border-border">
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
                        : `${selectedPlaybooks.length} Selected`}
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
                        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {playbooks?.map((playbook) => {
                          const Icon = playbookIcons[playbook.id] || Layers;
                          const colorClass = categoryColors[playbook.category] || "text-gray-400 bg-gray-500/10";
                          return (
                            <div
                              key={playbook.id}
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                              onClick={() => togglePlaybook(playbook.id)}
                            >
                              <Checkbox
                                checked={selectedPlaybooks.includes(playbook.id)}
                                onCheckedChange={() => togglePlaybook(playbook.id)}
                              />
                              <div className={`w-6 h-6 rounded flex items-center justify-center ${colorClass.split(" ")[1]}`}>
                                <Icon className={`w-3.5 h-3.5 ${colorClass.split(" ")[0]}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{playbook.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {playbook.templatesCount} templates · {playbook.metricsCount} metrics
                                </p>
                              </div>
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
                  <p className="text-xs text-muted-foreground">
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
                    <span className="text-sm font-mono text-muted-foreground">
                      {(negativeRatio * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[negativeRatio * 100]}
                    onValueChange={([v]) => setNegativeRatio(v / 100)}
                    min={5}
                    max={30}
                    step={5}
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

        {/* Results Panel */}
        <Card className="lg:col-span-2 bg-card/50 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-primary" />
                  Generated Data
                </CardTitle>
                <CardDescription>
                  {generatedData
                    ? `${generatedData.stats.total} examples generated`
                    : "Configure and generate training examples"}
                </CardDescription>
              </div>
              {generatedData && (
                <div className="flex gap-2">
                  <Button
                    variant={showValidation ? "default" : "outline"}
                    onClick={() => setShowValidation(!showValidation)}
                    className="gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    {showValidation ? "Hide" : "Validate"}
                  </Button>
                  <Button onClick={handleExport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!generatedData ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No data generated yet</p>
                <p className="text-sm">Configure parameters and click Generate</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">Positive</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{generatedData.stats.positive}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-400">Negative</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{generatedData.stats.negative}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-blue-400">Playbooks</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {Object.keys(generatedData.stats.byPlaybook).length}
                    </p>
                  </div>
                </div>

                {/* Distribution by Playbook */}
                <div className="space-y-2">
                  <Label className="text-sm">Distribution by Playbook</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(generatedData.stats.byPlaybook).map(([playbook, count]) => (
                      <Badge key={playbook} variant="outline" className="gap-1">
                        {playbook}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Example Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Example Preview</Label>
                    <Select
                      value={previewExample?.id || ""}
                      onValueChange={(id) => {
                        const example = generatedData.examples.find(e => e.id === id);
                        setPreviewExample(example || null);
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select example" />
                      </SelectTrigger>
                      <SelectContent>
                        {generatedData.examples.slice(0, 20).map((example) => (
                          <SelectItem key={example.id} value={example.id}>
                            {example.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <AnimatePresence mode="wait">
                    {previewExample && (
                      <motion.div
                        key={previewExample.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                      >
                        {/* User Message */}
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-blue-400">User</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(previewExample.messages[0].content)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-sm">{previewExample.messages[0].content}</p>
                        </div>

                        {/* Assistant Reasoning */}
                        {previewExample.messages[1].reasoning_content && (
                          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="text-purple-400">Reasoning</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(previewExample.messages[1].reasoning_content || "")}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {previewExample.messages[1].reasoning_content}
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
                              onClick={() => copyToClipboard(previewExample.messages[1].content)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                            {previewExample.messages[1].content.startsWith("{")
                              ? JSON.stringify(JSON.parse(previewExample.messages[1].content), null, 2)
                              : previewExample.messages[1].content}
                          </pre>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="gap-1">
                            <Database className="w-3 h-3" />
                            {previewExample.category}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            Time: {previewExample.metadata.timeRange}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            {previewExample.metadata.objectType}
                          </Badge>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!previewExample && generatedData.examples.length > 0 && (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground border border-dashed border-border rounded-lg">
                      <div className="text-center">
                        <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Select an example to preview</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation Panel */}
      {showValidation && generatedData && (
        <ValidationPanel
          examples={generatedData.examples}
          onValidationComplete={(result) => {
            console.log("Validation complete:", result);
          }}
        />
      )}
    </div>
  );
}
