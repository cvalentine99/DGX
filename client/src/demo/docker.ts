/**
 * Demo Data - Docker
 * 
 * Mock NVIDIA workshop templates and container data for demo/development.
 * Only used when DEMO_MODE is enabled in config.ts
 */

export interface DemoWorkshopTemplate {
  id: string;
  name: string;
  description: string;
  image: string;
  tag: string;
  category: "ai" | "hpc" | "visualization" | "development";
  size: string;
  documentation: string;
}

export const DEMO_NVIDIA_WORKSHOP_TEMPLATES: DemoWorkshopTemplate[] = [
  {
    id: "nemo-framework",
    name: "NeMo Framework",
    description: "NVIDIA NeMo for building, training, and fine-tuning LLMs",
    image: "nvcr.io/nvidia/nemo",
    tag: "24.09",
    category: "ai",
    size: "18.2 GB",
    documentation: "https://docs.nvidia.com/nemo-framework/",
  },
  {
    id: "pytorch",
    name: "PyTorch",
    description: "Optimized PyTorch container with CUDA support",
    image: "nvcr.io/nvidia/pytorch",
    tag: "24.09-py3",
    category: "ai",
    size: "14.8 GB",
    documentation: "https://docs.nvidia.com/deeplearning/frameworks/pytorch-release-notes/",
  },
  {
    id: "triton",
    name: "Triton Inference Server",
    description: "High-performance inference serving",
    image: "nvcr.io/nvidia/tritonserver",
    tag: "24.09-py3",
    category: "ai",
    size: "12.1 GB",
    documentation: "https://docs.nvidia.com/deeplearning/triton-inference-server/",
  },
  {
    id: "tensorrt",
    name: "TensorRT",
    description: "High-performance deep learning inference optimizer",
    image: "nvcr.io/nvidia/tensorrt",
    tag: "24.09-py3",
    category: "ai",
    size: "8.4 GB",
    documentation: "https://docs.nvidia.com/deeplearning/tensorrt/",
  },
  {
    id: "rapids",
    name: "RAPIDS",
    description: "GPU-accelerated data science libraries",
    image: "nvcr.io/nvidia/rapidsai/base",
    tag: "24.10-cuda12.5-py3.12",
    category: "ai",
    size: "10.2 GB",
    documentation: "https://docs.rapids.ai/",
  },
  {
    id: "holoscan",
    name: "Holoscan SDK",
    description: "AI sensor processing platform",
    image: "nvcr.io/nvidia/clara-holoscan/holoscan",
    tag: "v2.6.0-dgpu",
    category: "ai",
    size: "15.6 GB",
    documentation: "https://docs.nvidia.com/holoscan/",
  },
  {
    id: "isaac-sim",
    name: "Isaac Sim",
    description: "Robotics simulation platform",
    image: "nvcr.io/nvidia/isaac-sim",
    tag: "4.2.0",
    category: "visualization",
    size: "22.4 GB",
    documentation: "https://docs.nvidia.com/isaac/isaac-sim/",
  },
  {
    id: "modulus",
    name: "Modulus",
    description: "Physics-ML framework for simulations",
    image: "nvcr.io/nvidia/modulus/modulus",
    tag: "24.09",
    category: "hpc",
    size: "11.8 GB",
    documentation: "https://docs.nvidia.com/modulus/",
  },
];

export interface DemoRunningContainer {
  id: string;
  name: string;
  image: string;
  status: "running" | "paused" | "exited";
  ports: string[];
  created: string;
  cpuUsage: number;
  memoryUsage: number;
}

export const DEMO_RUNNING_CONTAINERS: DemoRunningContainer[] = [
  {
    id: "abc123",
    name: "nemo-training",
    image: "nvcr.io/nvidia/nemo:24.09",
    status: "running",
    ports: ["8888:8888", "6006:6006"],
    created: "2024-12-20T08:00:00Z",
    cpuUsage: 45,
    memoryUsage: 62,
  },
  {
    id: "def456",
    name: "triton-server",
    image: "nvcr.io/nvidia/tritonserver:24.09-py3",
    status: "running",
    ports: ["8000:8000", "8001:8001", "8002:8002"],
    created: "2024-12-19T14:30:00Z",
    cpuUsage: 12,
    memoryUsage: 28,
  },
];
