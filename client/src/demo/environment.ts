/**
 * Demo Data - Environment
 * 
 * Mock environment topology, software stack, and container images for demo/development.
 * Only used when DEMO_MODE is enabled in config.ts
 */

export interface DemoTopologyNode {
  id: string;
  name: string;
  type: "dgx" | "switch" | "storage" | "workstation";
  ip?: string;
  status: "online" | "offline" | "warning";
}

export interface DemoTopologyLink {
  source: string;
  target: string;
  bandwidth: string;
}

export const DEMO_TOPOLOGY_DATA = {
  nodes: [
    { id: "alpha", name: "DGX Spark Alpha", type: "dgx" as const, ip: "192.168.50.139", status: "online" as const },
    { id: "beta", name: "DGX Spark Beta", type: "dgx" as const, ip: "192.168.50.110", status: "online" as const },
    { id: "switch1", name: "Core Switch", type: "switch" as const, status: "online" as const },
    { id: "storage1", name: "NAS Storage", type: "storage" as const, status: "online" as const },
    { id: "workstation1", name: "Dev Workstation", type: "workstation" as const, status: "online" as const },
  ],
  links: [
    { source: "alpha", target: "switch1", bandwidth: "100 Gbps" },
    { source: "beta", target: "switch1", bandwidth: "100 Gbps" },
    { source: "switch1", target: "storage1", bandwidth: "25 Gbps" },
    { source: "switch1", target: "workstation1", bandwidth: "10 Gbps" },
  ],
};

export interface DemoSoftwareItem {
  name: string;
  version: string;
  status: "installed" | "available" | "update";
}

export const DEMO_SOFTWARE_STACK: DemoSoftwareItem[] = [
  { name: "CUDA Toolkit", version: "12.6", status: "installed" },
  { name: "cuDNN", version: "9.5.1", status: "installed" },
  { name: "TensorRT", version: "10.6", status: "installed" },
  { name: "NCCL", version: "2.23.4", status: "installed" },
  { name: "PyTorch", version: "2.5.1", status: "installed" },
  { name: "NeMo Framework", version: "2.0", status: "installed" },
];

export interface DemoModelArtifact {
  name: string;
  size: string;
  type: "checkpoint" | "onnx" | "tensorrt";
  path: string;
}

export const DEMO_MODEL_ARTIFACTS: DemoModelArtifact[] = [
  { name: "nemotron-3-nano-30b", size: "56 GB", type: "checkpoint", path: "/models/nemotron-3-nano-30b" },
  { name: "llama-3.1-8b-instruct", size: "16 GB", type: "checkpoint", path: "/models/llama-3.1-8b" },
  { name: "mistral-7b-v0.3", size: "14 GB", type: "checkpoint", path: "/models/mistral-7b" },
  { name: "codellama-13b", size: "26 GB", type: "checkpoint", path: "/models/codellama-13b" },
];

export interface DemoContainerImage {
  name: string;
  tag: string;
  size: string;
  pulled: string;
}

export const DEMO_CONTAINER_IMAGES: DemoContainerImage[] = [
  { name: "nvcr.io/nvidia/nemo", tag: "24.09", size: "18.2 GB", pulled: "2024-12-15" },
  { name: "nvcr.io/nvidia/pytorch", tag: "24.09-py3", size: "14.8 GB", pulled: "2024-12-10" },
  { name: "nvcr.io/nvidia/tritonserver", tag: "24.09-py3", size: "12.1 GB", pulled: "2024-12-08" },
  { name: "nvcr.io/nvidia/tensorrt", tag: "24.09-py3", size: "8.4 GB", pulled: "2024-12-05" },
];
