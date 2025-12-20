# NeMo Command Center - Design Notes

## Project Overview
A comprehensive Operations Platform for NVIDIA Nemotron-3-Nano-30B-A3B-BF16 model with five core pillars:
1. **Environment Setup** - Hardware topology, model artifacts, containerized runtime
2. **Model Training** - Data curation, fine-tuning studio, training telemetry
3. **Interaction** - Glass Box reasoning UI, prompt engineering, inference controls
4. **Statistics** - MoE expert routing heatmap, vLLM telemetry, system health
5. **Environment Management** - Deployment, security guardrails

## Key Modules

### Module 1: Environment & Setup Hub
- Hardware Topology Visualizer (GPU detection via NVML, NVLink status, P2P bandwidth)
- Driver Compatibility Check (CUDA 12.x requirement)
- Model Artifact Management (Hugging Face Hub integration, BF16/FP8/GGUF precision)
- Local Cache Visualization (disk usage donut chart)
- Containerized Runtime Orchestration (Docker/Apptainer)

### Module 2: Data Curation Foundry
- Dataset Ingestion (.jsonl, .parquet, .txt)
- Inspector View (parse JSON, visualize <think> tags)
- Corpus Statistics (token count distribution, language identification)
- Automated Curation Pipelines (deduplication, quality filtering, PII redaction)
- Synthetic Data Generation Wizard

### Module 3: Training & Fine-Tuning Studio
- Recipe Builder (SFT, PEFT/LoRA, DPO)
- MoE-Specific Hyperparameters (Auxiliary Loss, Router Z-Loss, Sinkhorn Balancing)
- Job Orchestration with NeMo Run
- Real-Time Training Telemetry (Loss Decomposition, Throughput Metrics)

### Module 4: Interaction & Reasoning Interface
- Glass Box Reasoning UI (Collapsible Reasoning Block with <think> parsing)
- System Prompt Library (preset modes)
- Few-Shot Workbench
- Jinja2 Template Editor
- Inference Configuration Knobs (Thinking Budget, Temperature, Top-P)

### Module 5: Observability & Statistics Deck
- MoE Expert Routing Heatmap (128 experts x 32 layers)
- vLLM Inference Telemetry (TPOT, TTFT, KV Cache, Generation Throughput)
- System Health Monitoring (GPU utilization, memory, P2P bandwidth)

## Design System - NVIDIA Next Gen Look
- Dark theme with deep blue/purple backgrounds
- Teal accent colors (#23908E)
- Status colors: Red (critical), Orange (warning), Yellow (caution), Green (success)
- Modern card-based layout
- Optimized for ultrawide monitors
- Chart.js for data visualizations

## Technology Stack
- Frontend: React + TypeScript + TailwindCSS
- Backend: FastAPI (Python)
- Database: PostgreSQL
- Cache: Redis
- Inference: vLLM containers

## Design Tokens (from design-tokens.css)
- Dark mode backgrounds: #1a1a2e, #16213e, #0f3460
- Accent: #23908E (teal)
- Status colors defined
- Spacing: 4px, 8px, 16px, 24px, 32px, 48px
- Typography: Lato font family
- Shadows and transitions defined
