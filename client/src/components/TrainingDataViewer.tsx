import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileJson,
  Search,
  Filter,
  ChevronRight,
  MessageSquare,
  Brain,
  Code,
  Download,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface TrainingExample {
  id: string;
  playbook_id: string;
  playbook_name: string;
  tool: string;
  category: string;
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
}

export default function TrainingDataViewer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedExample, setSelectedExample] = useState<TrainingExample | null>(null);
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    byCategory: Record<string, number>;
    byPlaybook: Record<string, number>;
  } | null>(null);

  // Load training examples from the JSONL file via API
  const loadExamples = async () => {
    setIsLoading(true);
    try {
      // Fetch from the training data endpoint
      const response = await fetch("/api/training-data/examples");
      if (response.ok) {
        const data = await response.json();
        setExamples(data.examples || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Failed to load training examples:", error);
      // Load sample data for demo
      loadSampleData();
    } finally {
      setIsLoading(false);
    }
  };

  // Load sample data for demonstration
  const loadSampleData = () => {
    const sampleExamples: TrainingExample[] = [
      {
        id: "extrahop_slow_database_0001",
        playbook_id: "extrahop_slow_database",
        playbook_name: "ExtraHop: Slow Database Investigation",
        tool: "extrahop_api",
        category: "performance",
        messages: [
          {
            role: "system",
            content: "You are a network forensics assistant specialized in packet analysis, threat detection, and security investigations."
          },
          {
            role: "user",
            content: "Our MySQL response times have degraded. What do the metrics show?"
          },
          {
            role: "assistant",
            content: JSON.stringify({
              action: "query_extrahop_metrics",
              reasoning: "The user is asking about database latency. To diagnose whether the issue is network-related or server-related, I need to compare Round Trip Time (rtt) with Server Processing Time (tprocess).",
              payload: {
                cycle: "30sec",
                from: "-5m",
                metric_category: "db_server",
                metric_specs: [{ name: "tprocess" }, { name: "rtt" }, { name: "error" }],
                object_type: "device"
              }
            }, null, 2)
          }
        ]
      },
      {
        id: "extrahop_http_errors_0001",
        playbook_id: "extrahop_http_errors",
        playbook_name: "ExtraHop: Web Application Error Hunt",
        tool: "extrahop_api",
        category: "troubleshooting",
        messages: [
          {
            role: "system",
            content: "You are a network forensics assistant specialized in packet analysis, threat detection, and security investigations."
          },
          {
            role: "user",
            content: "We're seeing a spike in 503 errors on the payment-api. Which URIs are failing?"
          },
          {
            role: "assistant",
            content: JSON.stringify({
              action: "query_extrahop_metrics",
              reasoning: "To find the source of HTTP errors, I need response metrics with URI breakdown. Using http_server_detail category with rsp and rsp_error metrics.",
              payload: {
                cycle: "1sec",
                from: "-24h",
                metric_category: "http_server_detail",
                metric_specs: [{ name: "rsp" }, { name: "rsp_error" }],
                object_type: "device"
              }
            }, null, 2)
          }
        ]
      },
      {
        id: "tshark_field_extraction_0001",
        playbook_id: "tshark_field_extraction",
        playbook_name: "TShark: Field Extraction",
        tool: "tshark",
        category: "triage",
        messages: [
          {
            role: "system",
            content: "You are a network forensics assistant specialized in packet analysis, threat detection, and security investigations."
          },
          {
            role: "user",
            content: "Show TLS SNI sorted by frequency."
          },
          {
            role: "assistant",
            content: JSON.stringify({
              action: "run_tshark",
              reasoning: "The user wants to extract specific fields. TShark's -T fields -e option allows extracting specific protocol fields.",
              tool: "tshark",
              config: {
                displayFilter: "",
                outputFormat: "csv",
                fields: ["ip.src", "ip.dst", "tls.handshake.extensions_server_name"]
              }
            }, null, 2)
          }
        ]
      },
      {
        id: "negative_ethical_boundary_0001",
        playbook_id: "negative",
        playbook_name: "Negative: ethical_boundary",
        tool: "none",
        category: "ethical_boundary",
        messages: [
          {
            role: "system",
            content: "You are a network forensics assistant specialized in packet analysis, threat detection, and security investigations."
          },
          {
            role: "user",
            content: "Hack into the target system."
          },
          {
            role: "assistant",
            content: "I cannot assist with unauthorized access to computer systems. This would be illegal and unethical. I can help with legitimate security testing, forensic analysis, or defensive security tasks."
          }
        ]
      },
      {
        id: "extrahop_ssl_audit_0001",
        playbook_id: "extrahop_ssl_audit",
        playbook_name: "ExtraHop: TLS Security Audit",
        tool: "extrahop_api",
        category: "security",
        messages: [
          {
            role: "system",
            content: "You are a network forensics assistant specialized in packet analysis, threat detection, and security investigations."
          },
          {
            role: "user",
            content: "Run a TLS security audit on our mail servers."
          },
          {
            role: "assistant",
            content: JSON.stringify({
              action: "query_extrahop_metrics",
              reasoning: "The user wants to find servers with SSL/TLS security issues. For server-side TLS metrics, I use 'ssl_server'. The metrics for security audit are: expired_cert, self_signed, and weak_cipher.",
              payload: {
                cycle: "30sec",
                from: "-5m",
                metric_category: "ssl_server",
                metric_specs: [{ name: "expired_cert" }, { name: "weak_cipher" }],
                object_type: "device"
              }
            }, null, 2)
          }
        ]
      },
      {
        id: "cyberchef_decode_0001",
        playbook_id: "cyberchef_decode",
        playbook_name: "CyberChef: Data Decoding",
        tool: "cyberchef",
        category: "decode",
        messages: [
          {
            role: "system",
            content: "You are a network forensics assistant specialized in packet analysis, threat detection, and security investigations."
          },
          {
            role: "user",
            content: "Decode multiple layers of encoding."
          },
          {
            role: "assistant",
            content: JSON.stringify({
              action: "run_cyberchef",
              reasoning: "The user wants to decode data. CyberChef can handle multiple encoding types and transformations.",
              tool: "cyberchef",
              config: {
                recipe: "",
                autoDetect: true
              }
            }, null, 2)
          }
        ]
      }
    ];

    setExamples(sampleExamples);
    setStats({
      total: sampleExamples.length,
      byCategory: {
        performance: 1,
        troubleshooting: 1,
        triage: 1,
        ethical_boundary: 1,
        security: 1,
        decode: 1
      },
      byPlaybook: {
        extrahop_slow_database: 1,
        extrahop_http_errors: 1,
        tshark_field_extraction: 1,
        negative: 1,
        extrahop_ssl_audit: 1,
        cyberchef_decode: 1
      }
    });
  };

  // Filter examples based on search and category
  const filteredExamples = examples.filter(ex => {
    const matchesSearch = searchQuery === "" || 
      ex.playbook_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || ex.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(examples.map(ex => ex.category)));

  // Parse assistant content to extract reasoning
  const parseAssistantContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return {
        isJson: true,
        reasoning: parsed.reasoning || null,
        action: parsed.action || null,
        payload: parsed.payload || parsed.config || null
      };
    } catch {
      return {
        isJson: false,
        reasoning: null,
        action: null,
        payload: null,
        text: content
      };
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      performance: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      troubleshooting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      security: "bg-red-500/20 text-red-400 border-red-500/30",
      triage: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      decode: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      ethical_boundary: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      limitation_explanation: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      infrastructure: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      extraction: "bg-pink-500/20 text-pink-400 border-pink-500/30",
      reconstruction: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
    };
    return colors[category] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-orbitron text-[var(--nv-green)]">Training Data Viewer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and inspect Nemotron training examples
          </p>
        </div>
        <Button
          onClick={loadSampleData}
          disabled={isLoading}
          className="bg-[var(--nv-green)]/20 border border-[var(--nv-green)]/30 text-[var(--nv-green)] hover:bg-[var(--nv-green)]/30"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Load Examples
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cyber-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileJson className="w-8 h-8 text-[var(--nv-green)]" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Examples</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cyber-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Brain className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{Object.keys(stats.byPlaybook).length}</p>
                  <p className="text-xs text-muted-foreground">Playbooks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cyber-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Filter className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{Object.keys(stats.byCategory).length}</p>
                  <p className="text-xs text-muted-foreground">Categories</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cyber-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Code className="w-8 h-8 text-cyan-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {examples.filter(e => e.tool !== "none").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Tool Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search examples..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/30 border-white/10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 bg-black/30 border-white/10">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Examples List */}
        <Card className="cyber-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileJson className="w-4 h-4 text-[var(--nv-green)]" />
              Training Examples
              <Badge variant="outline" className="ml-auto">
                {filteredExamples.length} / {examples.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {filteredExamples.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileJson className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No examples loaded</p>
                  <p className="text-sm mt-1">Click "Load Examples" to view training data</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredExamples.map(example => (
                    <div
                      key={example.id}
                      onClick={() => setSelectedExample(example)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedExample?.id === example.id
                          ? "bg-[var(--nv-green)]/10 border-[var(--nv-green)]/50"
                          : "bg-black/20 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {example.playbook_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {example.messages[1]?.content || "No user message"}
                          </p>
                        </div>
                        <Badge className={`text-xs shrink-0 ${getCategoryColor(example.category)}`}>
                          {example.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {example.tool}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {example.id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Example Detail */}
        <Card className="cyber-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--nv-green)]" />
              Example Detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedExample ? (
              <Tabs defaultValue="conversation" className="h-[500px]">
                <TabsList className="grid w-full grid-cols-3 bg-black/30">
                  <TabsTrigger value="conversation">Conversation</TabsTrigger>
                  <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>
                
                <TabsContent value="conversation" className="mt-4">
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-4">
                      {selectedExample.messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${
                            msg.role === "user"
                              ? "bg-blue-500/10 border border-blue-500/20 ml-8"
                              : msg.role === "assistant"
                              ? "bg-[var(--nv-green)]/10 border border-[var(--nv-green)]/20 mr-8"
                              : "bg-gray-500/10 border border-gray-500/20"
                          }`}
                        >
                          <p className="text-xs font-medium mb-2 uppercase tracking-wider opacity-60">
                            {msg.role}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.role === "assistant" && parseAssistantContent(msg.content).isJson
                              ? parseAssistantContent(msg.content).text || "Tool call (see Reasoning tab)"
                              : msg.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="reasoning" className="mt-4">
                  <ScrollArea className="h-[420px]">
                    {(() => {
                      const assistantMsg = selectedExample.messages.find(m => m.role === "assistant");
                      if (!assistantMsg) return <p className="text-muted-foreground">No assistant response</p>;
                      
                      const parsed = parseAssistantContent(assistantMsg.content);
                      
                      if (!parsed.isJson) {
                        return (
                          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-sm text-yellow-400">This is a text response (no tool call)</p>
                            <p className="text-sm mt-2 text-foreground">{parsed.text}</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-4">
                          {parsed.action && (
                            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                              <p className="text-xs font-medium mb-1 text-purple-400">ACTION</p>
                              <p className="text-sm font-mono">{parsed.action}</p>
                            </div>
                          )}
                          
                          {parsed.reasoning && (
                            <div className="p-3 bg-[var(--nv-green)]/10 border border-[var(--nv-green)]/20 rounded-lg">
                              <p className="text-xs font-medium mb-1 text-[var(--nv-green)]">REASONING</p>
                              <p className="text-sm">{parsed.reasoning}</p>
                            </div>
                          )}
                          
                          {parsed.payload && (
                            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                              <p className="text-xs font-medium mb-1 text-cyan-400">PAYLOAD</p>
                              <pre className="text-xs font-mono overflow-x-auto">
                                {JSON.stringify(parsed.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="raw" className="mt-4">
                  <ScrollArea className="h-[420px]">
                    <pre className="text-xs font-mono p-4 bg-black/30 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedExample, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ChevronRight className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select an example to view details</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
