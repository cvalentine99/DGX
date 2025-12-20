import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Settings2, Layers, Timer, Cpu } from "lucide-react";

// Detection class colors (COCO dataset classes)
const CLASS_COLORS: Record<string, string> = {
  person: "#00FF00",
  bicycle: "#FF6B6B",
  car: "#4ECDC4",
  motorcycle: "#45B7D1",
  airplane: "#96CEB4",
  bus: "#FFEAA7",
  train: "#DDA0DD",
  truck: "#98D8C8",
  boat: "#F7DC6F",
  "traffic light": "#BB8FCE",
  "fire hydrant": "#F1948A",
  "stop sign": "#85C1E9",
  "parking meter": "#F8B500",
  bench: "#00CED1",
  bird: "#FF69B4",
  cat: "#FFD700",
  dog: "#32CD32",
  horse: "#FF4500",
  sheep: "#9370DB",
  cow: "#20B2AA",
  elephant: "#778899",
  bear: "#8B4513",
  zebra: "#000000",
  giraffe: "#DAA520",
  backpack: "#708090",
  umbrella: "#4169E1",
  handbag: "#DC143C",
  tie: "#00008B",
  suitcase: "#8B0000",
  frisbee: "#006400",
  skis: "#4B0082",
  snowboard: "#800000",
  "sports ball": "#FF8C00",
  kite: "#9932CC",
  "baseball bat": "#8B008B",
  "baseball glove": "#556B2F",
  skateboard: "#FF1493",
  surfboard: "#00BFFF",
  "tennis racket": "#1E90FF",
  bottle: "#B22222",
  "wine glass": "#228B22",
  cup: "#FF00FF",
  fork: "#FFD700",
  knife: "#ADFF2F",
  spoon: "#F0E68C",
  bowl: "#E6E6FA",
  banana: "#FFF44F",
  apple: "#FF0000",
  sandwich: "#F4A460",
  orange: "#FFA500",
  broccoli: "#228B22",
  carrot: "#FF7F50",
  "hot dog": "#CD853F",
  pizza: "#FFE4B5",
  donut: "#DEB887",
  cake: "#FFB6C1",
  chair: "#A0522D",
  couch: "#2F4F4F",
  "potted plant": "#006400",
  bed: "#483D8B",
  "dining table": "#8B4513",
  toilet: "#F5F5DC",
  tv: "#2F4F4F",
  laptop: "#696969",
  mouse: "#A9A9A9",
  remote: "#808080",
  keyboard: "#D3D3D3",
  "cell phone": "#C0C0C0",
  microwave: "#DCDCDC",
  oven: "#F5F5F5",
  toaster: "#FFFAF0",
  sink: "#F0FFF0",
  refrigerator: "#F0FFFF",
  book: "#F5FFFA",
  clock: "#FFF5EE",
  vase: "#FDF5E6",
  scissors: "#FAF0E6",
  "teddy bear": "#FAEBD7",
  "hair drier": "#FFEFD5",
  toothbrush: "#FFEBCD",
  default: "#76FF03",
};

// Detection result interface
interface Detection {
  id: string;
  class: string;
  confidence: number;
  bbox: {
    x: number; // normalized 0-1
    y: number;
    width: number;
    height: number;
  };
  timestamp: number;
}

// Inference stats interface
interface InferenceStats {
  fps: number;
  latency: number;
  totalDetections: number;
  classBreakdown: Record<string, number>;
}

interface InferenceOverlayProps {
  videoRef?: React.RefObject<HTMLVideoElement | HTMLCanvasElement | null>;
  width: number;
  height: number;
  detections?: Detection[];
  stats?: InferenceStats;
  onConfigChange?: (config: OverlayConfig) => void;
}

interface OverlayConfig {
  showBoxes: boolean;
  showLabels: boolean;
  showConfidence: boolean;
  showStats: boolean;
  confidenceThreshold: number;
  lineWidth: number;
  fontSize: number;
  selectedClasses: string[];
}

