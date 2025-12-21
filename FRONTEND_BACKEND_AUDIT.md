# Frontend-Backend Connection Audit Report

## Executive Summary

This audit analyzes the connections between frontend pages and backend tRPC routers to identify gaps, disconnected features, and areas needing integration.

---

## Backend Routers Available

| Router | Endpoints | Purpose |
|--------|-----------|---------|
| `system` | Core system functions | Authentication, health |
| `auth` | `me`, `logout` | User authentication |
| `trainingData` | `getPlaybooks`, `getStats` | Training data generation |
| `rag` | `listDocuments`, `addDocument`, `deleteDocument`, `search`, `getContext`, `getStats`, `reloadDocuments` | RAG document management |
| `vllm` | `getConfig`, `healthCheck`, `chatCompletion`, `ragChatCompletion`, `listModels`, `testConnection` | vLLM inference |
| `ssh` | 75+ endpoints | Container/K8s management, SSH operations |
| `dcgm` | `getHosts`, `getMetrics`, `getAllMetrics`, `testConnection`, `getHistory`, `getDcgmMetrics` | GPU metrics |
| `containerHistory` | `recordAction`, `updateStatus`, `getHistory`, `getHistoryByHost` | Container action tracking |
| `stats` | `getInferenceStats`, `getAlerts`, `dismissAlert`, `createAlert` | Performance stats & alerts |
| `webrtc` | `createSession`, `setOffer`, `getAnswer`, `addIceCandidate`, `getIceCandidates`, `getSessionStatus`, `stopSession`, `listSessions`, `startGStreamerPipeline` | WebRTC streaming |
| `settings` | `getSettings`, `updateSettings`, `resetSettings`, `testSplunkConnection`, `sendToSplunk` | System configuration |
| `presets` | `getPresets`, `getPreset`, `createPreset`, `updatePreset`, `deletePreset`, `exportPresets`, `importPresets`, `getCategories`, `duplicatePreset` | Container presets |

---

## Frontend Pages Analysis

### ✅ Well-Connected Pages

| Page | Backend Connections | Status |
|------|---------------------|--------|
| **Dashboard** | `dcgm.getAllMetrics`, `vllm.healthCheck`, `stats.getInferenceStats`, `stats.getAlerts` | ✅ Fully connected |
| **Docker & K8s** | 37+ SSH endpoints, `presets.*` | ✅ Fully connected |
| **Interaction** | `vllm.healthCheck`, `vllm.ragChatCompletion`, `rag.getContext`, `rag.getStats` | ✅ Fully connected |
| **Knowledge Base** | `rag.*` (all endpoints) | ✅ Fully connected |
| **Statistics** | `dcgm.getAllMetrics`, `stats.getInferenceStats` | ✅ Fully connected |
| **Settings** | `settings.*`, `ssh.testConnection`, `vllm.chatCompletion`, `ssh.listAllContainers` | ✅ Fully connected |
| **Environment** | `ssh.getConnectionStatus` | ⚠️ Partial (mostly static) |

### ❌ Disconnected Pages (Frontend-Only / Static Data)

| Page | Current State | Missing Backend Integration |
|------|---------------|----------------------------|
| **Training** | Static mock data | No backend connection - uses hardcoded `TRAINING_JOB`, `LOSS_HISTORY`, `MOE_PARAMS` |
| **Data Curation** | Static mock data | No backend connection - uses hardcoded `DATASETS`, `QUALITY_METRICS` |
| **CUDA Toolkit** | Static mock data | No backend connection - uses hardcoded `hostVersionData` |
| **Holoscan** | Static mock data | No backend connection - uses hardcoded pipeline/camera data |

---

## Detailed Gap Analysis

### 1. Training Page (Fine-Tuning Studio)
**File:** `client/src/pages/Training.tsx`

**Current State:**
- Uses hardcoded `TRAINING_RECIPES`, `MOE_PARAMS`, `TRAINING_JOB`, `LOSS_HISTORY`
- No tRPC calls whatsoever
- All buttons show "Feature coming soon" toasts

**Missing Backend:**
- No training job management API
- No real-time training metrics streaming
- No NeMo framework integration
- No job queue/orchestration

**Recommended Actions:**
1. Create `trainingRouter` with job CRUD operations
2. Integrate with NeMo training scripts via SSH
3. Add WebSocket for real-time loss/metrics streaming
4. Store training history in database

---

### 2. Data Curation Page (Dataset Management)
**File:** `client/src/pages/DataCuration.tsx`

