# NeMo Command Center - Features & Options

## Overview

NeMo Command Center is a comprehensive GPU infrastructure management platform designed for NVIDIA DGX Spark systems. It provides real-time monitoring, container management, AI model deployment, and Holoscan pipeline orchestration through a unified web interface.

**Architecture:** Single-host deployment that monitors itself (LOCAL) and can SSH into remote DGX hosts (REMOTE).

---

## Pages & Features

### 1. Dashboard (System Overview)

**Purpose:** Real-time monitoring of DGX Spark infrastructure and model status.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Host Status Cards | Display GPU utilization, memory, temperature, power for each host | `dcgm.getMetrics`, `dcgm.getAllMetrics` |
| LOCAL/REMOTE Badges | Visual indicator showing which host runs locally vs SSH | `dcgm.getHosts` |
| Auto-refresh | Configurable polling interval for live metrics | Client-side |
| Connection Status | Real-time SSH connection health indicator | `ssh.getHostConnectionStatus` |

---

### 2. Environment (Setup & Config)

**Purpose:** View system topology, software stack, and model artifacts.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| System Topology | Visual representation of DGX Spark cluster | Demo data (configurable) |
| Software Stack | Installed CUDA, cuDNN, TensorRT versions | `ssh.getCudaVersions` |
| Model Artifacts | List of deployed models and their locations | Demo data |
| Container Images | Available NGC container images | `docker.listImages` |

---

### 3. Data Curation (Dataset Management)

**Purpose:** Manage training datasets and file operations on DGX storage.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Dataset Catalog | List registered datasets with metadata | `dataset.list` |
| File Browser | Navigate DGX filesystem | `ssh.listDirectory` |
| File Upload | Upload files to DGX storage | `ssh.uploadFile` |
| File Download | Download files from DGX | `ssh.readFile` |
| Bulk Operations | Move, delete, rename multiple files | `ssh.bulkMove`, `ssh.bulkDelete` |
| Archive Management | Create/extract tar.gz, zip archives | `ssh.createArchive`, `ssh.extractArchive` |
| Disk Usage | View storage utilization | `ssh.getDiskUsage` |
| Dataset Scan | Discover datasets in /data/ directories | `dataset.scan` |
| Quality Validation | Validate dataset quality metrics | `dataset.validate` |
| Training Data Generator | Generate synthetic training data | `trainingData.generate` |

---

### 4. Training (Fine-Tuning Studio)

**Purpose:** Configure and launch model fine-tuning jobs.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Training Recipes | Pre-configured training configurations | `trainingTemplates.list` |
| Job Creation | Launch new training jobs | `training.createJob` |
| Job Monitoring | View running job status and logs | `training.getJob`, `training.getJobs` |
| Job Cancellation | Stop running training jobs | `training.cancelJob` |
| MoE Configuration | Mixture of Experts parameter tuning | Client-side |
| Loss Visualization | Training loss curves and metrics | Demo data |
| Base Model Selection | Choose foundation models for fine-tuning | `training.getBaseModels` |

---

### 5. Interaction (Reasoning Interface)

**Purpose:** Chat with deployed vLLM models and test inference.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Chat Interface | Interactive conversation with LLM | `vllm.chatCompletion` |
| RAG Chat | Retrieval-augmented generation | `vllm.ragChatCompletion` |
| Model Selection | Choose from available vLLM models | `vllm.listModels` |
| System Prompts | Pre-configured prompt templates | Client-side config |
| Model Loading | Load/unload models dynamically | `vllm.loadModel`, `vllm.unloadModel` |
| Health Check | vLLM server connection status | `vllm.healthCheck` |
| Inference Stats | Token throughput and latency metrics | `vllm.getInferenceStats` |

---

### 6. Statistics (Observability Deck)

**Purpose:** Historical metrics and performance analytics.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| GPU Metrics History | Historical GPU utilization graphs | `stats.getMetrics` |
| Memory Trends | Memory usage over time | `stats.getMetrics` |
| Power Consumption | Power draw analytics | `stats.getMetrics` |
| Temperature Trends | Thermal monitoring history | `stats.getMetrics` |

---

### 7. Knowledge Base (RAG & Documents)

**Purpose:** Manage documents for retrieval-augmented generation.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Document Upload | Add documents to knowledge base | `rag.addDocument` |
| Document List | View indexed documents | `rag.getDocuments` |
| Document Delete | Remove documents from index | `rag.deleteDocument` |
| Context Retrieval | Query relevant document chunks | `rag.getContext` |
| Answer Generation | Generate answers from knowledge base | `rag.getAnswer` |