export function InferenceOverlay({
  videoRef,
  width,
  height,
  detections = [],
  stats,
  onConfigChange,
}: InferenceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<OverlayConfig>({
    showBoxes: true,
    showLabels: true,
    showConfidence: true,
    showStats: true,
    confidenceThreshold: 0.5,
    lineWidth: 2,
    fontSize: 14,
    selectedClasses: [],
  });
  const [showSettings, setShowSettings] = useState(false);

  // Filter detections based on config
  const filteredDetections = detections.filter((d) => {
    if (d.confidence < config.confidenceThreshold) return false;
    if (config.selectedClasses.length > 0 && !config.selectedClasses.includes(d.class)) {
      return false;
    }
    return true;
  });

  // Draw overlay on canvas
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw detections
    if (config.showBoxes) {
      for (const detection of filteredDetections) {
        const color = CLASS_COLORS[detection.class] || CLASS_COLORS.default;
        const x = detection.bbox.x * width;
        const y = detection.bbox.y * height;
        const w = detection.bbox.width * width;
        const h = detection.bbox.height * height;

        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = config.lineWidth;
        ctx.strokeRect(x, y, w, h);

        // Draw semi-transparent fill
        ctx.fillStyle = `${color}20`;
        ctx.fillRect(x, y, w, h);

        // Draw label background
        if (config.showLabels || config.showConfidence) {
          const label = config.showConfidence
            ? `${detection.class} ${(detection.confidence * 100).toFixed(0)}%`
            : detection.class;

          ctx.font = `bold ${config.fontSize}px Inter, system-ui, sans-serif`;
          const textMetrics = ctx.measureText(label);
          const textHeight = config.fontSize + 4;
          const padding = 4;

          // Background
          ctx.fillStyle = color;
          ctx.fillRect(
            x,
            y - textHeight - padding,
            textMetrics.width + padding * 2,
            textHeight + padding
          );

          // Text
          ctx.fillStyle = "#000000";
          ctx.fillText(label, x + padding, y - padding - 2);
        }
      }
    }

    // Draw stats overlay
    if (config.showStats && stats) {
      const statsX = 10;
      const statsY = 10;
      const lineHeight = 20;

      // Background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(statsX, statsY, 180, 90);

      // Stats text
      ctx.fillStyle = "#76FF03";
      ctx.font = "bold 14px monospace";
      ctx.fillText(`FPS: ${stats.fps.toFixed(1)}`, statsX + 10, statsY + lineHeight);
      ctx.fillText(`Latency: ${stats.latency.toFixed(1)}ms`, statsX + 10, statsY + lineHeight * 2);
      ctx.fillText(`Detections: ${filteredDetections.length}`, statsX + 10, statsY + lineHeight * 3);
      ctx.fillText(
        `Threshold: ${(config.confidenceThreshold * 100).toFixed(0)}%`,
        statsX + 10,
        statsY + lineHeight * 4
      );
    }
  }, [width, height, filteredDetections, config, stats]);

  // Animation loop
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      drawOverlay();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [drawOverlay]);

  // Notify parent of config changes
  useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  const updateConfig = (updates: Partial<OverlayConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // Get unique classes from detections
  const availableClasses = Array.from(new Set(detections.map((d) => d.class))).sort();

  return (
    <div className="relative" style={{ width, height }}>
      {/* Overlay canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ width, height }}
      />

      {/* Settings toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-black/70 text-white"
        onClick={() => setShowSettings(!showSettings)}
      >
        <Settings2 className="h-4 w-4" />
      </Button>

      {/* Settings panel */}
      {showSettings && (
        <Card className="absolute top-12 right-2 z-20 w-72 bg-black/90 border-[#76FF03]/30 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#76FF03]">
              <Layers className="h-4 w-4" />
              Overlay Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle switches */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  Show Boxes
                </Label>
                <Switch
                  checked={config.showBoxes}
                  onCheckedChange={(v) => updateConfig({ showBoxes: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Labels</Label>
                <Switch
                  checked={config.showLabels}
                  onCheckedChange={(v) => updateConfig({ showLabels: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Confidence</Label>
                <Switch
                  checked={config.showConfidence}
                  onCheckedChange={(v) => updateConfig({ showConfidence: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-2">
                  <Cpu className="h-3 w-3" />
                  Show Stats
                </Label>
                <Switch
                  checked={config.showStats}
                  onCheckedChange={(v) => updateConfig({ showStats: v })}
                />
              </div>
            </div>

            {/* Confidence threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Confidence Threshold</Label>
                <span className="text-xs text-[#76FF03]">
                  {(config.confidenceThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[config.confidenceThreshold * 100]}
                onValueChange={([v]) => updateConfig({ confidenceThreshold: v / 100 })}
                min={0}
                max={100}
                step={5}
                className="[&_[role=slider]]:bg-[#76FF03]"
              />
            </div>

            {/* Line width */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Box Line Width</Label>
                <span className="text-xs text-[#76FF03]">{config.lineWidth}px</span>
              </div>
              <Slider
                value={[config.lineWidth]}
                onValueChange={([v]) => updateConfig({ lineWidth: v })}
                min={1}
                max={6}
                step={1}
                className="[&_[role=slider]]:bg-[#76FF03]"
              />
            </div>

            {/* Class filter */}
            {availableClasses.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Filter Classes</Label>
                <Select
                  value={config.selectedClasses.length === 0 ? "all" : "custom"}
                  onValueChange={(v) => {
                    if (v === "all") {
                      updateConfig({ selectedClasses: [] });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-black/50 border-[#76FF03]/30">
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {availableClasses.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Detection count by class */}
            {stats && Object.keys(stats.classBreakdown).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Detection Breakdown</Label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.classBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([cls, count]) => (
                      <Badge
                        key={cls}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{
                          borderColor: CLASS_COLORS[cls] || CLASS_COLORS.default,
                          color: CLASS_COLORS[cls] || CLASS_COLORS.default,
                        }}
                      >
                        {cls}: {count}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Hook for simulating detections (for demo/testing)
export function useSimulatedDetections(enabled: boolean = true) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [stats, setStats] = useState<InferenceStats>({
    fps: 0,
    latency: 0,
    totalDetections: 0,
    classBreakdown: {},
  });

  useEffect(() => {
    if (!enabled) {
      setDetections([]);
      return;
    }

    const classes = ["person", "car", "dog", "cat", "bicycle", "cell phone", "laptop"];
    let frameCount = 0;
    const startTime = Date.now();

    const interval = setInterval(() => {
      frameCount++;
      const elapsed = (Date.now() - startTime) / 1000;

      // Generate random detections
      const numDetections = Math.floor(Math.random() * 5) + 1;
      const newDetections: Detection[] = [];
      const classBreakdown: Record<string, number> = {};

      for (let i = 0; i < numDetections; i++) {
        const cls = classes[Math.floor(Math.random() * classes.length)];
        classBreakdown[cls] = (classBreakdown[cls] || 0) + 1;

        newDetections.push({
          id: `det-${Date.now()}-${i}`,
          class: cls,
          confidence: 0.5 + Math.random() * 0.5,
          bbox: {
            x: Math.random() * 0.7,
            y: Math.random() * 0.7,
            width: 0.1 + Math.random() * 0.2,
            height: 0.1 + Math.random() * 0.3,
          },
          timestamp: Date.now(),
        });
      }

      setDetections(newDetections);
      setStats({
        fps: frameCount / elapsed,
        latency: 10 + Math.random() * 20,
        totalDetections: numDetections,
        classBreakdown,
      });
    }, 100);

    return () => clearInterval(interval);
  }, [enabled]);

  return { detections, stats };
}

export default InferenceOverlay;
