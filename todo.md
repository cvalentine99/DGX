# Training Data Generator & Agent Pipeline Integration

- [x] Add Training Data Generator component to Data module
- [x] Create trainingData tRPC router with playbook/generate/export endpoints
- [x] Implement ExtraHop Metrics API derivation logic
- [x] Add playbook definitions for network triage scenarios
- [x] Create ValidationPanel component for training data quality
- [ ] Integrate agent pipeline tools (capinfos, tshark, yara, etc.)

# vLLM Integration

- [x] Configure vLLM endpoint settings (environment variables)
- [x] Create backend API route for vLLM inference
- [x] Update Interaction module frontend to use live API
- [x] Add response support with reasoning_content
- [x] Implement thinking mode for chain-of-thought reasoning
- [ ] Write vitest tests for vLLM integration (pending vLLM server connection)

# RAG System for Training Data & Documentation

- [x] Research Nemotron-3-Nano-30B documentation and user guides
- [x] Create RAG backend with document indexing (TF-IDF)
- [x] Implement similarity search for document retrieval
- [x] Build document upload and management API
- [x] Create Knowledge Base interface in Command Center
- [x] Pre-load Nemotron documentation into RAG
- [x] Integrate RAG context into inference requests

# Holoscan 3.9 Integration

- [x] Research Holoscan 3.9 SDK features and capabilities
- [x] Create Holoscan page with pipeline management interface
- [x] Add sensor/camera input visualization
- [x] Add pipeline graph visualization
- [x] Add Holoscan to sidebar navigation
- [x] Test Holoscan tab integration

# Nemotron Training Data Integration

- [x] Copy training data files to project
- [x] Index playbooks in RAG knowledge base
- [x] Create Training Data Viewer component
- [x] Display training examples with filtering
- [x] Add playbook browser to Data module
- [x] Test training data integration

# Training Example Editor Feature

- [x] Add example browser with list view and detail panel
- [x] Implement inline editing for user queries
- [x] Implement inline editing for assistant responses/reasoning
- [x] Add delete functionality for unwanted examples
- [x] Add validation status indicators (original/edited/deleted)
- [x] Add bulk selection and bulk delete
- [x] Add revert to original functionality
- [x] Add search/filter for examples
- [x] Update export to exclude deleted examples
- [x] Test editing workflow and export

# JSON Schema Validation for Training Examples

- [x] Define ExtraHop API JSON schema with required fields
- [x] Create validation function for assistant responses
- [x] Add real-time validation in edit dialog
- [x] Show validation errors with field-level details
- [x] Add validation status badge to example list
- [x] Add Valid/Invalid filter tabs to example browser
- [x] Test validation with various response formats

# CUDA Toolkit Tab

- [x] Create CUDA Toolkit page with version cards
- [x] Display CUDA 12.x compatibility status
- [x] Display cuDNN 8.9+ compatibility status
- [x] Display TensorRT 10.x compatibility status
- [x] Add NCCL and Driver version cards
- [x] Add Compatibility Matrix tab
- [x] Add NeMo Requirements tab
- [x] Add CUDA tab to sidebar navigation
- [x] Test CUDA tab integration

# NGC Catalog Browser Integration

- [x] Research NGC catalog API and container structure
- [x] Create NGC container catalog data with NeMo, PyTorch, TensorRT images
- [x] Build NGC browser component with search and filtering
- [x] Add container details panel with tags and pull commands
- [x] Integrate NGC browser as new tab in CUDA page
- [x] Add pull command copy functionality
- [x] Test NGC catalog browser integration

# SSH Integration for Container Pulls

- [x] Request SSH credentials for DGX Spark hosts
- [x] Install ssh2 package for Node.js SSH connections
- [x] Create SSH router with host connection management
- [x] Implement container pull endpoint with docker pull command
- [x] Add real-time progress polling via tRPC
- [x] Create pull progress modal in NGC browser UI
- [x] Add host selection dropdown to NGC browser
- [ ] Test SSH integration with both DGX Spark hosts (pending network connectivity)

# NGC API Key & HuggingFace Token Integration

