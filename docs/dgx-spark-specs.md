# NVIDIA DGX Spark Official Specifications

Source: NVIDIA DGX Spark Datasheet (GTC25)

## Hardware Specifications

| Component | Specification |
|-----------|---------------|
| **GPU** | NVIDIA GB10 Grace Blackwell Superchip |
| **GPU Architecture** | NVIDIA Blackwell with 5th-gen Tensor Cores |
| **CPU** | NVIDIA Grace CPU (20-core Arm) |
| **Memory** | 128 GB unified system memory (coherent CPU+GPU) |
| **Storage** | 1 TB NVMe SSD |
| **AI Performance** | Up to 1 petaFLOP (FP4) |
| **Networking** | NVIDIA ConnectX |
| **Interconnect** | NVLink-C2C (5x PCIe Gen 5 bandwidth) |

## Model Support

- Single system: Up to 200B parameter models
- Dual system (ConnectX linked): Up to 405B parameter models (e.g., Llama 3.1 405B)

## Key Notes

- **NOT GH200**: DGX Spark uses GB10 Grace Blackwell Superchip, not GH200 Grace Hopper
- **Unified Memory**: 128GB is shared between CPU and GPU (coherent memory model)
- **Desktop Form Factor**: Compact design for desktop use
