/*
 * DashboardLayout - Cybernetic Control Room Layout
 * 
 * Design: Mission Control paradigm with persistent left command rail,
 * top status bar showing DGX Spark hosts, and main content area.
 * Optimized for ultrawide monitors.
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Server,
  Brain,
  MessageSquare,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Activity,
  Cpu,
  HardDrive,
  Thermometer,
  Wifi,
  WifiOff,
  Database,
  BookOpen,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// DGX Spark Host Configuration
const DGX_HOSTS = [
  { id: "spark-1", ip: "192.168.50.139", name: "DGX Spark Alpha", status: "online" as const },
  { id: "spark-2", ip: "192.168.50.110", name: "DGX Spark Beta", status: "online" as const },
];

// Navigation Items
const NAV_ITEMS = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard", description: "System Overview" },
  { path: "/environment", icon: Server, label: "Environment", description: "Setup & Config" },
  { path: "/data", icon: Database, label: "Data", description: "Dataset Curation" },
  { path: "/training", icon: Brain, label: "Training", description: "Fine-Tuning Studio" },
  { path: "/interaction", icon: MessageSquare, label: "Interaction", description: "Reasoning Interface" },
  { path: "/statistics", icon: BarChart3, label: "Statistics", description: "Observability Deck" },
  { path: "/knowledge", icon: BookOpen, label: "Knowledge", description: "RAG & Documents" },
  { path: "/holoscan", icon: Workflow, label: "Holoscan", description: "Pipeline Manager" },
  { path: "/cuda", icon: Cpu, label: "CUDA", description: "Toolkit & Versions" },
];

// Simulated host metrics (in production, these would come from API)
const getHostMetrics = (hostId: string) => ({
  gpuUtil: hostId === "spark-1" ? 78 : 65,
  memUsed: hostId === "spark-1" ? 45.2 : 38.7,
  memTotal: 128,
  temp: hostId === "spark-1" ? 62 : 58,
  power: hostId === "spark-1" ? 285 : 245,
});

function HostStatusCard({ host }: { host: typeof DGX_HOSTS[0] }) {
  const metrics = getHostMetrics(host.id);
  const isOnline = host.status === "online";

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/50 border border-border/50 hover:border-primary/30 transition-colors">
      <div className={cn(
        "hex-status",
        isOnline ? "hex-status-online" : "hex-status-offline"
      )}>
        {isOnline ? (
          <Wifi className="w-3 h-3 text-background" />
        ) : (
          <WifiOff className="w-3 h-3 text-muted-foreground" />
        )}
      </div>
      
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium text-foreground truncate">{host.name}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{host.ip}</span>
      </div>
      
      {isOnline && (
        <div className="flex items-center gap-3 ml-auto text-[10px] font-mono">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-nvidia-green" />
                <span className="text-nvidia-green">{metrics.gpuUtil}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>GPU Utilization</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-nvidia-teal" />
                <span className="text-nvidia-teal">{metrics.memUsed}GB</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Memory: {metrics.memUsed}/{metrics.memTotal}GB</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-muted-foreground" />
                <span className={cn(
                  metrics.temp > 70 ? "text-nvidia-warning" : "text-muted-foreground"
                )}>{metrics.temp}°C</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Temperature</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [location] = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 240 : 64 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50 flex flex-col"
    >
      {/* Logo Area */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-nvidia-green flex items-center justify-center glow-green">
            <Activity className="w-5 h-5 text-background" />
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col"
              >
                <span className="font-display text-sm font-bold text-foreground tracking-wider">NEMO</span>
                <span className="text-[10px] text-muted-foreground tracking-wide">COMMAND CENTER</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;

          return (
            <Tooltip key={item.path} delayDuration={expanded ? 1000 : 0}>
              <TooltipTrigger asChild>
                <Link href={item.path}>
                  <motion.div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon className={cn("w-5 h-5 shrink-0", isActive && "text-nvidia-green")} />
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.15 }}
                          className="flex flex-col min-w-0"
                        >
                          <span className="text-sm font-medium truncate">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{item.description}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              </TooltipTrigger>
              {!expanded && (
                <TooltipContent side="right">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}

function StatusBar({ sidebarExpanded }: { sidebarExpanded: boolean }) {
  return (
    <motion.header
      initial={false}
      animate={{ left: sidebarExpanded ? 240 : 64 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed top-0 right-0 h-14 bg-card/80 backdrop-blur-md border-b border-border z-40 flex items-center justify-between px-4"
    >
      {/* Model Info */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="font-display text-xs font-semibold text-nvidia-green tracking-wider">NEMOTRON-3-NANO-30B</span>
          <span className="text-[10px] text-muted-foreground">A3B-BF16 • MoE Architecture</span>
        </div>
      </div>

      {/* DGX Spark Hosts Status */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium mr-2">DGX SPARK HOSTS</span>
        {DGX_HOSTS.map((host) => (
          <HostStatusCard key={host.id} host={host} />
        ))}
      </div>

      {/* System Time */}
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Activity className="w-3 h-3 text-nvidia-green animate-pulse" />
        <span>SYSTEM ACTIVE</span>
      </div>
    </motion.header>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} />
      <StatusBar sidebarExpanded={sidebarExpanded} />
      
      <motion.main
        initial={false}
        animate={{ 
          marginLeft: sidebarExpanded ? 240 : 64,
          paddingTop: 56 
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="min-h-screen"
      >
        <div className="p-6">
          {children}
        </div>
      </motion.main>
    </div>
  );
}
