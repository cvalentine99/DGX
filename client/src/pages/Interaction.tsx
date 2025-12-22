/*
 * Interaction - Reasoning Interface with RAG & vLLM Integration
 * 
 * Design: Glass Box reasoning UI with collapsible thinking blocks,
 * system prompt library, inference configuration, RAG context, and chat interface.
 * Connected to vLLM backend for live inference.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import {
  MessageSquare,
  Brain,
  Send,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Thermometer,
  Gauge,
  Clock,
  Copy,
  RefreshCw,
  BookOpen,
  Code,
  Lightbulb,
  Database,
  Server,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Power,
  Download,
  AlertTriangle,
  FileJson,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InferenceTestPanel } from "@/components/InferenceTestPanel";

// Note: SYSTEM_PROMPTS and DEFAULT_CONFIG are configuration presets, not demo data
// They are always available regardless of DEMO_MODE

// System Prompt Presets
const SYSTEM_PROMPTS = [
  { 
    id: "default", 
    name: "Default Assistant", 
    icon: MessageSquare,
    prompt: "You are a helpful AI assistant powered by Nemotron-3-Nano-30B. Provide accurate, helpful, and safe responses."
  },
  { 
    id: "coder", 
    name: "Code Expert", 
    icon: Code,
    prompt: "You are an expert programmer. Provide clean, efficient, and well-documented code solutions. Explain your reasoning step by step."
  },
  { 
    id: "reasoning", 
    name: "Deep Reasoning", 
    icon: Brain,
    prompt: "You are a reasoning expert. Think through problems step by step, showing your work in <think> tags before providing your final answer."
  },
  { 
    id: "extrahop", 
    name: "ExtraHop Expert", 
    icon: Database,
    prompt: "You are an expert in ExtraHop network analytics and the Metrics API. Help users construct API queries, analyze network data, and troubleshoot issues. Always provide the exact JSON structure for API calls."
  },
];

// Inference Configuration
const DEFAULT_CONFIG = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  enableThinking: true,
  reasoningBudget: 512,
  useRag: true,
};

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  metrics?: {
    thinkingTokens: number;
    responseTokens: number;
    latency: number;
  };
  ragContext?: string;
  simulated?: boolean;
}

// Export chat history function
function exportChatHistory(messages: Message[], systemPrompt: string, format: "json" | "markdown") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `chat-export-${timestamp}.${format === "json" ? "json" : "md"}`;
  
  let content: string;
  let mimeType: string;
  
  if (format === "json") {
    const exportData = {
      exportedAt: new Date().toISOString(),
      model: "Nemotron-3-Nano-30B",
      systemPrompt,
      totalMessages: messages.length,
      messages: messages.map((m, idx) => ({
        index: idx + 1,
        role: m.role,
        content: m.content,
        thinking: m.thinking || null,
        ragContext: m.ragContext || null,
        metrics: m.metrics || null,
        simulated: m.simulated || false,
      })),
      summary: {
        userMessages: messages.filter(m => m.role === "user").length,
        assistantMessages: messages.filter(m => m.role === "assistant").length,
        totalThinkingTokens: messages.reduce((sum, m) => sum + (m.metrics?.thinkingTokens || 0), 0),
        totalResponseTokens: messages.reduce((sum, m) => sum + (m.metrics?.responseTokens || 0), 0),
        avgLatency: Math.round(
          messages.filter(m => m.metrics?.latency).reduce((sum, m) => sum + (m.metrics?.latency || 0), 0) /
          Math.max(1, messages.filter(m => m.metrics?.latency).length)
        ),
      },
    };
    content = JSON.stringify(exportData, null, 2);
    mimeType = "application/json";
  } else {
    // Markdown format
    const lines: string[] = [];
    lines.push("# Chat Export");
    lines.push("");
    lines.push(`**Exported:** ${new Date().toLocaleString()}`);
    lines.push(`**Model:** Nemotron-3-Nano-30B`);
    lines.push(`**Messages:** ${messages.length}`);
    lines.push("");
    lines.push("## System Prompt");
    lines.push("");
    lines.push("> " + systemPrompt.split("\n").join("\n> "));
    lines.push("");
    lines.push("## Conversation");
    lines.push("");
    
    messages.forEach((m, idx) => {
      const role = m.role === "user" ? "👤 User" : "🤖 Assistant";
      lines.push(`### ${role}`);
      lines.push("");
      lines.push(m.content);
      
      if (m.thinking) {
        lines.push("");
        lines.push("<details>");
        lines.push("<summary>🧠 Reasoning Process</summary>");
        lines.push("");
        lines.push("```");
        lines.push(m.thinking);
        lines.push("```");
        lines.push("");
        lines.push("</details>");
      }
      
      if (m.metrics) {
        lines.push("");
        lines.push(`*Tokens: ${m.metrics.thinkingTokens} thinking + ${m.metrics.responseTokens} response | Latency: ${m.metrics.latency}ms*`);
      }
      
      lines.push("");
      lines.push("---");
      lines.push("");
    });
    
    // Summary
    const totalThinking = messages.reduce((sum, m) => sum + (m.metrics?.thinkingTokens || 0), 0);
    const totalResponse = messages.reduce((sum, m) => sum + (m.metrics?.responseTokens || 0), 0);
    lines.push("## Summary");
    lines.push("");
    lines.push(`- **User Messages:** ${messages.filter(m => m.role === "user").length}`);
    lines.push(`- **Assistant Messages:** ${messages.filter(m => m.role === "assistant").length}`);
    lines.push(`- **Total Thinking Tokens:** ${totalThinking}`);
    lines.push(`- **Total Response Tokens:** ${totalResponse}`);
    
    content = lines.join("\n");
    mimeType = "text/markdown";
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast.success(`Chat exported as ${format.toUpperCase()}`, { description: filename });
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function ThinkingBlock({ content, metrics }: { content: string; metrics?: Message["metrics"] }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="mt-2 rounded-lg border border-[#00b4d8]/30 bg-[#00b4d8]/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#00b4d8] hover:bg-[#00b4d8]/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3 h-3" />
          <span className="font-medium">Reasoning Process</span>
          {metrics && (
            <span className="text-muted-foreground">
              ({metrics.thinkingTokens} tokens, {metrics.latency}ms)
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 border-t border-[#00b4d8]/20">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono mt-2 leading-relaxed">
                {content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-[#3b82f6]" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[80%] rounded-lg p-3",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted/50 border border-border/50"
      )}>
        {message.simulated && (
          <Badge variant="outline" className="mb-2 text-[10px] text-orange-400 border-orange-400/30">
            Simulated Response
          </Badge>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        
        {message.thinking && (
          <ThinkingBlock content={message.thinking} metrics={message.metrics} />
        )}
        
        {message.ragContext && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <div className="flex items-center gap-1 text-[10px] text-[#3b82f6]">
              <Database className="w-3 h-3" />
              <span>RAG Context Used</span>
            </div>
          </div>
        )}
        
        {!isUser && message.metrics && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
            <span>{message.metrics.responseTokens} tokens</span>
            <span>{message.metrics.latency}ms</span>
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-primary" />
        </div>
      )}
    </div>
  );
}

function ChatInterface({ 
  config, 
  systemPrompt 
}: { 
  config: typeof DEFAULT_CONFIG;
  systemPrompt: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // vLLM health check
  const { data: vllmHealth } = trpc.vllm.healthCheck.useQuery(undefined, {
    refetchInterval: 30000,
  });
  
  // RAG context query
  const ragContextQuery = trpc.rag.getContext.useQuery(
    { query: input, maxTokens: 2000 },
    { enabled: config.useRag && input.length > 10 }
  );
  
  // Chat completion mutation
  const chatMutation = trpc.vllm.ragChatCompletion.useMutation({
    onSuccess: (data) => {
      const choice = data.choices?.[0];
      const assistantMessage: Message = {
        role: "assistant",
        content: choice?.message?.content || "No response",
        thinking: choice?.message?.reasoning_content,
        metrics: {
          thinkingTokens: data.usage?.reasoning_tokens || 0,
          responseTokens: data.usage?.completion_tokens || 0,
          latency: Date.now() - ((chatMutation.variables as { startTime?: number })?.startTime ?? Date.now()),
        },
        ragContext: data.ragEnabled ? "Used" : undefined,
        simulated: data.simulated,
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      toast.error(`Inference failed: ${error.message}`);
    },
  });
  
  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    
    // Get RAG context if enabled
    let ragContext: string | undefined;
    if (config.useRag) {
      try {
        const contextResult = await ragContextQuery.refetch();
        ragContext = contextResult.data?.context;
      } catch {
        // Continue without RAG context
      }
    }
    
    // Build messages for API
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: currentInput },
    ];
    
    // Call vLLM
    chatMutation.mutate({
      messages: apiMessages,
      ragContext,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      enableThinking: config.enableThinking,
      startTime: Date.now(),
    } as Parameters<typeof chatMutation.mutate>[0] & { startTime: number });
  };
  
  const isConnected = vllmHealth?.status === "connected";
  
  return (
    <Card className="bg-card border-border h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div>
              <CardTitle className="text-sm font-display tracking-wide text-foreground">Chat Interface</CardTitle>
              <p className="text-[10px] text-muted-foreground">Glass Box Reasoning UI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-[10px]",
              isConnected ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"
            )}>
              {isConnected ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  <span>vLLM Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3" />
                  <span>Simulated Mode</span>
                </>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              navigator.clipboard.writeText(messages.map(m => `${m.role}: ${m.content}`).join("\n\n"));
              toast.success("Conversation copied");
            }}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => exportChatHistory(messages, systemPrompt, "json")}
              disabled={messages.length === 0}
              title="Export as JSON"
            >
              <FileJson className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => exportChatHistory(messages, systemPrompt, "markdown")}
              disabled={messages.length === 0}
              title="Export as Markdown"
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMessages([])}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Start a conversation with Nemotron-3-Nano</p>
              <p className="text-xs mt-1">
                {isConnected 
                  ? "Connected to vLLM server" 
                  : "Running in simulated mode - configure VLLM_API_URL to connect"}
              </p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          
          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#3b82f6] animate-pulse" />
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#3b82f6]" />
                  <span className="text-xs text-muted-foreground">
                    {config.enableThinking ? "Thinking..." : "Generating..."}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[60px] max-h-[120px] bg-muted/30 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 h-auto"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {config.useRag && input.length > 10 && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-[#3b82f6]">
            <Database className="w-3 h-3" />
            <span>RAG context will be included</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function SystemPromptCard({ 
  selected, 
  onSelect, 
  customPrompt, 
  onCustomPromptChange 
}: {
  selected: string;
  onSelect: (id: string) => void;
  customPrompt: string;
  onCustomPromptChange: (prompt: string) => void;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00b4d8]/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#00b4d8]" />
          </div>
          <div>
            <CardTitle className="text-sm font-display tracking-wide text-foreground">System Prompt</CardTitle>
            <p className="text-[10px] text-muted-foreground">Preset Modes</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {SYSTEM_PROMPTS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selected === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  onSelect(preset.id);
                  onCustomPromptChange(preset.prompt);
                }}
                className={cn(
                  "p-2 rounded-lg border text-left transition-all",
                  isSelected 
                    ? "bg-[#00b4d8]/10 border-[#00b4d8]/50" 
                    : "bg-muted/30 border-border/50 hover:border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", isSelected ? "text-[#00b4d8]" : "text-muted-foreground")} />
                  <span className="text-xs font-medium text-foreground">{preset.name}</span>
                </div>
              </button>
            );
          })}
        </div>
        
        <Textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          className="min-h-[100px] text-xs bg-muted/30 resize-none"
        />
      </CardContent>
    </Card>
  );
}

// Model Loading Controls Component
function ModelLoadingControls({ 
  selectedModel, 
  models 
}: { 
  selectedModel: string; 
  models: Array<{ id: string; name?: string; status?: string }>;
}) {
  const utils = trpc.useUtils();
  const [showUnloadConfirm, setShowUnloadConfirm] = useState(false);
  
  // Load model mutation
  const loadModelMutation = trpc.vllm.loadModel.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Model loaded successfully");
        utils.vllm.listModels.invalidate();
      } else {
        toast.error(data.error || "Failed to load model");
      }
    },
    onError: (error) => {
      toast.error(`Failed to load model: ${error.message}`);
    },
  });

  // Unload model mutation
  const unloadModelMutation = trpc.vllm.unloadModel.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Model unloaded successfully");
        utils.vllm.listModels.invalidate();
      } else {
        toast.error(data.error || "Failed to unload model");
      }
    },
    onError: (error) => {
      toast.error(`Failed to unload model: ${error.message}`);
    },
  });

  const currentModel = models.find(m => m.id === selectedModel);
  const isLoaded = currentModel?.status === "loaded";
  const isLoading = loadModelMutation.isPending || unloadModelMutation.isPending;

  const handleLoadModel = () => {
    loadModelMutation.mutate({ modelId: selectedModel });
  };

  const handleUnloadModel = () => {
    setShowUnloadConfirm(true);
  };

  const confirmUnload = () => {
    unloadModelMutation.mutate({ modelId: selectedModel });
    setShowUnloadConfirm(false);
  };

  if (!selectedModel || models.length === 0) return null;

  return (
    <>
    <div className="flex items-center gap-2 pt-2">
      {isLoaded ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleUnloadModel}
          disabled={isLoading}
          className="flex-1 h-7 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
        >
          {unloadModelMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Power className="h-3 w-3 mr-1" />
          )}
          Unload Model
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadModel}
          disabled={isLoading}
          className="flex-1 h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
        >
          {loadModelMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Download className="h-3 w-3 mr-1" />
          )}
          Load Model
        </Button>
      )}
    </div>

      {/* Unload Confirmation Dialog */}
      <AlertDialog open={showUnloadConfirm} onOpenChange={setShowUnloadConfirm}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Unload Model?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to unload <span className="font-semibold text-foreground">{currentModel?.name || selectedModel}</span>?
              <br /><br />
              This will disconnect the model from the vLLM server. Any active inference requests will be interrupted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnload}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {unloadModelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Power className="h-4 w-4 mr-2" />
              )}
              Unload Model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InferenceConfig({
  config,
  onConfigChange,
  selectedModel,
  onModelChange,
}: {
  config: typeof DEFAULT_CONFIG;
  onConfigChange: (config: typeof DEFAULT_CONFIG) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  // vLLM health check and models
  const { data: vllmHealth } = trpc.vllm.healthCheck.useQuery();
  const { data: modelsData } = trpc.vllm.listModels.useQuery();
  const { data: ragStats } = trpc.rag.getStats.useQuery();
  
  const availableModels = modelsData?.models || [];
  
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Settings className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-display tracking-wide text-foreground">Inference Config</CardTitle>
            <p className="text-[10px] text-muted-foreground">Generation Parameters</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-foreground">vLLM Server</span>
            </div>
            {vllmHealth?.status === "connected" ? (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Connected</Badge>
            ) : (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Simulated</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-foreground">RAG Documents</span>
            </div>
            <span className="text-xs font-mono text-[#3b82f6]">{ragStats?.totalDocuments || 0}</span>
          </div>
        </div>
        
        {/* Model Selector with Status */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1 text-foreground">
            <Brain className="w-3 h-3" />
            Model
          </Label>
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full bg-black/50 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
          >
            {availableModels.length > 0 ? (
              availableModels.map((model: { id: string; status?: string; size?: string; contextLength?: number }) => (
                <option key={model.id} value={model.id}>
                  {model.id.split('/').pop()} {model.status === "loaded" ? "✓" : ""} {model.size ? `(${model.size})` : ""}
                </option>
              ))
            ) : (
              <>
                <option value="nemotron-3-nano-30b">Nemotron-3-Nano-30B (30B)</option>
                <option value="llama-3.1-8b">Llama 3.1 8B (8B)</option>
                <option value="mistral-7b">Mistral 7B (7B)</option>
              </>
            )}
          </select>
          {/* Model Info Panel */}
          {availableModels.length > 0 && (() => {
            const currentModel = availableModels.find((m: { id: string }) => m.id === selectedModel) as { id: string; status?: string; size?: string; contextLength?: number; type?: string; description?: string } | undefined;
            if (!currentModel) return null;
            return (
              <div className="p-2 rounded-lg bg-muted/20 border border-border/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Status</span>
                  {currentModel.status === "loaded" ? (
                    <Badge className="h-4 text-[9px] bg-green-500/20 text-green-400 border-green-500/30">Loaded</Badge>
                  ) : (
                    <Badge className="h-4 text-[9px] bg-gray-500/20 text-gray-400 border-gray-500/30">Available</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Size</span>
                  <span className="text-[10px] font-mono text-foreground">{currentModel.size || "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Context</span>
                  <span className="text-[10px] font-mono text-foreground">{currentModel.contextLength?.toLocaleString() || "--"} tokens</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Type</span>
                  <span className="text-[10px] font-mono text-foreground">{currentModel.type || "--"}</span>
                </div>
              </div>
            );
          })()}
          {modelsData?.connected && availableModels.length > 0 && (
            <p className="text-[10px] text-green-400">
              {availableModels.filter((m: { status?: string }) => m.status === "loaded").length} loaded, {availableModels.length} total
            </p>
          )}
          {/* Model Loading Controls */}
          <ModelLoadingControls 
            selectedModel={selectedModel} 
            models={availableModels} 
          />
        </div>
        
        {/* RAG Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-xs text-foreground">Use RAG Context</span>
          </div>
          <Switch
            checked={config.useRag}
            onCheckedChange={(checked) => onConfigChange({ ...config, useRag: checked })}
          />
        </div>
        
        {/* Thinking Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#00b4d8]" />
            <span className="text-xs text-foreground">Enable Reasoning</span>
          </div>
          <Switch
            checked={config.enableThinking}
            onCheckedChange={(checked) => onConfigChange({ ...config, enableThinking: checked })}
          />
        </div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1 text-foreground">
                <Thermometer className="w-3 h-3" />
                Temperature
              </Label>
              <span className="text-xs font-mono text-[#3b82f6]">{config.temperature}</span>
            </div>
            <Slider 
              value={[config.temperature * 100]}
              onValueChange={([v]) => onConfigChange({ ...config, temperature: v / 100 })}
              max={200}
              step={1}
              className="[&_[role=slider]]:bg-[#3b82f6]"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1 text-foreground">
                <Gauge className="w-3 h-3" />
                Top-P
              </Label>
              <span className="text-xs font-mono text-[#00b4d8]">{config.topP}</span>
            </div>
            <Slider 
              value={[config.topP * 100]}
              onValueChange={([v]) => onConfigChange({ ...config, topP: v / 100 })}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-[#00b4d8]"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1 text-foreground">
                <Clock className="w-3 h-3" />
                Max Tokens
              </Label>
              <span className="text-xs font-mono">{config.maxTokens}</span>
            </div>
            <Slider 
              value={[config.maxTokens]}
              onValueChange={([v]) => onConfigChange({ ...config, maxTokens: v })}
              max={8192}
              step={128}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Interaction() {
  const [selectedPrompt, setSelectedPrompt] = useState("default");
  const [customPrompt, setCustomPrompt] = useState(SYSTEM_PROMPTS[0].prompt);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [selectedModel, setSelectedModel] = useState("nemotron-3-nano-30b");
  
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
          INTERACTION INTERFACE
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Glass Box reasoning UI with RAG-augmented inference
        </p>
      </motion.div>
      
      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <ChatInterface config={config} systemPrompt={customPrompt} />
        </motion.div>
        
        <motion.div variants={itemVariants} className="space-y-6">
          <SystemPromptCard 
            selected={selectedPrompt}
            onSelect={setSelectedPrompt}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
          />
          <InferenceConfig 
            config={config} 
            onConfigChange={setConfig}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
          <InferenceTestPanel />
        </motion.div>
      </div>
    </motion.div>
  );
}
