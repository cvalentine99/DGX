/**
 * InferenceTestPanel - Live Inference Testing Component
 * 
 * Provides standardized test prompts, latency metrics, throughput statistics,
 * and batch testing capability for vLLM inference validation.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import {
  Play,
  Square,
  RotateCcw,
  Zap,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  BarChart3,
  Timer,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// Test prompt categories
const TEST_PROMPTS = [
  {
    id: "simple",
    name: "Simple Math",
    prompt: "What is 2 + 2? Reply with just the number.",
    expectedTokens: 5,
    category: "basic",
  },
  {
    id: "reasoning",
    name: "Reasoning Task",
    prompt: "If a train travels at 60 mph for 2.5 hours, how far does it travel? Show your work.",
    expectedTokens: 100,
    category: "reasoning",
  },
  {
    id: "code",
    name: "Code Generation",
    prompt: "Write a Python function to calculate the factorial of a number recursively.",
    expectedTokens: 150,
    category: "code",
  },
  {
    id: "long",
    name: "Long Response",
    prompt: "Explain the key differences between supervised and unsupervised machine learning, with examples of each.",
    expectedTokens: 300,
    category: "knowledge",
  },
  {
    id: "json",
    name: "JSON Output",
    prompt: "Generate a JSON object representing a person with name, age, and email fields. Use realistic sample data.",
    expectedTokens: 80,
    category: "structured",
  },
  {
    id: "extrahop",
    name: "ExtraHop API",
    prompt: "Write an ExtraHop Metrics API query to get HTTP response times for the last hour, grouped by server.",
    expectedTokens: 200,
    category: "domain",
  },
];

interface TestResult {
  id: string;
  promptId: string;
  promptName: string;
  success: boolean;
  latencyMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  response?: string;
  error?: string;
  timestamp: Date;
}

interface TestStats {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  avgLatency: number;
  avgTokensPerSecond: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

function calculateStats(results: TestResult[]): TestStats {
  const successful = results.filter(r => r.success);
  const latencies = successful.map(r => r.latencyMs).sort((a, b) => a - b);
  
  const getPercentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)];
  };

  return {
    totalTests: results.length,
    successfulTests: successful.length,
    failedTests: results.length - successful.length,
    avgLatency: successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length 
      : 0,
    avgTokensPerSecond: successful.length > 0
      ? successful.reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.length
      : 0,
    minLatency: latencies.length > 0 ? latencies[0] : 0,
    maxLatency: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
    p50Latency: getPercentile(latencies, 50),
    p95Latency: getPercentile(latencies, 95),
    p99Latency: getPercentile(latencies, 99),
  };
}

export function InferenceTestPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(
    new Set(TEST_PROMPTS.map(p => p.id))
  );
  const [batchSize, setBatchSize] = useState(1);

  const chatMutation = trpc.vllm.chatCompletion.useMutation();
  const healthQuery = trpc.vllm.healthCheck.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const runSingleTest = useCallback(async (prompt: typeof TEST_PROMPTS[0]): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const response = await chatMutation.mutateAsync({
        messages: [{ role: "user", content: prompt.prompt }],
        temperature: 0.1,
        maxTokens: 512,
        enableThinking: false,
      });

      const latencyMs = Date.now() - startTime;
      const tokensGenerated = response.usage?.completion_tokens || 0;
      const tokensPerSecond = tokensGenerated / (latencyMs / 1000);

      return {
        id: `${prompt.id}-${Date.now()}`,
        promptId: prompt.id,
        promptName: prompt.name,
        success: true,
        latencyMs,
        tokensGenerated,
        tokensPerSecond,
        response: response.choices[0]?.message?.content || "",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        id: `${prompt.id}-${Date.now()}`,
        promptId: prompt.id,
        promptName: prompt.name,
        success: false,
        latencyMs: Date.now() - startTime,
        tokensGenerated: 0,
        tokensPerSecond: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }, [chatMutation]);

  const runTests = useCallback(async () => {
    setIsRunning(true);
    const newResults: TestResult[] = [];
    
    const promptsToRun = TEST_PROMPTS.filter(p => selectedPrompts.has(p.id));
    
    for (let batch = 0; batch < batchSize; batch++) {
      for (const prompt of promptsToRun) {
        if (!isRunning) break;
        
        setCurrentTest(prompt.id);
        const result = await runSingleTest(prompt);
        newResults.push(result);
        setResults(prev => [...prev, result]);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setCurrentTest(null);
    setIsRunning(false);
    
    const stats = calculateStats(newResults);
    if (stats.successfulTests > 0) {
      toast.success(`Tests completed: ${stats.successfulTests}/${stats.totalTests} passed`, {
        description: `Avg latency: ${stats.avgLatency.toFixed(0)}ms, Avg throughput: ${stats.avgTokensPerSecond.toFixed(1)} tok/s`
      });
    } else {
      toast.error("All tests failed", {
        description: "Check vLLM connection status"
      });
    }
  }, [selectedPrompts, batchSize, runSingleTest, isRunning]);

  const stopTests = useCallback(() => {
    setIsRunning(false);
    setCurrentTest(null);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setExpandedResult(null);
  }, []);

  const togglePrompt = (id: string) => {
    setSelectedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const stats = calculateStats(results);
  const isConnected = healthQuery.data?.status === "connected";

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="w-4 h-4 text-[#3b82f6]" />
            Live Inference Testing
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              isConnected ? "text-[#3b82f6] border-[#3b82f6]/30" : "text-red-400 border-red-400/30"
            )}
          >
            {isConnected ? "vLLM Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Test Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={isRunning ? stopTests : runTests}
            disabled={!isConnected || selectedPrompts.size === 0}
            className={cn(
              "gap-1",
              isRunning ? "bg-red-500 hover:bg-red-600" : "bg-[#3b82f6] hover:bg-[#3b82f6]/90"
            )}
          >
            {isRunning ? (
              <>
                <Square className="w-3 h-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Run Tests
              </>
            )}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={clearResults}
            disabled={results.length === 0}
            className="gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </Button>
          
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Batch:</span>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="h-8 px-2 text-xs bg-background border border-border rounded"
              disabled={isRunning}
            >
              <option value={1}>1x</option>
              <option value={3}>3x</option>
              <option value={5}>5x</option>
              <option value={10}>10x</option>
            </select>
          </div>
        </div>

        {/* Test Prompts Selection */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Test Prompts</div>
          <div className="flex flex-wrap gap-1">
            {TEST_PROMPTS.map(prompt => (
              <button
                key={prompt.id}
                onClick={() => togglePrompt(prompt.id)}
                disabled={isRunning}
                className={cn(
                  "px-2 py-1 text-xs rounded-md border transition-colors",
                  selectedPrompts.has(prompt.id)
                    ? "bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#3b82f6]"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50",
                  currentTest === prompt.id && "ring-2 ring-[#3b82f6] ring-offset-1 ring-offset-background"
                )}
              >
                {currentTest === prompt.id && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                {prompt.name}
              </button>
            ))}
          </div>
        </div>

        {/* Statistics */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Activity className="w-3 h-3" />
                Success Rate
              </div>
              <div className="text-lg font-mono font-semibold">
                {stats.totalTests > 0 ? ((stats.successfulTests / stats.totalTests) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-[10px] text-muted-foreground">
                {stats.successfulTests}/{stats.totalTests} tests
              </div>
            </div>
            
            <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Clock className="w-3 h-3" />
                Avg Latency
              </div>
              <div className="text-lg font-mono font-semibold text-[#00b4d8]">
                {stats.avgLatency.toFixed(0)}ms
              </div>
              <div className="text-[10px] text-muted-foreground">
                p95: {stats.p95Latency.toFixed(0)}ms
              </div>
            </div>
            
            <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Zap className="w-3 h-3" />
                Throughput
              </div>
              <div className="text-lg font-mono font-semibold text-[#3b82f6]">
                {stats.avgTokensPerSecond.toFixed(1)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                tokens/second
              </div>
            </div>
            
            <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Timer className="w-3 h-3" />
                Latency Range
              </div>
              <div className="text-lg font-mono font-semibold">
                {stats.minLatency.toFixed(0)}-{stats.maxLatency.toFixed(0)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                min-max (ms)
              </div>
            </div>
          </div>
        )}

        {/* Test Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Recent Results</div>
            <ScrollArea className="h-48">
              <div className="space-y-1 pr-4">
                {results.slice().reverse().slice(0, 20).map(result => (
                  <div key={result.id} className="rounded-lg border border-border/30 overflow-hidden">
                    <button
                      onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="w-3 h-3 text-[#3b82f6]" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                        <span className="font-medium">{result.promptName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{result.latencyMs}ms</span>
                        {result.success && (
                          <span className="text-[#3b82f6]">{result.tokensPerSecond.toFixed(1)} tok/s</span>
                        )}
                        {expandedResult === result.id ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </div>
                    </button>
                    
                    <AnimatePresence>
                      {expandedResult === result.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border/30"
                        >
                          <div className="p-3 text-xs">
                            {result.success ? (
                              <pre className="whitespace-pre-wrap text-muted-foreground font-mono">
                                {result.response?.slice(0, 500)}
                                {(result.response?.length || 0) > 500 && "..."}
                              </pre>
                            ) : (
                              <div className="text-red-400">{result.error}</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Progress indicator when running */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Running tests...</span>
              <span className="text-[#3b82f6]">
                {results.length} / {selectedPrompts.size * batchSize}
              </span>
            </div>
            <Progress 
              value={(results.length / (selectedPrompts.size * batchSize)) * 100} 
              className="h-1"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
