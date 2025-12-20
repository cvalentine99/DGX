/*
 * GpuHistoryChart - Time-series visualization for GPU metrics
 * 
 * Displays historical trends of GPU utilization, temperature, and power
 * with configurable time ranges and smooth animations.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import {
  Cpu,
  Thermometer,
  Zap,
  HardDrive,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

// Chart colors matching NVIDIA theme
const CHART_COLORS = {
  utilization: "#76b900", // NVIDIA Green
  temperature: "#ff6b35", // Orange/Warning
  power: "#00bcd4", // Teal
  memory: "#9c27b0", // Purple
};

type TimeRange = "1h" | "6h" | "24h";
type MetricType = "utilization" | "temperature" | "power" | "memory";

interface GpuHistoryChartProps {
  hostId: string;
  hostName: string;
  className?: string;
}

// Format timestamp for X-axis
function formatTime(timestamp: number, timeRange: TimeRange): string {
  const date = new Date(timestamp);
  if (timeRange === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const date = new Date(label);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs text-muted-foreground mb-2 font-mono">{timeStr}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono font-semibold" style={{ color: entry.color }}>
              {entry.value}
              {entry.name === "Utilization" && "%"}
              {entry.name === "Temperature" && "°C"}
              {entry.name === "Power" && "W"}
              {entry.name === "Memory" && "GB"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Single metric chart component
function MetricChart({
  data,
  dataKey,
  name,
  color,
  unit,
  icon: Icon,
  domain,
  timeRange,
}: {
  data: any[];
  dataKey: string;
  name: string;
  color: string;
  unit: string;
  icon: React.ElementType;
  domain: [number, number];
  timeRange: TimeRange;
}) {
  // Calculate current, min, max, avg
  const values = data.map((d) => d[dataKey]).filter((v) => v !== undefined);
  const current = values[values.length - 1] || 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return (
    <div className="space-y-3">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="text-sm font-medium">{name}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Current:</span>
            <span className="font-mono font-semibold" style={{ color }}>
              {current.toFixed(dataKey === "memoryUsedGB" ? 1 : 0)}{unit}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Avg:</span>
            <span className="font-mono">{avg.toFixed(1)}{unit}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Min/Max:</span>
            <span className="font-mono">{min.toFixed(0)}-{max.toFixed(0)}{unit}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatTime(ts, timeRange)}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
              axisLine={false}
              tickLine={false}
              width={35}
              tickFormatter={(v) => `${v}${unit}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              name={name}
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${dataKey})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GpuHistoryChart({ hostId, hostName, className }: GpuHistoryChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [activeMetrics, setActiveMetrics] = useState<MetricType[]>([
    "utilization",
    "temperature",
    "power",
  ]);

  // Fetch history data
  const { data: historyData, isLoading } = trpc.dcgm.getHistory.useQuery(
    { hostId, timeRange },
    {
      refetchInterval: 60000, // Refresh every minute
    }
  );

  // Transform data for charts
  const chartData =
    historyData?.points.map((point) => ({
      timestamp: point.timestamp,
      utilization: point.utilization,
      temperature: point.temperature,
      power: point.powerDraw,
      memoryUsedGB: point.memoryUsed / 1024,
    })) || [];

  const toggleMetric = (metric: MetricType) => {
    setActiveMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    );
  };

  return (
    <Card className={cn("cyber-panel", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nvidia-green/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-nvidia-green" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">
                {hostName} - GPU History
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Historical performance metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Metric toggles */}
            <div className="flex items-center gap-1">
              {[
                { key: "utilization", icon: Cpu, color: CHART_COLORS.utilization, label: "Util" },
                { key: "temperature", icon: Thermometer, color: CHART_COLORS.temperature, label: "Temp" },
                { key: "power", icon: Zap, color: CHART_COLORS.power, label: "Power" },
                { key: "memory", icon: HardDrive, color: CHART_COLORS.memory, label: "Mem" },
              ].map(({ key, icon: Icon, color, label }) => (
                <Button
                  key={key}
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMetric(key as MetricType)}
                  className={cn(
                    "h-7 px-2 gap-1",
                    activeMetrics.includes(key as MetricType)
                      ? "bg-muted"
                      : "opacity-50"
                  )}
                >
                  <Icon className="w-3 h-3" style={{ color }} />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>

            {/* Time range selector */}
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <TabsList className="h-8">
                <TabsTrigger value="1h" className="text-xs px-3 h-6">
                  1H
                </TabsTrigger>
                <TabsTrigger value="6h" className="text-xs px-3 h-6">
                  6H
                </TabsTrigger>
                <TabsTrigger value="24h" className="text-xs px-3 h-6">
                  24H
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {historyData && !historyData.isLive && (
              <Badge variant="outline" className="text-[10px] border-nvidia-warning/50 text-nvidia-warning">
                NO DATA
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Clock className="w-8 h-8 text-muted-foreground animate-pulse" />
              <span className="text-sm text-muted-foreground">Loading history...</span>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">No history data available</span>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {activeMetrics.includes("utilization") && (
              <MetricChart
                data={chartData}
                dataKey="utilization"
                name="Utilization"
                color={CHART_COLORS.utilization}
                unit="%"
                icon={Cpu}
                domain={[0, 100]}
                timeRange={timeRange}
              />
            )}

            {activeMetrics.includes("temperature") && (
              <MetricChart
                data={chartData}
                dataKey="temperature"
                name="Temperature"
                color={CHART_COLORS.temperature}
                unit="°C"
                icon={Thermometer}
                domain={[30, 90]}
                timeRange={timeRange}
              />
            )}

            {activeMetrics.includes("power") && (
              <MetricChart
                data={chartData}
                dataKey="power"
                name="Power"
                color={CHART_COLORS.power}
                unit="W"
                icon={Zap}
                domain={[0, 500]}
                timeRange={timeRange}
              />
            )}

            {activeMetrics.includes("memory") && (
              <MetricChart
                data={chartData}
                dataKey="memoryUsedGB"
                name="Memory"
                color={CHART_COLORS.memory}
                unit="GB"
                icon={HardDrive}
                domain={[0, 96]}
                timeRange={timeRange}
              />
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// Combined chart showing all hosts
export function GpuHistoryComparisonChart({ className }: { className?: string }) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");

  // Fetch history for both hosts
  const { data: alphaHistory } = trpc.dcgm.getHistory.useQuery(
    { hostId: "alpha", timeRange },
    { refetchInterval: 60000 }
  );

  const { data: betaHistory } = trpc.dcgm.getHistory.useQuery(
    { hostId: "beta", timeRange },
    { refetchInterval: 60000 }
  );

  // Merge data for comparison
  const mergedData = alphaHistory?.points.map((point, index) => {
    const betaPoint = betaHistory?.points[index];
    return {
      timestamp: point.timestamp,
      alphaUtil: point.utilization,
      betaUtil: betaPoint?.utilization || 0,
      alphaTemp: point.temperature,
      betaTemp: betaPoint?.temperature || 0,
      alphaPower: point.powerDraw,
      betaPower: betaPoint?.powerDraw || 0,
    };
  }) || [];

  return (
    <Card className={cn("cyber-panel", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nvidia-teal/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-nvidia-teal" />
            </div>
            <div>
              <CardTitle className="text-base font-display tracking-wide">
                GPU Utilization Comparison
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                DGX Spark Alpha vs Beta
              </p>
            </div>
          </div>

          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <TabsList className="h-8">
              <TabsTrigger value="1h" className="text-xs px-3 h-6">1H</TabsTrigger>
              <TabsTrigger value="6h" className="text-xs px-3 h-6">6H</TabsTrigger>
              <TabsTrigger value="24h" className="text-xs px-3 h-6">24H</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts) => formatTime(ts, timeRange)}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                axisLine={false}
                tickLine={false}
                width={35}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <Line
                type="monotone"
                dataKey="alphaUtil"
                name="Spark Alpha"
                stroke="#76b900"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="betaUtil"
                name="Spark Beta"
                stroke="#00bcd4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default GpuHistoryChart;
