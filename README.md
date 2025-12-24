# NeMo Command Center

GPU infrastructure management platform for NVIDIA DGX Spark systems. Provides real-time monitoring, container management, AI model deployment, and Holoscan pipeline orchestration.

## Features

- **Dashboard**: Real-time GPU metrics via DCGM/nvidia-smi
- **Docker Management**: Full container/image/network/volume lifecycle
- **Holoscan Pipelines**: Camera detection, pipeline deployment, WebRTC preview
- **vLLM Integration**: Chat with deployed LLM models
- **Training Studio**: Fine-tuning job management
- **Data Curation**: File browser, dataset management
- **Knowledge Base**: RAG document management

## Quick Start

### Bare Metal Installation

```bash
# On DGX Spark
sudo ./INSTALL.sh
```

### Docker Compose

```bash
docker compose up -d
```

## Architecture

- **Frontend**: React 19 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Node.js + tRPC + Drizzle ORM
- **Database**: MySQL 8.0
- **Runtime**: Supports local execution (Beta) and SSH to remote hosts (Alpha)

## Documentation

- [FEATURES.md](FEATURES.md) - Complete feature list
- [INSTALL.sh](INSTALL.sh) - Installation script
- [todo.md](todo.md) - Development progress

## License

Proprietary - NVIDIA DGX Spark Development
