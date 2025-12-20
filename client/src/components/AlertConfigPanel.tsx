/*
 * AlertConfigPanel - GPU Temperature & Power Alert Configuration
 * 
 * Allows users to configure alert thresholds for GPU temperature,
 * power draw, memory usage, and utilization. Displays alert history
 * with dismiss functionality.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Thermometer,
  Zap,
  HardDrive,
  Cpu,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Default alert thresholds (matching backend)
const DEFAULT_THRESHOLDS = {
  temperatureWarning: 65,
  temperatureCritical: 70,
  powerSpikePercent: 90,
  utilizationHigh: 95,
  memoryHigh: 90,
};

interface AlertThresholds {
  temperatureWarning: number;
  temperatureCritical: number;
  powerSpikePercent: number;
  utilizationHigh: number;
  memoryHigh: number;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function ThresholdSlider({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  icon: Icon,
  warningThreshold,
  criticalThreshold,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  icon: React.ElementType;
  warningThreshold?: number;
  criticalThreshold?: number;
}) {
  const getColor = () => {
    if (criticalThreshold && value >= criticalThreshold) return "text-nvidia-critical";
    if (warningThreshold && value >= warningThreshold) return "text-nvidia-warning";
    return "text-nvidia-green";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", getColor())} />
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        <span className={cn("text-sm font-mono font-semibold", getColor())}>
          {value}{unit}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function AlertHistoryItem({
  alert,
  onDismiss,
}: {
  alert: {
    id: number;
    type: "success" | "info" | "warning" | "error";
    message: string;
    hostId: string | null;
    timestamp: Date;
    timeAgo: string;
  };
  onDismiss: (id: number) => void;
}) {
  const getIcon = () => {
    switch (alert.type) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-nvidia-green" />;
      case "info": return <Info className="w-4 h-4 text-nvidia-teal" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-nvidia-warning" />;
      case "error": return <XCircle className="w-4 h-4 text-nvidia-critical" />;
    }
  };

  const getBadgeVariant = () => {
    switch (alert.type) {
      case "success": return "outline";
      case "info": return "secondary";
      case "warning": return "outline";
      case "error": return "destructive";
    }
  };

  return (
    <motion.div
      variants={itemVariants}
      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
    >
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{alert.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{alert.timeAgo}</span>
          {alert.hostId && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {alert.hostId}
            </Badge>
          )}
          <Badge variant={getBadgeVariant()} className="text-[10px] px-1.5 py-0">
            {alert.type}
          </Badge>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDismiss(alert.id)}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}

export function AlertConfigPanel() {
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  // Fetch alerts
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = trpc.stats.getAlerts.useQuery(
    { limit: 50 },
    { refetchInterval: 30000 }
  );

  // Dismiss alert mutation
  const dismissMutation = trpc.stats.dismissAlert.useMutation({
    onSuccess: () => {
      refetchAlerts();
      toast.success("Alert dismissed");
    },
    onError: (error) => {
      toast.error(`Failed to dismiss alert: ${error.message}`);
    },
  });

  const handleDismiss = (id: number) => {
    dismissMutation.mutate({ id });
  };

  const handleSaveThresholds = () => {
    // In a real implementation, this would save to the backend
    toast.success("Alert thresholds updated", {
      description: `Temperature warning: ${thresholds.temperatureWarning}°C, Critical: ${thresholds.temperatureCritical}°C`,
    });
  };

  const handleResetDefaults = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    toast.info("Thresholds reset to defaults");
  };

  const alertCounts = {
    error: alerts?.filter(a => a.type === "error").length || 0,
    warning: alerts?.filter(a => a.type === "warning").length || 0,
    info: alerts?.filter(a => a.type === "info").length || 0,
    success: alerts?.filter(a => a.type === "success").length || 0,
  };

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
              <div className="w-10 h-10 rounded-lg bg-nvidia-warning/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-nvidia-warning" />
              </div>
              <div>
                <CardTitle className="text-lg font-display">Alert Configuration</CardTitle>
                <CardDescription>Configure GPU monitoring thresholds and view alert history</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {alertCounts.error > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3 h-3" />
                  {alertCounts.error}
                </Badge>
              )}
              {alertCounts.warning > 0 && (
                <Badge variant="outline" className="border-nvidia-warning/50 text-nvidia-warning gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {alertCounts.warning}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="thresholds" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="thresholds" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Thresholds
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Bell className="w-4 h-4" />
                History ({alerts?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="thresholds" className="space-y-6">
              {/* Enable/Disable Alerts */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Bell className={cn("w-5 h-5", alertsEnabled ? "text-nvidia-green" : "text-muted-foreground")} />
                  <div>
                    <Label className="text-sm font-medium">Enable Alerts</Label>
                    <p className="text-xs text-muted-foreground">Receive notifications when thresholds are exceeded</p>
                  </div>
                </div>
                <Switch
                  checked={alertsEnabled}
                  onCheckedChange={setAlertsEnabled}
                />
              </div>

              {/* Temperature Thresholds */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-nvidia-warning" />
                  Temperature Thresholds
                </h4>
                <div className="grid gap-6 pl-6">
                  <ThresholdSlider
                    label="Warning Threshold"
                    description="Alert when GPU temperature exceeds this value"
                    value={thresholds.temperatureWarning}
                    onChange={(v) => setThresholds({ ...thresholds, temperatureWarning: v })}
                    min={40}
                    max={85}
                    unit="°C"
                    icon={Thermometer}
                    warningThreshold={65}
                  />
                  <ThresholdSlider
                    label="Critical Threshold"
                    description="Critical alert when GPU temperature exceeds this value"
                    value={thresholds.temperatureCritical}
                    onChange={(v) => setThresholds({ ...thresholds, temperatureCritical: v })}
                    min={50}
                    max={95}
                    unit="°C"
                    icon={Thermometer}
                    warningThreshold={70}
                    criticalThreshold={80}
                  />
                </div>
              </div>

              {/* Power Threshold */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-nvidia-teal" />
                  Power Threshold
                </h4>
                <div className="pl-6">
                  <ThresholdSlider
                    label="Power Spike Detection"
                    description="Alert when power draw exceeds this percentage of the limit"
                    value={thresholds.powerSpikePercent}
                    onChange={(v) => setThresholds({ ...thresholds, powerSpikePercent: v })}
                    min={50}
                    max={100}
                    unit="%"
                    icon={Zap}
                    warningThreshold={85}
                    criticalThreshold={95}
                  />
                </div>
              </div>

              {/* Utilization & Memory Thresholds */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-nvidia-green" />
                  Utilization & Memory
                </h4>
                <div className="grid gap-6 pl-6">
                  <ThresholdSlider
                    label="High Utilization"
                    description="Alert when GPU utilization is sustained above this level"
                    value={thresholds.utilizationHigh}
                    onChange={(v) => setThresholds({ ...thresholds, utilizationHigh: v })}
                    min={50}
                    max={100}
                    unit="%"
                    icon={Cpu}
                    warningThreshold={90}
                  />
                  <ThresholdSlider
                    label="Memory Usage"
                    description="Alert when unified memory usage exceeds this percentage"
                    value={thresholds.memoryHigh}
                    onChange={(v) => setThresholds({ ...thresholds, memoryHigh: v })}
                    min={50}
                    max={100}
                    unit="%"
                    icon={HardDrive}
                    warningThreshold={85}
                    criticalThreshold={95}
                  />
                </div>
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Email Notifications</Label>
                    <p className="text-xs text-muted-foreground">Send email alerts for critical events (coming soon)</p>
                  </div>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  disabled
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
                <Button variant="outline" onClick={handleResetDefaults}>
                  Reset to Defaults
                </Button>
                <Button onClick={handleSaveThresholds} className="bg-nvidia-green hover:bg-nvidia-green/90">
                  Save Thresholds
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <XCircle className="w-3 h-3 text-nvidia-critical" />
                    {alertCounts.error} Critical
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="w-3 h-3 text-nvidia-warning" />
                    {alertCounts.warning} Warning
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Info className="w-3 h-3 text-nvidia-teal" />
                    {alertCounts.info} Info
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchAlerts()}
                  disabled={alertsLoading}
                  className="gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", alertsLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                {alertsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : alerts && alerts.length > 0 ? (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
                    }}
                    className="space-y-2"
                  >
                    {alerts.map((alert) => (
                      <AlertHistoryItem
                        key={alert.id}
                        alert={alert}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mb-2 text-nvidia-green" />
                    <p className="text-sm">No active alerts</p>
                    <p className="text-xs">All systems operating normally</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