**Current State:**
- Uses hardcoded `DATASETS`, `QUALITY_METRICS`
- Has `TrainingDataGenerator` component (connected to `trainingData` router)
- Dataset browser is static

**Missing Backend:**
- No dataset listing from filesystem
- No dataset upload/download
- No quality metrics calculation
- No preprocessing pipeline execution

**Recommended Actions:**
1. Create `datasetRouter` for filesystem dataset management
2. Add SSH endpoints to list/upload datasets on DGX hosts
3. Implement quality metrics calculation
4. Connect preprocessing UI to actual scripts

---

### 3. CUDA Toolkit Page
**File:** `client/src/pages/CudaToolkit.tsx`

**Current State:**
- Uses hardcoded `hostVersionData` for CUDA/cuDNN/TensorRT versions
- NGC Catalog Browser is connected (uses `ssh.pullDockerImage`)
- HuggingFace Browser is connected (uses `ssh.downloadHFModel`)

**Missing Backend:**
- No live version detection from DGX hosts
- No CUDA toolkit installation management
- No driver update functionality

**Recommended Actions:**
1. Add `ssh.getCudaVersions` endpoint to detect installed versions
2. Parse `nvidia-smi`, `nvcc --version`, `cat /usr/local/cuda/version.txt`
3. Add version comparison logic

---

### 4. Holoscan Page (Pipeline Manager)
**File:** `client/src/pages/Holoscan.tsx`

**Current State:**
- Uses hardcoded `brioCameraConfig`, pipeline definitions
- WebRTC preview component exists but may not be fully connected
- Pipeline controls are UI-only

**Existing Backend (unused):**
- `ssh.getCameraDevices` - exists but not called
- `ssh.getHoloscanPipelines` - exists but not called
- `ssh.startHoloscanPipeline` - exists but not called
- `ssh.stopHoloscanPipeline` - exists but not called
- `webrtc.*` - exists but partially used

**Recommended Actions:**
1. Connect camera device list to `ssh.getCameraDevices`
2. Connect pipeline list to `ssh.getHoloscanPipelines`
3. Wire start/stop buttons to SSH endpoints
4. Fully integrate WebRTC streaming

---

## Unused Backend Endpoints

These endpoints exist but have no frontend consumers:

| Router | Endpoint | Purpose |
|--------|----------|---------|
| `trainingData` | `getPlaybooks`, `getStats` | Training playbook data |
| `ssh` | `getCameraDevices` | List USB cameras |
| `ssh` | `getHoloscanPipelines` | List Holoscan pipelines |
| `ssh` | `startHoloscanPipeline` | Start pipeline |
| `ssh` | `stopHoloscanPipeline` | Stop pipeline |
| `ssh` | `deployGStreamerSender` | Deploy GStreamer |
| `ssh` | `uploadGStreamerScript` | Upload scripts |
| `ssh` | `startGStreamerSender` | Start GStreamer |
| `ssh` | `stopGStreamerSender` | Stop GStreamer |
| `ssh` | `getGStreamerSenderStatus` | Check status |
| `ssh` | `deploySystemdService` | Deploy services |
| `ssh` | `controlSystemdService` | Control services |
| `ssh` | `getSystemdServiceStatus` | Service status |
| `containerHistory` | `recordAction`, `updateStatus`, `getHistory`, `getHistoryByHost` | Action history |
| `presets` | `exportPresets`, `importPresets`, `duplicatePreset` | Preset management |
| `vllm` | `listModels` | List available models |

---

## Priority Recommendations

### High Priority (Core Functionality)
1. **Connect Holoscan page to existing SSH endpoints** - Backend exists, just needs frontend wiring
2. **Add live CUDA version detection** - Simple SSH command parsing
3. **Connect Training page to NeMo** - Requires new training management router

### Medium Priority (Enhanced Features)
4. **Add dataset management backend** - File operations via SSH
5. **Implement container action history UI** - Backend exists
6. **Add preset import/export UI** - Backend exists

### Low Priority (Nice to Have)
7. **Real-time training metrics streaming** - Requires WebSocket
8. **Dataset quality metrics calculation** - Compute-intensive
9. **Driver/toolkit update management** - Complex system operations

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Frontend Pages | 14 |
| Fully Connected Pages | 7 |
| Partially Connected Pages | 3 |
| Disconnected Pages | 4 |
| Total Backend Endpoints | ~120 |
| Unused Backend Endpoints | ~20 |
| Missing Backend Features | ~10 |

