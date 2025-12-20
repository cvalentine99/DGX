/*
 * BenchmarkPanel - Model Inference Benchmark Tool
 * 
 * Measures actual inference throughput (tokens/second) against
 * theoretical peak performance (1 petaFLOP FP4 capability).
 * Displays latency percentiles and benchmark history.
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Gauge,
  Play,
  Square,
  RotateCcw,
  TrendingUp,
  Clock,
  Zap,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

// Benchmark test configurations
const BENCHMARK_TESTS = {
  short: {
    name: "Short Prompt",
    description: "Quick response test (32 tokens)",
    prompt: "What is machine learning?",
    expectedTokens: 32,
    maxTokens: 64,
  },
  medium: {
    name: "Medium Prompt",
    description: "Standard inference test (128 tokens)",
    prompt: "Explain the architecture of a transformer neural network, including attention mechanisms, positional encoding, and how they enable parallel processing of sequences.",
    expectedTokens: 128,
    maxTokens: 256,
  },
  long: {
    name: "Long Prompt",
    description: "Extended generation test (512 tokens)",
    prompt: "Write a comprehensive technical guide on deploying large language models on NVIDIA DGX systems, covering hardware requirements, software stack, optimization techniques, and best practices for production inference.",
    expectedTokens: 512,
    maxTokens: 1024,
  },
};

type BenchmarkTestType = keyof typeof BENCHMARK_TESTS;

interface BenchmarkResult {
  testType: BenchmarkTestType;
  timestamp: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  tokensPerSecond: number;
  timeToFirstToken: number;
  success: boolean;
  error?: string;
}

interface BenchmarkStats {
  avgTokensPerSecond: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalRuns: number;
  successRate: number;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Theoretical peak performance for DGX Spark (1 petaFLOP FP4)
const THEORETICAL_PEAK_TOKS = 1000; // Estimated peak tokens/second for Nemotron-3-Nano

function calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
  if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const p50Index = Math.floor(sorted.length * 0.5);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);
  
  return {
    p50: sorted[p50Index] || 0,
    p95: sorted[p95Index] || sorted[sorted.length - 1] || 0,
    p99: sorted[p99Index] || sorted[sorted.length - 1] || 0,
  };
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  color = "nvidia-green",
  subtext,
}: {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ElementType;
  color?: string;
  subtext?: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", `text-${color}`)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-mono font-bold", `text-${color}`)}>
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
      )}
    </div>
  );
}

function LatencyChart({ results }: { results: BenchmarkResult[] }) {
  const chartData = results.map((r, i) => ({
    run: i + 1,
    latency: r.latencyMs,
    tokensPerSecond: r.tokensPerSecond,
    testType: r.testType,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis 
          dataKey="run" 
          stroke="oklch(0.5 0 0)" 
          fontSize={10}
          tickLine={false}
        />
        <YAxis 
          stroke="oklch(0.5 0 0)" 
          fontSize={10}
          tickLine={false}
          label={{ value: 'ms', angle: -90, position: 'insideLeft', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'oklch(0.15 0 0)',
            border: '1px solid oklch(0.3 0 0)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string) => [
            `${value.toFixed(0)}ms`,
            name === 'latency' ? 'Latency' : name
          ]}
        />
        <Area
          type="monotone"
          dataKey="latency"
          stroke="oklch(0.72 0.19 145)"
          fill="url(#latencyGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ThroughputChart({ results }: { results: BenchmarkResult[] }) {
  const chartData = results.map((r, i) => ({
    run: i + 1,
    tokensPerSecond: r.tokensPerSecond,
    theoretical: THEORETICAL_PEAK_TOKS,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis 
          dataKey="run" 
          stroke="oklch(0.5 0 0)" 
          fontSize={10}
          tickLine={false}
        />
        <YAxis 
          stroke="oklch(0.5 0 0)" 
          fontSize={10}
          tickLine={false}
          domain={[0, 'auto']}
          label={{ value: 'tok/s', angle: -90, position: 'insideLeft', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'oklch(0.15 0 0)',
            border: '1px solid oklch(0.3 0 0)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <ReferenceLine 
          y={THEORETICAL_PEAK_TOKS} 
          stroke="oklch(0.58 0.22 25)" 
          strokeDasharray="5 5"
          label={{ value: 'Peak', position: 'right', fontSize: 10, fill: 'oklch(0.58 0.22 25)' }}
        />
        <Line
          type="monotone"
          dataKey="tokensPerSecond"
          stroke="oklch(0.72 0.19 145)"
          strokeWidth={2}
          dot={{ fill: 'oklch(0.72 0.19 145)', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BenchmarkPanel() {
  const [selectedTest, setSelectedTest] = useState<BenchmarkTestType>("medium");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [currentRun, setCurrentRun] = useState(0);
  const [totalRuns, setTotalRuns] = useState(5);
  const abortRef = useRef(false);

  // vLLM health check
  const { data: vllmHealth } = trpc.vllm.healthCheck.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  // Chat completion mutation for benchmarking
  const chatMutation = trpc.vllm.chatCompletion.useMutation();

  const isConnected = vllmHealth?.status === "connected";

  // Calculate stats from results
  const percentiles = calculatePercentiles(results.map(r => r.latencyMs));
  const stats: BenchmarkStats = {
    avgTokensPerSecond: results.length > 0 
      ? results.reduce((acc, r) => acc + r.tokensPerSecond, 0) / results.length 
      : 0,
    p50Latency: percentiles.p50,
    p95Latency: percentiles.p95,
    p99Latency: percentiles.p99,
    totalRuns: results.length,
    successRate: results.length > 0 
      ? (results.filter(r => r.success).length / results.length) * 100 
      : 0,
  };

  const runBenchmark = async () => {
    if (!isConnected) {
      toast.error("vLLM server not connected", {
        description: "Please ensure the inference server is running.",
      });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setCurrentRun(0);
    abortRef.current = false;

    const test = BENCHMARK_TESTS[selectedTest];
    const newResults: BenchmarkResult[] = [];

    for (let i = 0; i < totalRuns; i++) {
      if (abortRef.current) break;
      
      setCurrentRun(i + 1);
      const startTime = performance.now();

      try {
        const response = await chatMutation.mutateAsync({
          messages: [
            { role: "system", content: "You are a helpful AI assistant. Respond concisely and accurately." },
            { role: "user", content: test.prompt },
          ],
          maxTokens: test.maxTokens,
          temperature: 0.7,
          enableThinking: false,
        });

        const endTime = performance.now();
        const latencyMs = endTime - startTime;
        
        const promptTokens = response.usage?.prompt_tokens || 0;
        const completionTokens = response.usage?.completion_tokens || 0;
        const totalTokens = promptTokens + completionTokens;
        const tokensPerSecond = (completionTokens / latencyMs) * 1000;

        const result: BenchmarkResult = {
          testType: selectedTest,
          timestamp: Date.now(),
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          tokensPerSecond,
          timeToFirstToken: latencyMs / 2, // Approximation
          success: true,
        };

        newResults.push(result);
        setResults([...newResults]);

      } catch (error: any) {
        const endTime = performance.now();
        newResults.push({
          testType: selectedTest,
          timestamp: Date.now(),
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: endTime - startTime,
          tokensPerSecond: 0,
          timeToFirstToken: 0,
          success: false,
          error: error.message,
        });
        setResults([...newResults]);
      }

      // Small delay between runs
      if (i < totalRuns - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);
    toast.success("Benchmark complete", {
      description: `Completed ${newResults.filter(r => r.success).length}/${totalRuns} runs`,
    });
  };

  const stopBenchmark = () => {
    abortRef.current = true;
    setIsRunning(false);
    toast.info("Benchmark stopped");
  };

  const resetResults = () => {
    setResults([]);
    setCurrentRun(0);
  };

  const efficiencyPercent = stats.avgTokensPerSecond > 0 
    ? Math.min(100, (stats.avgTokensPerSecond / THEORETICAL_PEAK_TOKS) * 100)
    : 0;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
      }}
    >
      <Card className="cyber-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
                <Gauge className="w-5 h-5 text-nvidia-green" />
              </div>
              <div>
                <CardTitle className="text-lg font-display">Model Benchmark</CardTitle>
                <CardDescription>Measure inference throughput vs theoretical peak (1 petaFLOP FP4)</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="outline" className="border-nvidia-green/50 text-nvidia-green gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  vLLM Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-nvidia-warning/50 text-nvidia-warning gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Benchmark Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Test Type</label>
              <Select
                value={selectedTest}
                onValueChange={(v) => setSelectedTest(v as BenchmarkTestType)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BENCHMARK_TESTS).map(([key, test]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{test.name}</span>
                        <span className="text-xs text-muted-foreground">{test.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-24">
              <label className="text-xs text-muted-foreground mb-1 block">Runs</label>
              <Select
                value={totalRuns.toString()}
                onValueChange={(v) => setTotalRuns(parseInt(v))}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 runs</SelectItem>
                  <SelectItem value="5">5 runs</SelectItem>
                  <SelectItem value="10">10 runs</SelectItem>
                  <SelectItem value="20">20 runs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              {isRunning ? (
                <Button
                  variant="destructive"
                  onClick={stopBenchmark}
                  className="gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={runBenchmark}
                  disabled={!isConnected}
                  className="gap-2 bg-nvidia-green hover:bg-nvidia-green/90"
                >
                  <Play className="w-4 h-4" />
                  Run Benchmark
                </Button>
              )}
              <Button
                variant="outline"
                onClick={resetResults}
                disabled={isRunning || results.length === 0}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-nvidia-green" />
                  Running benchmark...
                </span>
                <span className="font-mono">{currentRun} / {totalRuns}</span>
              </div>
              <Progress value={(currentRun / totalRuns) * 100} className="h-2" />
            </div>
          )}

          {/* Results Summary */}
          {results.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Avg Throughput"
                  value={stats.avgTokensPerSecond.toFixed(1)}
                  unit="tok/s"
                  icon={Zap}
                  color="nvidia-green"
                  subtext={`${efficiencyPercent.toFixed(1)}% of theoretical peak`}
                />
                <MetricCard
                  label="P50 Latency"
                  value={stats.p50Latency.toFixed(0)}
                  unit="ms"
                  icon={Clock}
                  color="nvidia-teal"
                />
                <MetricCard
                  label="P95 Latency"
                  value={stats.p95Latency.toFixed(0)}
                  unit="ms"
                  icon={Clock}
                  color="nvidia-warning"
                />
                <MetricCard
                  label="Success Rate"
                  value={stats.successRate.toFixed(0)}
                  unit="%"
                  icon={CheckCircle2}
                  color={stats.successRate === 100 ? "nvidia-green" : "nvidia-warning"}
                />
              </div>

              {/* Efficiency Gauge */}
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Efficiency vs Theoretical Peak</span>
                  <span className="text-sm font-mono text-nvidia-green">
                    {efficiencyPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-4 rounded-full overflow-hidden bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-nvidia-green to-nvidia-teal transition-all duration-500"
                    style={{ width: `${efficiencyPercent}%` }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 w-1 bg-nvidia-warning"
                    style={{ left: '100%', transform: 'translateX(-100%)' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0 tok/s</span>
                  <span>Theoretical: {THEORETICAL_PEAK_TOKS} tok/s</span>
                </div>
              </div>

              {/* Charts */}
              <Tabs defaultValue="throughput" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="throughput" className="gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Throughput
                  </TabsTrigger>
                  <TabsTrigger value="latency" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Latency
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="throughput">
                  <ThroughputChart results={results} />
                </TabsContent>

                <TabsContent value="latency">
                  <LatencyChart results={results} />
                </TabsContent>
              </Tabs>

              {/* Results Table */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Run Details</h4>
                <div className="max-h-[200px] overflow-auto rounded-lg border border-border/50">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-medium">Run</th>
                        <th className="p-2 text-left font-medium">Tokens</th>
                        <th className="p-2 text-left font-medium">Latency</th>
                        <th className="p-2 text-left font-medium">Throughput</th>
                        <th className="p-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, index) => (
                        <tr key={index} className="border-t border-border/30">
                          <td className="p-2 font-mono">{index + 1}</td>
                          <td className="p-2 font-mono">{result.completionTokens}</td>
                          <td className="p-2 font-mono">{result.latencyMs.toFixed(0)}ms</td>
                          <td className="p-2 font-mono text-nvidia-green">
                            {result.tokensPerSecond.toFixed(1)} tok/s
                          </td>
                          <td className="p-2">
                            {result.success ? (
                              <Badge variant="outline" className="text-nvidia-green border-nvidia-green/50">
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Failed
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Empty State */}
          {results.length === 0 && !isRunning && (
            <div className="text-center py-8 text-muted-foreground">
              <Gauge className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No benchmark results yet</p>
              <p className="text-xs mt-1">Run a benchmark to measure inference performance</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