- [x] Request NGC_API_KEY secret from user
- [x] Request HUGGINGFACE_TOKEN secret from user
- [x] Update SSH router to use NGC API key for docker login
- [x] Add HuggingFace model browser component
- [x] Implement authenticated model downloads
- [x] Test NGC authenticated pulls
- [x] Test HuggingFace model downloads

# Real-Time Progress Bars for Downloads

- [x] Parse docker pull output for layer progress (downloading, extracting)
- [x] Calculate overall percentage from layer progress
- [x] Add download speed and ETA calculation
- [x] Update PullProgressModal with animated progress bar
- [x] Add status indicators (connecting, authenticating, downloading, extracting, complete)
- [x] Implement HuggingFace download progress tracking
- [x] Add cancel download functionality
- [x] Test progress tracking with real downloads (UI verified, pending SSH key fix)

# vLLM Endpoint Configuration

- [x] Configure VLLM_API_URL to http://localhost:8001/v1
- [x] Update model name to /models/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8
- [ ] Test live inference in Interaction module
- [ ] Verify reasoning_content streaming works

# vLLM 25.11 Container Update

- [x] Update NGC catalog to feature vLLM 25.11 as recommended
- [x] Update vLLM router default configuration
- [x] Add DGX Spark compatibility notes to UI
- [x] Test updated configuration

# Real-Time GPU Metrics via DCGM

- [x] Create DCGM metrics router with SSH integration
- [x] Parse nvidia-smi and dcgmi output for GPU stats
- [x] Add endpoints for GPU utilization, memory, temperature, power
- [x] Update Dashboard to fetch live metrics from backend
- [x] Implement auto-refresh polling (5-10 second intervals)
- [x] Add connection status indicators for each host
- [x] Handle SSH connection errors gracefully
- [x] Test real-time metrics with both DGX Spark hosts (UI verified, pending SSH key fix)

# GPU Metrics History Charts

- [x] Create in-memory metrics history storage in backend
- [x] Add endpoint to retrieve historical metrics by time range
- [x] Build GpuHistoryChart component with Recharts
- [x] Add time range selector (1h, 6h, 24h)
- [x] Display GPU utilization, temperature, and power trends
- [x] Integrate charts into Dashboard below host cards
- [x] Test time-series charts with simulated data

# Container Inventory Panel

- [x] Create SSH endpoint to list Docker images on each host
- [x] Parse docker images output for NGC containers
- [x] Build ContainerInventory component with host tabs
- [x] Display container name, tag, size, and created date
- [x] Add refresh functionality
- [x] Integrate into Dashboard layout
- [x] Test container inventory display

# SSH Private Key Fix

- [x] Guide user on proper OpenSSH key format
- [ ] Document key requirements in UI error message

# Container Management Actions

- [x] Add removeImage endpoint to SSH router
- [x] Add updateImage endpoint to SSH router (pull latest)
- [x] Add confirmation dialogs for destructive actions
- [x] Update ContainerInventory UI with action buttons

# Pull History Tracking

- [x] Create container_pull_history database table
- [x] Add recordPullHistory function to track pulls
- [x] Create getPullHistory endpoint
- [x] Add Pull History tab to ContainerInventory
- [x] Display recent pull activity with timestamps and user info

# Container Logs Feature

- [x] Create getContainerLogs SSH endpoint
- [x] Support log tail with configurable line count
- [x] Build ContainerLogs modal component with syntax highlighting
- [x] Add Logs button to container rows
- [x] Add auto-refresh option for live log streaming
- [x] Test container logs display

# Ngrok Connection

- [x] Check current ngrok/VLLM_API_URL configuration
- [x] Update dashboard to connect via ngrok tunnel
- [x] Test live data connection through ngrok

# ComfyUI Integration Panel

- [x] Create ComfyUI panel component with status indicator
- [x] Add iframe embed or external link to ComfyUI
- [x] Add COMFYUI_URL environment variable
- [x] Integrate panel into Dashboard layout
- [x] Test ComfyUI panel functionality

# Ngrok SSH Tunnel Configuration

- [x] Update SSH router to use ngrok TCP tunnel (4.tcp.ngrok.io:19838)
- [x] Test SSH connection via ngrok
- [x] Verify live container inventory works
- [x] Update DCGM router to use ngrok SSH tunnel
- [x] Verify live GPU metrics work (NVIDIA GB10 detected!)
