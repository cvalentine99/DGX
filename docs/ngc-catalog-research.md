# NGC Catalog Research for Container Browser

## Key Findings

### Container Registry
- Registry URL: `nvcr.io`
- Pull format: `docker pull nvcr.io/nvidia/{container}:{tag}`
- 849 total containers available
- 111 NeMo-related containers

### Popular AI/ML Containers

#### NeMo Framework
- **NeMo Operator** - Kubernetes operator for NeMo microservices
- **NeMo Curator** - GPU-powered data curation for generative AI
- **nemo-automodel** - LLM and VLM training with PyTorch DTensor
- **nemo-rl** - Reinforcement learning post-training
- **NeMo Studio** - Web interface for NeMo microservices
- **NeMo Core** - Shared components
- **NeMo Evaluator** - Model evaluation service
- **NeMo Customizer** - Model customization
- **NeMo Guardrails** - Safety checks and moderation
- **NeMo Framework Megatron Backend** - Pre-training, post-training

#### Core AI Containers
- **PyTorch** - GPU accelerated tensor framework
- **TensorFlow** - Open source ML platform
- **TensorRT** - High-performance inference
- **Triton Inference Server** - Deploy trained AI models
- **CUDA** - Container registry for CUDA images

#### Infrastructure
- **NVIDIA Container Toolkit** - Build GPU Docker containers
- **NVIDIA GPU Operator** - Deploy GPU resources in K8s
- **DCGM Exporter** - Monitor GPUs in Kubernetes
- **NVIDIA Driver** - GPU Driver as container

### Container Categories
1. NeMo Framework
2. Deep Learning (PyTorch, TensorFlow)
3. Inference (TensorRT, Triton)
4. Infrastructure (GPU Operator, DCGM)
5. NVIDIA NIM (LLM inference)

### Pull Command Format
```bash
docker pull nvcr.io/nvidia/nemo:24.09
docker pull nvcr.io/nvidia/pytorch:24.09-py3
docker pull nvcr.io/nvidia/tensorrt:24.09-py3
docker pull nvcr.io/nvidia/tritonserver:24.09-py3
```

### Tags Pattern
- Format: `YY.MM` (e.g., 24.09, 24.07)
- Variants: `-py3`, `-igpu`, `-pyt`, `-tf`
