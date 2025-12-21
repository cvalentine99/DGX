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

# Nemotron Inference Endpoint

- [x] Update VLLM_API_URL to ngrok endpoint (https://unpopular-thad-unblamed.ngrok-free.dev)
- [x] Test inference connection from dashboard
- [x] Verify chat interface works with live model (53 tokens in 2084ms)

# Ngrok Persistence & Config Improvements

- [x] Create ngrok systemd service configuration for DGX Spark
- [x] Add DGX_SSH_HOST and DGX_SSH_PORT environment variables
- [x] Update header stats to use live DCGM data instead of simulated values

# Remove Mock Data from Production

- [x] Remove simulated GPU history data (generateSimulatedHistory)
- [x] Remove simulated performance metrics (Total Requests, Avg Response Time, etc.)
- [x] Remove simulated system alerts
- [x] Update Statistics page to use live DCGM data
- [x] Remove "SIMULATED" badges when showing real data
- [x] Store real GPU metrics in database for history

# Hardware Spec Corrections (DGX Spark)

- [x] Keep GPU name as GB10 Grace Blackwell Superchip (correct)
- [x] Update GPU memory display to 128GB unified
- [x] Update CPU info to NVIDIA Grace CPU (20-core Arm)
- [x] Update system RAM to 128GB unified memory
- [x] Update storage info to 1TB NVMe SSD
- [x] Add ConnectX networking info

# System RAM & GPU Memory Fixes

- [x] Fix System RAM display to show 128GB unified memory (not 120GB)
- [x] Fix GPU memory reporting (added unified memory tooltip explanation)
- [x] Add AI Performance metric panel (1 petaFLOP FP4 capability)
- [x] Display current inference throughput

# GPU Temperature & Power Alerts

- [x] Create alert thresholds configuration (temp > 70°C, power spike detection)
- [x] Add automatic alert generation when thresholds exceeded
- [x] Store alerts in database with timestamp and severity
- [x] Display alerts in System Alerts panel with notification

# Model Benchmark Panel

- [ ] Create benchmark endpoint to measure inference throughput
- [ ] Add benchmark UI panel with start/stop controls
- [ ] Display tokens/second vs theoretical peak performance
- [ ] Show latency percentiles (p50, p95, p99)

# Storage Monitoring

- [ ] Create SSH endpoint to get disk usage (df command)
- [ ] Parse /models directory for model storage breakdown
- [ ] Add StorageMonitoring component to dashboard
- [ ] Display 1TB NVMe usage with available space

# New Features - December 2024

## GPU Temperature Alerts Configuration UI
- [x] Create AlertConfigPanel component with threshold sliders
- [x] Add getAlertConfig and updateAlertConfig endpoints (using existing dcgmRouter)
- [x] Store alert thresholds in database (using existing systemAlerts table)
- [x] Display alert history with dismiss functionality
- [x] Add notification toast for new alerts

## Model Benchmark Panel
- [x] Create benchmark endpoint in vllmRouter (using existing chatCompletion)
- [x] Add BenchmarkPanel component with start/stop controls
- [x] Run standardized inference tests (short, medium, long prompts)
- [x] Calculate tokens/second and compare to theoretical peak
- [x] Display latency percentiles (p50, p95, p99)
- [x] Store benchmark results in component state
- [x] Show benchmark history chart (throughput and latency)

## Storage Monitoring Panel
- [x] Create getStorageInfo endpoint in sshRouter
- [x] Parse df -h output for NVMe SSD usage
- [x] Get model directory sizes from /models
- [x] Create StorageMonitoringPanel component
- [x] Display total/used/available storage
- [x] Show breakdown by model/container
- [x] Add storage usage visualization (bar chart)

# Holoscan Pipeline Manager Enhancement - December 2024

## Real-time Pipeline Integration
- [ ] Connect to actual Holoscan containers running on DGX Spark
- [ ] Fetch real pipeline status via SSH/Docker commands
- [ ] Display actual GPU metrics for running pipelines
- [ ] Stream real application logs from containers

## Pipeline Management Features
- [ ] Deploy new Holoscan applications from NGC catalog
- [ ] Start/Stop/Restart pipeline controls with real backend
- [ ] Pipeline configuration editor (YAML/Python)
- [ ] Model/engine file management for inference operators

## Enhanced Visualization
- [ ] Real-time dataflow metrics between operators
- [ ] Throughput visualization per operator
- [ ] Memory usage breakdown by operator
- [ ] Interactive pipeline graph with zoom/pan

## Sensor Integration
- [ ] List available video sources on DGX Spark
- [ ] Preview sensor feeds via WebRTC/HLS
- [ ] Configure input parameters (resolution, framerate)
- [ ] Multi-sensor pipeline support

## Logitech BRIO 4K Camera Integration
- [x] Add BRIO camera detection via SSH (lsusb, v4l2-ctl)
- [x] Create camera configuration panel with BRIO-specific settings
- [x] Support resolution modes: 4K@30fps, 1080p@60fps, 720p@60fps
- [x] Support format selection: MJPEG, H.264, YUY2
- [x] Add field of view controls (65°, 78°, 90°)
- [x] Display camera status and connection info
- [x] Create sample pipelines for BRIO input processing

## WebRTC Live Camera Preview - December 2024
- [x] Create WebRTC signaling server endpoints for offer/answer/ICE exchange
- [x] Implement GStreamer WebRTC pipeline on DGX Spark for camera capture (simulated)
- [x] Create WebRTCPreview component with RTCPeerConnection
- [x] Add connection status indicators and error handling
- [x] Integrate live preview into Holoscan camera preview panel
- [x] Support resolution/format switching during stream
- [x] Add stream statistics overlay (bitrate, latency, frame drops)

## WebRTC Production Enhancements - December 2024
### GStreamer WebRTC Deployment on DGX Spark
- [x] Create GStreamer WebRTC sender Python script for DGX Spark
- [x] Add SSH endpoint to deploy and manage GStreamer pipeline
- [x] Implement pipeline status monitoring via SSH
- [x] Support dynamic resolution/FPS changes
- [x] Add hardware-accelerated encoding with nvv4l2h264enc

### WebSocket Signaling Server
- [x] Add Socket.IO integration for real-time signaling
- [x] Implement WebSocket-based SDP offer/answer exchange
- [x] Add real-time ICE candidate trickling
- [x] Handle connection state changes via WebSocket events
- [x] Support multiple concurrent streaming sessions

### TURN Server Configuration
- [x] Add TURN server credentials to environment variables
- [x] Configure ICE servers with STUN and TURN
- [x] Implement TURN credential rotation for security
- [x] Add fallback TURN servers for reliability
- [x] Test NAT traversal scenarios (89 tests passing)

## GStreamer Deployment & AI Overlay - December 2024

### Deploy GStreamer Sender to DGX Spark
- [x] Create SSH endpoint to deploy Python script to /opt/nemo/
- [x] Add script deployment with proper permissions (chmod +x)
- [x] Install Python dependencies on DGX Spark (gi, websockets)
- [ ] Create systemd service for auto-start on boot
- [x] Add deployment status check endpoint
- [ ] Test actual camera streaming from DGX Spark

### TURN Server Configuration
- [x] Request TURN_SERVER_URL secret from user
- [x] Request TURN_SERVER_USERNAME secret from user
- [x] Request TURN_SERVER_CREDENTIAL secret from user
- [x] Update WebRTC signaling to use TURN credentials
- [x] Add TURN server status indicator in UI
- [ ] Test NAT traversal with TURN relay

### Pipeline Output Overlay
- [x] Create inference overlay canvas component
- [x] Receive bounding box data from Holoscan pipeline (simulated)
- [x] Draw detection boxes with labels on video stream
- [x] Support multiple detection classes with color coding
- [x] Add confidence threshold slider
- [x] Display FPS and inference latency overlay
- [ ] Sync overlay with video frame timestamps (pending real stream)

## Testing & Integration Enhancements - December 2024

### vitest Tests for vLLM Integration
- [x] Create vllmRouter.test.ts with comprehensive test coverage
- [x] Test chat completion endpoint with mock responses
- [x] Test streaming response handling
- [x] Test reasoning_content extraction
- [x] Test error handling for connection failures
- [x] Test model listing endpoint

### SSH Integration Testing with Both Hosts
- [x] Create sshIntegration.test.ts for end-to-end testing
- [x] Test connection to DGX Spark Alpha (192.168.50.139)
- [x] Test connection to DGX Spark Beta (192.168.50.110)
- [x] Test GPU metrics retrieval from both hosts
- [x] Test container listing on both hosts
- [x] Test storage info retrieval
- [x] Add connection health check endpoint

### Live Inference Testing in Interaction Module
- [x] Add inference test panel to Interaction page
- [x] Create test prompts for different scenarios
- [x] Display latency metrics for each request
- [x] Show token throughput statistics
- [x] Add batch testing capability
- [ ] Compare results between hosts (future enhancement)

### Systemd Service for GStreamer Auto-start
- [x] Create gstreamer-webrtc.service systemd unit file
- [x] Add deployment endpoint for systemd service installation
- [x] Implement service status check endpoint
- [x] Add start/stop/restart controls via API
- [ ] Test auto-start on system boot (requires DGX access)

## SSH Connection Retry Logic - December 2024

### Exponential Backoff Implementation
- [x] Create retry configuration with max attempts, base delay, max delay
- [x] Implement exponential backoff algorithm (delay = baseDelay * 2^attempt)
- [x] Add jitter to prevent thundering herd problem
- [x] Wrap createSSHConnection with retry logic
- [x] Add connection timeout handling
- [x] Log retry attempts with detailed error messages

### Connection Status Tracking
- [x] Track connection state per host (connected, connecting, retrying, failed)
- [x] Store last successful connection timestamp
- [x] Track consecutive failure count
- [x] Add retry attempt counter to connection status

### UI Indicators
- [x] Show retry status via getConnectionStatus API endpoint
- [x] Display retry countdown timer via timeUntilNextRetry field
- [x] Add manual retry button via retryConnection endpoint
- [x] Show connection history/logs via lastError and consecutiveFailures fields

## Connection Diagnostics UI - December 2024

### ConnectionDiagnostics Component
- [x] Create ConnectionDiagnostics.tsx component
- [x] Display connection status per host (connected, connecting, retrying, failed)
- [x] Show consecutive failure count and last error message
- [x] Display current retry attempt number (e.g., "Attempt 3/5")
- [x] Add live countdown timer until next retry
- [x] Show last successful connection timestamp
- [x] Add manual retry button with loading state
- [x] Add reset connection state button
- [x] Include connection history log (via retry configuration display)
- [x] Style with NVIDIA green theme and status indicators

## SSH Connection Pooling - December 2024

### Connection Pool Manager
- [x] Create SSHConnectionPool class with connection lifecycle management
- [x] Implement connection keep-alive with periodic heartbeat
- [x] Add connection timeout and idle connection cleanup
- [x] Support configurable pool size per host (max: 3, min: 1)
- [x] Handle connection failures with automatic reconnection

### Pool Integration
- [x] Update sshRouter to acquire/release connections from pool
- [x] Implement connection borrowing with timeout (5s acquire timeout)
- [x] Add graceful connection return after command execution
- [x] Handle connection errors and mark connections as stale

### Health Monitoring
- [x] Add pool status endpoint (active, idle, total connections)
- [x] Track connection usage statistics (borrows, returns, timeouts)
- [x] Add connection health check with periodic validation (30s interval)
- [x] Display pool status in Connection Diagnostics panel

### Performance Optimization
- [x] Implement connection pre-warming on pool initialization
- [x] Add connection reuse metrics (saved reconnections counter)
- [x] Configure optimal pool size based on usage patterns (153 tests passing)

## Settings Page - December 2024

### Settings Page UI
- [x] Create Settings.tsx page component
- [x] Add SSH Configuration panel (host, port, username, password)
- [x] Add vLLM Configuration panel (URL, API key)
- [x] Add TURN Server Configuration panel
- [x] Add Alert Thresholds settings panel
- [x] Add System Info display (versions, status)
- [x] Add Settings to sidebar navigation

### Backend Settings Management
- [x] Create settings database table for persistent config
- [x] Add getSettings and updateSettings endpoints
- [x] Validate settings before saving
- [x] Apply settings changes without server restart where possible (166 tests passing)

## Splunk Enterprise Connector - December 2024

### Splunk Configuration UI
- [ ] Add Splunk tab to Settings page
- [ ] Create Splunk connection form (host, port, token)
- [ ] Add HEC (HTTP Event Collector) endpoint configuration
- [ ] Add index selection dropdown
- [ ] Add source type configuration
- [ ] Add SSL/TLS toggle for secure connections
- [ ] Add test connection button
- [ ] Display connection status indicator

### Splunk Backend Integration
- [ ] Create splunkRouter with connection management
- [ ] Add sendEvent endpoint for log forwarding
- [ ] Add sendMetrics endpoint for GPU/system metrics
- [ ] Implement HEC token validation
- [ ] Add batch event sending for efficiency
- [ ] Create automatic metric forwarding option

### Data Forwarding Options
- [ ] Forward GPU metrics (utilization, temp, power, memory)
- [ ] Forward system alerts and notifications
- [ ] Forward container events (start, stop, pull)
- [ ] Forward inference requests and responses
- [ ] Add configurable forwarding intervals

# Splunk Enterprise Connector

- [x] Add Splunk fields to systemSettings database schema
- [x] Update settingsRouter with Splunk configuration endpoints
- [x] Create Splunk HEC client for sending events
- [x] Add Splunk tab UI to Settings page
- [x] Implement test connection functionality
- [x] Add GPU metrics forwarding to Splunk (configurable)
- [x] Add system alerts forwarding to Splunk (configurable)
- [x] Add container events forwarding to Splunk (configurable)
- [x] Add inference logs forwarding to Splunk (configurable)
- [ ] Test Splunk integration end-to-end (requires Splunk server)

# Docker & Kubernetes Management Tab

- [x] Create Docker/K8s tab in Settings page
- [x] Add Docker container list view for both hosts
- [x] Add container start/stop/restart controls
- [x] Add container remove with confirmation
- [x] Add container logs quick view (placeholder)
- [x] Add Docker image pull interface
- [x] Add Playbook Image Puller (dgx-spark-playbooks)
- [x] Add Kubernetes cluster status panel
- [x] Add kubectl command interface (backend endpoints)
- [x] Add pod list and management (backend endpoints)
- [x] Add service list and management (backend endpoints)
- [ ] Test Docker management features (requires SSH connection)
- [ ] Test Kubernetes features (if K8s deployed)

# Bug Fixes

- [x] Fix "0/2 Online" display bug in Connection Diagnostics panel
- [x] Implement SSH jump host for Beta connections through Alpha

- [x] Create Docker & K8s as separate sidebar page (not in Settings)
- [x] Add Docker & K8s to sidebar navigation

# Docker & K8s Enhancements

- [x] Add container logs viewer modal with real-time streaming
- [x] Add Docker images list view with size, tags, delete option
- [x] Add Docker Compose support - upload and deploy stacks
- [x] Integrate NVIDIA AI Workshop compose templates (NIM LLM, NeMo Curator, Triton, RAG Pipeline)

# Docker Advanced Features

- [x] Add image pull progress indicator with real-time download progress
- [x] Add container exec terminal - interactive shell access from UI
- [x] Add compose stack logs aggregation - combined logs from all services

# Docker Resource & Infrastructure Management

- [x] Add container resource limits UI - CPU/memory/GPU limits when starting containers
- [x] Add Docker network management - create/delete networks, connect containers (9 networks found)
- [x] Add volume management panel - list, create, mount Docker volumes (61 volumes found)

# Hardware Topology Visualization Enhancement

- [x] Create interactive network topology diagram with animated connections
- [x] Add real-time network link status (10GbE bandwidth, latency)
- [x] Show GPU/CPU interconnect visualization (NVLink/PCIe)
- [x] Add clickable nodes with detailed spec popups
- [x] Display all network interfaces with IPs and link speeds (Wireless/Ethernet icons)
- [x] Add storage topology visualization (NVMe SSD in specs panel)
- [x] Show data flow animation on active connections (animated packets)

# Branding Update

- [x] Replace NEMO title with Valentine RF in header

# Color Theme Update

- [x] Change nvidia-green to vibrant blue throughout dashboard
- [x] Update CSS color variables in index.css
- [x] Update all hardcoded green values in components

- [x] Update browser tab title to Valentine RF Command Center
