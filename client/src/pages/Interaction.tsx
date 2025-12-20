/*
 * Interaction - Reasoning Interface
 * 
 * Design: Glass Box reasoning UI with collapsible thinking blocks,
 * system prompt library, inference configuration, and chat interface.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

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
    id: "creative", 
    name: "Creative Writer", 
    icon: Lightbulb,
    prompt: "You are a creative writing assistant. Generate imaginative, engaging, and original content while maintaining coherence and quality."
  },
];

// Inference Configuration
const DEFAULT_CONFIG = {
  temperature: 0.7,
  topP: 0.9,
  topK: 50,
  maxTokens: 2048,
  thinkingBudget: 1024,
  repetitionPenalty: 1.1,
};

// Sample Conversation with Reasoning
const SAMPLE_MESSAGES: Message[] = [
  {
    role: "user" as const,
    content: "What is the sum of all prime numbers less than 20?"
  },
  {
    role: "assistant" as const,
    content: "The sum of all prime numbers less than 20 is **77**.",
    thinking: `Let me identify all prime numbers less than 20:

1. 2 - prime (only even prime)
2. 3 - prime
3. 5 - prime
4. 7 - prime
5. 11 - prime
6. 13 - prime
7. 17 - prime
8. 19 - prime

Numbers I'm excluding:
- 1 is not prime (by definition)
- 4, 6, 8, 9, 10, 12, 14, 15, 16, 18 are composite

Now calculating the sum:
2 + 3 = 5
5 + 5 = 10
10 + 7 = 17
17 + 11 = 28
28 + 13 = 41
41 + 17 = 58
58 + 19 = 77

The sum is 77.`,
    metrics: {
      thinkingTokens: 156,
      responseTokens: 12,
      latency: 842,
    }
  }
];

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  metrics?: {
    thinkingTokens: number;
    responseTokens: number;
    latency: number;
  };
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
    <div className="mt-2 rounded-lg border border-nvidia-teal/30 bg-nvidia-teal/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-nvidia-teal hover:bg-nvidia-teal/10 transition-colors"
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
            <div className="px-3 pb-3 border-t border-nvidia-teal/20">
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
        <div className="w-8 h-8 rounded-lg bg-nvidia-green/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-nvidia-green" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[80%] rounded-lg p-3",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted/50 border border-border/50"
      )}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        
        {message.thinking && (
          <ThinkingBlock content={message.thinking} metrics={message.metrics} />
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

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(SAMPLE_MESSAGES);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);
    
    // Simulate response
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "This is a simulated response. In production, this would connect to the vLLM inference server running on your DGX Spark hosts.",
        thinking: "Processing the user's query...\nAnalyzing context and intent...\nFormulating response based on available knowledge...",
        metrics: {
          thinkingTokens: 45,
          responseTokens: 28,
          latency: 234,
        }
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsGenerating(false);
    }, 1500);
  };
  
  return (
    <Card className="cyber-panel h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-sm font-display tracking-wide">Chat Interface</CardTitle>
              <p className="text-[10px] text-muted-foreground">Glass Box Reasoning UI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Feature coming soon")}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMessages([])}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          
          {isGenerating && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-nvidia-green animate-pulse" />
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-nvidia-green animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-nvidia-green animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 rounded-full bg-nvidia-green animate-bounce" style={{ animationDelay: "0.2s" }} />
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
            disabled={!input.trim() || isGenerating}
            className="bg-nvidia-green hover:bg-nvidia-green/90 h-auto"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SystemPromptCard() {
  const [selected, setSelected] = useState("default");
  const [customPrompt, setCustomPrompt] = useState(SYSTEM_PROMPTS[0].prompt);
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-nvidia-teal" />
          </div>
          <div>
            <CardTitle className="text-sm font-display tracking-wide">System Prompt</CardTitle>
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
                  setSelected(preset.id);
                  setCustomPrompt(preset.prompt);
                }}
                className={cn(
                  "p-2 rounded-lg border text-left transition-all",
                  isSelected 
                    ? "bg-nvidia-teal/10 border-nvidia-teal/50" 
                    : "bg-muted/30 border-border/50 hover:border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", isSelected ? "text-nvidia-teal" : "text-muted-foreground")} />
                  <span className="text-xs font-medium">{preset.name}</span>
                </div>
              </button>
            );
          })}
        </div>
        
        <Textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          className="min-h-[100px] text-xs bg-muted/30 resize-none"
        />
      </CardContent>
    </Card>
  );
}

function InferenceConfigCard() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  
  return (
    <Card className="cyber-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Settings className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-display tracking-wide">Inference Config</CardTitle>
            <p className="text-[10px] text-muted-foreground">Generation Parameters</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Thermometer className="w-3 h-3" />
                Temperature
              </Label>
              <span className="text-xs font-mono text-nvidia-green">{config.temperature}</span>
            </div>
            <Slider 
              value={[config.temperature * 100]}
              onValueChange={([v]) => setConfig(prev => ({ ...prev, temperature: v / 100 }))}
              max={200}
              step={1}
              className="[&_[role=slider]]:bg-nvidia-green"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                Top-P
              </Label>
              <span className="text-xs font-mono text-nvidia-teal">{config.topP}</span>
            </div>
            <Slider 
              value={[config.topP * 100]}
              onValueChange={([v]) => setConfig(prev => ({ ...prev, topP: v / 100 }))}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-nvidia-teal"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Brain className="w-3 h-3" />
                Thinking Budget
              </Label>
              <span className="text-xs font-mono">{config.thinkingBudget}</span>
            </div>
            <Slider 
              value={[config.thinkingBudget]}
              onValueChange={([v]) => setConfig(prev => ({ ...prev, thinkingBudget: v }))}
              max={4096}
              step={64}
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Max Tokens
              </Label>
              <span className="text-xs font-mono">{config.maxTokens}</span>
            </div>
            <Slider 
              value={[config.maxTokens]}
              onValueChange={([v]) => setConfig(prev => ({ ...prev, maxTokens: v }))}
              max={8192}
              step={128}
            />
          </div>
        </div>
        
        <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Top-K</span>
            <span className="font-mono">{config.topK}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Rep. Penalty</span>
            <span className="font-mono">{config.repetitionPenalty}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Interaction() {
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
          Glass Box reasoning UI with configurable inference parameters
        </p>
      </motion.div>
      
      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <ChatInterface />
        </motion.div>
        
        <motion.div variants={itemVariants} className="space-y-6">
          <SystemPromptCard />
          <InferenceConfigCard />
        </motion.div>
      </div>
    </motion.div>
  );
}