---

### 8. Holoscan (Pipeline Manager)

**Purpose:** Manage real-time AI inference pipelines with camera integration.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Camera Detection | List connected USB/CSI cameras | `ssh.getCameraDevices` |
| Pipeline Templates | Pre-built Holoscan pipeline configs | Client-side config |
| Pipeline Deployment | Deploy pipelines to DGX | `ssh.deployPipeline` |
| Pipeline Start/Stop | Control running pipelines | `ssh.startPipeline`, `ssh.stopPipeline` |
| Pipeline Logs | View pipeline execution logs | `ssh.getPipelineLogs` |
| WebRTC Preview | Live camera stream preview | `webrtc.getCameras`, WebRTC signaling |
| Inference Overlay | Real-time detection visualization | Client-side |
| GStreamer Sender | Deploy video streaming service | `ssh.deployGStreamerSender` |

**Pipeline Templates:**
- Object Detection (YOLO/SSD)
- Pose Estimation (PoseNet)
- Semantic Segmentation (DeepLabV3)
- Face Detection & Recognition
- Valentine RF Signal Processing
- Network Security Forensics

---

### 9. CUDA Toolkit

**Purpose:** View and manage CUDA toolkit installations.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| CUDA Versions | List installed CUDA toolkit versions | `ssh.getCudaVersions` |
| cuDNN Info | cuDNN library information | `ssh.getCudaVersions` |
| TensorRT Info | TensorRT installation details | `ssh.getCudaVersions` |
| NCCL Info | NCCL library version | `ssh.getCudaVersions` |

---

### 10. Docker & K8s (Container Management)

**Purpose:** Full Docker container and Kubernetes management.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Container List | View all containers with status | `docker.listContainers` |
| Container Start/Stop | Control container lifecycle | `docker.startContainer`, `docker.stopContainer` |
| Container Restart | Restart containers | `docker.restartContainer` |
| Container Delete | Remove containers | `docker.deleteContainer` |
| Container Logs | View container output | `docker.getContainerLogs` |
| Container Stats | Real-time resource usage | `docker.getContainerStats` |
| Container Exec | Execute commands in container | `docker.execContainerCommand` |
| Image List | View Docker images | `docker.listImages` |
| Image Pull | Pull images from registries | `docker.pullImage` |
| Image Delete | Remove Docker images | `docker.deleteDockerImage` |
| Network Management | Create/delete Docker networks | `docker.createNetwork`, `docker.deleteNetwork` |
| Volume Management | Create/delete Docker volumes | `docker.createVolume`, `docker.deleteVolume` |
| Compose Stacks | Deploy docker-compose stacks | `docker.deployComposeStack` |
| NGC Templates | Pre-configured NVIDIA container templates | Client-side config |
| Presets | Save/load container configurations | `presets.getPresets`, `presets.createPreset` |
| Export/Import | Export/import preset configurations | `presets.exportPresets`, `presets.importPresets` |
| Action History | Container operation audit log | `containerHistory.getHistory` |
| Kubernetes Status | K8s cluster health (if configured) | `docker.getKubernetesStatus` |

**NGC Workshop Templates:**
- NIM LLM Inference
- NeMo Curator
- NeMo Framework Training
- Triton Inference Server
- RAPIDS cuML
- Riva Speech AI

---

### 11. Settings (System Configuration)

**Purpose:** Configure application settings and credentials.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| SSH Credentials | Configure remote host SSH access | `settings.updateSSHCredentials` |
| API Keys | NGC, HuggingFace token management | `settings.updateApiKeys` |
| vLLM Configuration | vLLM server URL and settings | `settings.updateVllmConfig` |
| TURN Server | WebRTC TURN server configuration | `settings.updateTurnConfig` |
| Alert Management | View and dismiss system alerts | `settings.getAlerts`, `settings.dismissAlert` |
| Connection Test | Test SSH connectivity | `ssh.testConnection` |

---

### 12. Deploy (Deployment Wizard)

**Purpose:** Guided deployment of AI workloads.

| Feature | Description | Backend Endpoint |
|---------|-------------|------------------|
| Deployment Templates | Pre-configured deployment options | `deployment.getTemplates` |
| Deployment Status | Track deployment progress | `deployment.getDeploymentStatus` |
| Deployment Cancel | Abort running deployments | `deployment.cancelDeployment` |
| Systemd Services | Deploy as systemd services | `ssh.deploySystemdService` |
| Port Management | Find available ports | `ssh.findAvailablePort` |

