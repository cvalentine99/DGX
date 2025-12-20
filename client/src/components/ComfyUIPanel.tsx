import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  RefreshCw,
  Maximize2,
  Minimize2,
  Image,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface ComfyUIPanelProps {
  comfyUrl?: string;
}

export function ComfyUIPanel({ comfyUrl = "https://unpopular-thad-unblamed.ngrok-free.dev" }: ComfyUIPanelProps) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      // Use a simple fetch with no-cors mode to check if the server responds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(comfyUrl, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      // no-cors mode always returns opaque response, but if we get here without error, server is up
      setIsOnline(true);
    } catch (error) {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkStatus();
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [comfyUrl]);

  const openInNewTab = () => {
    window.open(comfyUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/90 to-gray-950/90 border-gray-800 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Image className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                ComfyUI
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isOnline === null 
                      ? "bg-gray-500/20 text-gray-400 border-gray-500/30"
                      : isOnline 
                        ? "bg-green-500/20 text-green-400 border-green-500/30" 
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}
                >
                  {isChecking ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : isOnline === null ? (
                    "Checking..."
                  ) : isOnline ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Online
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Offline
                    </>
                  )}
                </Badge>
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Stable Diffusion Image Generation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={checkStatus}
              disabled={isChecking}
              className="h-8 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2"
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openInNewTab}
              className="h-8 gap-1 bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Quick Info */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-black/30 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Zap className="w-3 h-3" />
              Engine
            </div>
            <div className="text-sm font-medium text-white">Stable Diffusion</div>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Image className="w-3 h-3" />
              Model
            </div>
            <div className="text-sm font-medium text-white">SD 1.5</div>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              Connection
            </div>
            <div className="text-sm font-medium text-white truncate" title={comfyUrl}>
              ngrok
            </div>
          </div>
        </div>

        {/* Embedded Preview or Placeholder */}
        {isExpanded ? (
          <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-black/50">
            <iframe
              src={comfyUrl}
              className="w-full h-[500px] border-0"
              title="ComfyUI"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
            <div className="absolute bottom-2 right-2">
              <Badge variant="outline" className="bg-black/70 text-gray-400 border-gray-700 text-xs">
                Embedded Preview
              </Badge>
            </div>
          </div>
        ) : (
          <div 
            className="relative rounded-lg overflow-hidden border border-gray-800 bg-gradient-to-br from-purple-900/20 to-pink-900/20 h-40 flex items-center justify-center cursor-pointer hover:border-purple-500/50 transition-colors group"
            onClick={openInNewTab}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Image className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-gray-400 text-sm">Click to open ComfyUI</p>
              <p className="text-gray-600 text-xs mt-1">Generate images with Stable Diffusion</p>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-4 left-4 w-20 h-20 bg-purple-500/10 rounded-full blur-xl" />
            <div className="absolute bottom-4 right-4 w-16 h-16 bg-pink-500/10 rounded-full blur-xl" />
          </div>
        )}

        {/* Last checked timestamp */}
        {lastChecked && (
          <p className="text-xs text-gray-600 mt-2 text-right">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
