import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Server,
  Cpu,
  Video,
  Bell,
  Shield,
  RefreshCw,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  TestTube,
  Wifi,
  Database,
  Thermometer,
  Zap,
  HardDrive,
} from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  host: string;
  lastChecked: Date | null;
  error?: string;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("ssh");
  
  // SSH Settings
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUsername, setSshUsername] = useState("");
  const [sshPassword, setSshPassword] = useState("");
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [sshStatus, setSshStatus] = useState<ConnectionStatus>({ connected: false, host: "", lastChecked: null });
  const [testingSsh, setTestingSsh] = useState(false);
  
  // vLLM Settings
  const [vllmUrl, setVllmUrl] = useState("");
  const [vllmApiKey, setVllmApiKey] = useState("");
  const [showVllmKey, setShowVllmKey] = useState(false);
  const [vllmStatus, setVllmStatus] = useState<ConnectionStatus>({ connected: false, host: "", lastChecked: null });
  const [testingVllm, setTestingVllm] = useState(false);
  
  // TURN Server Settings
  const [turnUrl, setTurnUrl] = useState("");
  const [turnUsername, setTurnUsername] = useState("");
  const [turnCredential, setTurnCredential] = useState("");
  const [showTurnCredential, setShowTurnCredential] = useState(false);
  
  // Alert Thresholds
  const [tempWarning, setTempWarning] = useState(65);
  const [tempCritical, setTempCritical] = useState(75);
  const [powerWarning, setPowerWarning] = useState(80);
  const [memoryWarning, setMemoryWarning] = useState(90);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  
  // Saving state
  const [saving, setSaving] = useState(false);

  // Fetch current settings
  const { data: currentSettings, refetch: refetchSettings } = trpc.settings.getSettings.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Test SSH connection
  const testSshMutation = trpc.ssh.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSshStatus({
          connected: true,
          host: data.hostname || sshHost,
          lastChecked: new Date(),
        });
        setTestingSsh(false);
        toast.success(`SSH Connected to ${data.hostname}`);
      } else {
        setSshStatus({
          connected: false,
          host: sshHost,
          lastChecked: new Date(),
          error: data.error,
        });
        setTestingSsh(false);
        toast.error(data.error || "SSH connection failed");
      }
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setSshStatus({
        connected: false,
        host: sshHost,
        lastChecked: new Date(),
        error: String(error.message || error),
      });
      setTestingSsh(false);
      toast.error(String(error.message || "SSH connection failed"));
    },
  });

  // Test vLLM connection
  const testVllmMutation = trpc.vllm.chatCompletion.useMutation({
    onSuccess: (data) => {
      setVllmStatus({
        connected: !data.simulated,
        host: vllmUrl,
        lastChecked: new Date(),
        error: data.simulated ? "Using simulated response (vLLM not connected)" : undefined,
      });
      setTestingVllm(false);
      if (data.simulated) {
        toast.warning("vLLM not connected - using simulated responses");
      } else {
        toast.success(`vLLM Connected - Model: ${data.model}`);
      }
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setVllmStatus({
        connected: false,
        host: vllmUrl,
        lastChecked: new Date(),
        error: String(error.message || error),
      });
      setTestingVllm(false);
      toast.error(String(error.message || "vLLM connection failed"));
    },
  });

  // Save settings mutation
  const saveSettingsMutation = trpc.settings.updateSettings.useMutation({
    onSuccess: () => {
      setSaving(false);
      toast.success("Settings saved successfully");
      refetchSettings();
    },
    onError: (error) => {
      setSaving(false);
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  // Load settings on mount
  useEffect(() => {
    if (currentSettings) {
      setSshHost(currentSettings.sshHost || "");
      setSshPort(currentSettings.sshPort?.toString() || "22");
      setSshUsername(currentSettings.sshUsername || "");
      setVllmUrl(currentSettings.vllmUrl || "");
      setTurnUrl(currentSettings.turnUrl || "");
      setTurnUsername(currentSettings.turnUsername || "");
      setTempWarning(currentSettings.tempWarning || 65);
      setTempCritical(currentSettings.tempCritical || 75);
      setPowerWarning(currentSettings.powerWarning || 80);
      setMemoryWarning(currentSettings.memoryWarning || 90);
      setAlertsEnabled(currentSettings.alertsEnabled === 1 || currentSettings.alertsEnabled === true);
    }
  }, [currentSettings]);

  const handleTestSsh = () => {
    setTestingSsh(true);
    testSshMutation.mutate({
      hostId: "alpha" as const,
    });
  };

  const handleTestVllm = () => {
    setTestingVllm(true);
    testVllmMutation.mutate({
      messages: [{ role: "user" as const, content: "test" }],
      maxTokens: 1,
    });
  };

  const handleSaveSettings = () => {
    setSaving(true);
    saveSettingsMutation.mutate({
      sshHost,
      sshPort: parseInt(sshPort),
      sshUsername,
      sshPassword: sshPassword || undefined,
      vllmUrl,
      vllmApiKey: vllmApiKey || undefined,
      turnUrl,
      turnUsername,
      turnCredential: turnCredential || undefined,
      tempWarning,
      tempCritical,
      powerWarning,
      memoryWarning,
      alertsEnabled,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <SettingsIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-sm text-muted-foreground">Configure your NeMo Command Center</p>
              </div>
            </div>
            <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="ssh" className="gap-2">
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">SSH</span>
            </TabsTrigger>
            <TabsTrigger value="vllm" className="gap-2">
              <Cpu className="h-4 w-4" />
              <span className="hidden sm:inline">vLLM</span>
            </TabsTrigger>
            <TabsTrigger value="webrtc" className="gap-2">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">WebRTC</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          {/* SSH Settings */}
          <TabsContent value="ssh" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      SSH Connection
                    </CardTitle>
                    <CardDescription>
                      Configure SSH connection to your DGX Spark systems
                    </CardDescription>
                  </div>
                  <Badge variant={sshStatus.connected ? "default" : "secondary"} className="gap-1">
                    {sshStatus.connected ? (
                      <><CheckCircle2 className="h-3 w-3" /> Connected</>
                    ) : (
                      <><XCircle className="h-3 w-3" /> Disconnected</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ssh-host">Host / ngrok Endpoint</Label>
                    <Input
                      id="ssh-host"
                      placeholder="4.tcp.ngrok.io or 192.168.50.139"
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use ngrok TCP endpoint for remote access
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ssh-port">Port</Label>
                    <Input
                      id="ssh-port"
                      placeholder="22 or ngrok port"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ssh-username">Username</Label>
                    <Input
                      id="ssh-username"
                      placeholder="machivellian"
                      value={sshUsername}
                      onChange={(e) => setSshUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ssh-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="ssh-password"
                        type={showSshPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={sshPassword}
                        onChange={(e) => setSshPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowSshPassword(!showSshPassword)}
                      >
                        {showSshPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use existing credentials
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Connection Status</p>
                    {sshStatus.lastChecked && (
                      <p className="text-xs text-muted-foreground">
                        Last checked: {sshStatus.lastChecked.toLocaleTimeString()}
                        {sshStatus.connected && sshStatus.host && ` • Host: ${sshStatus.host}`}
                      </p>
                    )}
                    {sshStatus.error && (
                      <p className="text-xs text-destructive">{sshStatus.error}</p>
                    )}
                  </div>
                  <Button onClick={handleTestSsh} disabled={testingSsh} variant="outline" className="gap-2">
                    {testingSsh ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                    Test Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* vLLM Settings */}
          <TabsContent value="vllm" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      vLLM Inference Server
                    </CardTitle>
                    <CardDescription>
                      Configure connection to your vLLM inference endpoint
                    </CardDescription>
                  </div>
                  <Badge variant={vllmStatus.connected ? "default" : "secondary"} className="gap-1">
                    {vllmStatus.connected ? (
                      <><CheckCircle2 className="h-3 w-3" /> Connected</>
                    ) : (
                      <><XCircle className="h-3 w-3" /> Disconnected</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="vllm-url">vLLM API URL</Label>
                  <Input
                    id="vllm-url"
                    placeholder="http://192.168.50.139:8001/v1"
                    value={vllmUrl}
                    onChange={(e) => setVllmUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    OpenAI-compatible API endpoint (usually port 8000 or 8001)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vllm-key">API Key (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="vllm-key"
                      type={showVllmKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={vllmApiKey}
                      onChange={(e) => setVllmApiKey(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowVllmKey(!showVllmKey)}
                    >
                      {showVllmKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Connection Status</p>
                    {vllmStatus.lastChecked && (
                      <p className="text-xs text-muted-foreground">
                        Last checked: {vllmStatus.lastChecked.toLocaleTimeString()}
                      </p>
                    )}
                    {vllmStatus.error && (
                      <p className="text-xs text-destructive">{vllmStatus.error}</p>
                    )}
                  </div>
                  <Button onClick={handleTestVllm} disabled={testingVllm} variant="outline" className="gap-2">
                    {testingVllm ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                    Test Connection
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  vLLM Container Commands
                </CardTitle>
                <CardDescription>
                  Quick reference for starting vLLM on your DGX Spark
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{`# Stop existing container
docker stop vllm-server && docker rm vllm-server

# Start vLLM with correct syntax (v25.11+)
docker run -d --gpus all --name vllm-server \\
  -p 8001:8000 \\
  -v /models:/models \\
  --restart unless-stopped \\
  nvcr.io/nvidia/vllm:25.11-py3 \\
  serve /models/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8 \\
  --host 0.0.0.0 --port 8000`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WebRTC Settings */}
          <TabsContent value="webrtc" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  TURN Server Configuration
                </CardTitle>
                <CardDescription>
                  Configure TURN server for WebRTC NAT traversal (camera streaming)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="turn-url">TURN Server URL</Label>
                  <Input
                    id="turn-url"
                    placeholder="nemo-dgx-spark.metered.live"
                    value={turnUrl}
                    onChange={(e) => setTurnUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    From Metered.ca or your TURN provider
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="turn-username">Username / API Key</Label>
                    <Input
                      id="turn-username"
                      placeholder="username"
                      value={turnUsername}
                      onChange={(e) => setTurnUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="turn-credential">Credential</Label>
                    <div className="relative">
                      <Input
                        id="turn-credential"
                        type={showTurnCredential ? "text" : "password"}
                        placeholder="••••••••"
                        value={turnCredential}
                        onChange={(e) => setTurnCredential(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowTurnCredential(!showTurnCredential)}
                      >
                        {showTurnCredential ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  ICE Server Configuration
                </CardTitle>
                <CardDescription>
                  Generated ICE servers for WebRTC peer connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{`iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:${turnUrl || 'your-turn-server'}:3478" },
  {
    urls: "turn:${turnUrl || 'your-turn-server'}:443?transport=tcp",
    username: "${turnUsername || 'username'}",
    credential: "••••••••"
  }
]`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alert Settings */}
          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Alert Configuration
                    </CardTitle>
                    <CardDescription>
                      Set thresholds for GPU temperature, power, and memory alerts
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="alerts-enabled" className="text-sm">Alerts Enabled</Label>
                    <Switch
                      id="alerts-enabled"
                      checked={alertsEnabled}
                      onCheckedChange={setAlertsEnabled}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Temperature Thresholds */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-5 w-5 text-orange-500" />
                    <h3 className="font-medium">Temperature Thresholds</h3>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Warning Threshold</Label>
                        <span className="text-sm font-medium text-yellow-500">{tempWarning}°C</span>
                      </div>
                      <Slider
                        value={[tempWarning]}
                        onValueChange={([v]) => setTempWarning(v)}
                        min={50}
                        max={85}
                        step={1}
                        className="[&_[role=slider]]:bg-yellow-500"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Critical Threshold</Label>
                        <span className="text-sm font-medium text-red-500">{tempCritical}°C</span>
                      </div>
                      <Slider
                        value={[tempCritical]}
                        onValueChange={([v]) => setTempCritical(v)}
                        min={60}
                        max={95}
                        step={1}
                        className="[&_[role=slider]]:bg-red-500"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Power Threshold */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-medium">Power Threshold</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Warning at % of TDP</Label>
                      <span className="text-sm font-medium text-yellow-500">{powerWarning}%</span>
                    </div>
                    <Slider
                      value={[powerWarning]}
                      onValueChange={([v]) => setPowerWarning(v)}
                      min={50}
                      max={100}
                      step={5}
                      className="[&_[role=slider]]:bg-yellow-500"
                    />
                  </div>
                </div>

                <Separator />

                {/* Memory Threshold */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-blue-500" />
                    <h3 className="font-medium">Memory Threshold</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Warning at % Usage</Label>
                      <span className="text-sm font-medium text-blue-500">{memoryWarning}%</span>
                    </div>
                    <Slider
                      value={[memoryWarning]}
                      onValueChange={([v]) => setMemoryWarning(v)}
                      min={50}
                      max={100}
                      step={5}
                      className="[&_[role=slider]]:bg-blue-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Info */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  System Information
                </CardTitle>
                <CardDescription>
                  NeMo Command Center version and status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Application Version</p>
                    <p className="font-medium">1.0.0</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Environment</p>
                    <p className="font-medium">Production</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">WebSocket Signaling</p>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Database</p>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Refresh All Connections</p>
                    <p className="text-xs text-muted-foreground">
                      Test SSH, vLLM, and database connections
                    </p>
                  </div>
                  <Button variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Restart SSH Connection Pool
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Database className="h-4 w-4" />
                  Clear Alert History
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  Reset All Settings to Default
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