---

## Backend Routers Summary

| Router | Purpose | Key Endpoints |
|--------|---------|---------------|
| `sshRouter` | SSH command execution, file ops, system info | 100+ endpoints |
| `dcgmRouter` | GPU metrics via DCGM/nvidia-smi | `getMetrics`, `getAllMetrics`, `getHosts` |
| `dockerRouter` | Container/image/network/volume management | Full Docker API |
| `vllmRouter` | vLLM inference server integration | `chatCompletion`, `listModels`, `healthCheck` |
| `webrtcRouter` | Camera streaming via WebRTC | `getCameras`, signaling |
| `trainingRouter` | Training job management | `createJob`, `getJobs`, `cancelJob` |
| `trainingDataRouter` | Synthetic data generation | `generate`, `export`, `validate` |
| `datasetRouter` | Dataset catalog management | `list`, `create`, `scan`, `validate` |
| `ragRouter` | RAG document management | `addDocument`, `getContext`, `getAnswer` |
| `presetsRouter` | Container preset management | `getPresets`, `exportPresets`, `importPresets` |
| `settingsRouter` | Application configuration | `updateSSHCredentials`, `updateApiKeys` |
| `statsRouter` | Historical metrics storage | `getMetrics`, `recordMetrics` |
| `containerHistoryRouter` | Container action audit log | `getHistory`, `getHistoryByHost` |
| `deploymentRouter` | Deployment orchestration | `deploy`, `getStatus`, `cancel` |
| `trainingTemplatesRouter` | Training recipe templates | `list`, `get`, `create` |

---

## Configuration Options

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string | Yes |
| `JWT_SECRET` | Authentication secret | Yes |
| `LOCAL_HOST` | Which host is local (alpha/beta) | Yes |
| `DGX_SSH_HOST` | Remote DGX IP address | For remote |
| `DGX_SSH_PORT` | Remote SSH port | For remote |
| `DGX_SSH_USERNAME` | Remote SSH username | For remote |
| `DGX_SSH_PASSWORD` | Remote SSH password | For remote |
| `DGX_SSH_PRIVATE_KEY` | SSH private key (preferred) | For remote |
| `NGC_API_KEY` | NVIDIA NGC API key | Optional |
| `HUGGINGFACE_TOKEN` | HuggingFace access token | Optional |
| `VLLM_API_URL` | vLLM server URL | Optional |
| `VLLM_API_KEY` | vLLM API key | Optional |
| `TURN_SERVER_URL` | WebRTC TURN server | Optional |
| `TURN_SERVER_USERNAME` | TURN username | Optional |
| `TURN_SERVER_CREDENTIAL` | TURN password | Optional |
| `VITE_DEMO_MODE` | Enable demo data (true/false) | Optional |

### Demo Mode

When `VITE_DEMO_MODE=true`, the application displays sample data for:
- Dataset catalog
- Training jobs and metrics
- Environment topology
- Quality metrics

When `VITE_DEMO_MODE=false` (production), all data comes from real backend APIs.

---

## Deployment Options

### 1. Bare Metal (INSTALL.sh)
- Direct installation on DGX Spark
- MySQL database
- Nginx reverse proxy on port 87
- Systemd service management

### 2. Docker Compose
- Containerized deployment
- MySQL container included
- NVIDIA runtime support

### 3. Manus Cloud
- Managed hosting via Manus platform
- Automatic database provisioning
- One-click publish

---

## Host Configuration

The system supports two DGX Spark hosts:

| Host | IP | Role |
|------|-----|------|
| Alpha | 192.168.50.139 | Can be LOCAL or REMOTE |
| Beta | 192.168.50.110 | Can be LOCAL or REMOTE |

The `LOCAL_HOST` environment variable determines which host runs commands locally (via `child_process.exec`) vs remotely (via SSH).

---

## Security Features

- JWT-based authentication
- SSH key authentication (preferred over password)
- Environment variable validation with Zod
- Secure credential storage
- HTTPS support via Nginx (configurable)

---

## Version History

- **V12.2** - Fixed MySQL installer with debian.cnf support
- **V12** - Critical deployment fixes (MySQL, env validation, SSH key priority)
- **V11** - Production backend APIs (datasets, training jobs)
- **V10** - Demo data separation
- **V9.2** - Consolidated hostConfig.ts
- **V9** - Unified local/remote host logic

