# NVIDIA Holoscan SDK 3.9 Research

## Overview

NVIDIA Holoscan is an AI sensor processing platform that combines hardware systems for low-latency sensor and network connectivity. The SDK simplifies development of sensor processing pipelines using a modular architecture.

## Core Concepts

### Application Structure
- **Application**: Top-level container that acquires and processes streaming data. Composed of Fragments.
- **Fragment**: Building block of the application. A directed graph of operators that can be assigned to a physical node.
- **Operator**: The most basic unit of work. Receives streaming data at input ports, processes it, and publishes to output ports.

### Key Components
- **Resource**: System memory or GPU memory pool that operators need (Memory Allocator)
- **Condition**: Predicate evaluated at runtime to determine if an operator should execute
- **Port**: Interaction point between operators (Input/Output)
- **Message**: Generic data object for operator communication
- **Executor**: Manages execution of a fragment on a physical node
- **Scheduler**: Controls operator execution order

## Pipeline Architecture
```
Application
├── Fragment 1
│   ├── Operator 1 → Operator 2 → Operator 3A
│   └──────────────────────────────────────────→ Operator 4
└── Fragment 2
    └── Operator 5 → Operator 6
```

## Key Features for UI

### Pipeline Management
- View running applications and fragments
- Monitor operator status and data flow
- Visualize pipeline graph (DAG)

### Sensor Input
- Camera/video feed visualization
- Sensor data streams
- Input source configuration

### Performance Monitoring
- Data flow tracking
- Frame-level profiling
- Latency metrics
- GPU utilization

### Built-in Operators
- Video stream operators
- Inference operators (TensorRT, ONNX)
- Visualization operators (HoloViz)
- Format conversion operators

## UI Components for Command Center

1. **Pipeline Graph View** - Interactive DAG visualization
2. **Operator Status Panel** - Real-time operator metrics
3. **Sensor Input Preview** - Live camera/video feeds
4. **Performance Dashboard** - Latency, throughput, GPU stats
5. **Application Logs** - Real-time logging output
6. **Configuration Panel** - YAML config editor

## Integration Points

- REST API for application management
- WebSocket for real-time metrics
- GXF backend for execution
- CUDA streams for GPU processing
