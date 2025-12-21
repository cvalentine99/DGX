# NVIDIA AI Workbench Deployment Guide

## Key Concepts from AI Workbench

NVIDIA AI Workbench is a platform for managing AI projects with containerized development environments. Key features:

1. **Single Container per Project** - Each project runs in one container built from a base image
2. **Docker Compose Support** - Multi-container applications via `compose.yaml`
3. **Remote Locations** - Deploy to remote systems via SSH (DGX Spark hosts)
4. **GPU Access** - Automatic NVIDIA Container Toolkit configuration

## Required Configuration Files

### spec.yaml
Main project configuration file that AI Workbench uses to manage the container lifecycle.

### compose.yaml
For multi-container applications - AI Workbench auto-detects and uses this file.

### Package Management
- `requirements.txt` - Python packages (pip)
- `apt.txt` - Debian packages (apt-get)
- `environment.yml` - Conda environments
- `.env` - Environment variables

### Custom Scripts
- `preBuild.bash` - Runs before container build
- `postBuild.bash` - Runs after container build

## Docker Labels for Custom Images

Required labels (com.nvidia.workbench.*):
- `com.nvidia.workbench.application.name`
- `com.nvidia.workbench.application.version`
- Other metadata labels for package managers, CUDA version, etc.

## Deployment Strategy for NeMo Command Center

### Option 1: AI Workbench Deployment (Containerized)
- Create `compose.yaml` with services: web app, database, SSH proxy
- Use NVIDIA base images from NGC
- Configure GPU access for ML workloads
- Deploy via AI Workbench to remote DGX locations

### Option 2: Bare Metal Deployment
- Direct installation on DGX Spark hosts
- systemd services for process management
- Direct GPU access without container overhead
- Better for production workloads requiring maximum performance
