# Blackwell GB10 vLLM Compatibility Fact-Check

## Summary

Your analysis is **mostly accurate** but needs some corrections and updates.

## Fact-Check Results

### 1. Compute Capability Claims

**Your Claim:** GB10 uses sm_121a compute capability
**Fact:** The GB10 uses **SM_120** (compute capability 12.0), not sm_121a. Some sources mention sm_121 for certain Blackwell variants, but the DGX Spark GB10 is SM_120.

**Your Claim:** PyTorch only supports up to sm_120
**Fact:** This was true for older PyTorch versions. **PyTorch stable releases with CUDA 12.8+ now support SM_120** (Blackwell). However, older CUDA 12.1 builds do NOT support Blackwell.

### 2. Software Support Status (As of December 2025)

**NVIDIA vLLM Release 25.09** (released December 2025) officially includes:
- ✅ **DGX Spark functional support** (explicitly listed)
- ✅ CUDA 13.0 compatibility
- ✅ RTX PRO 6000 Blackwell Server Edition support
- ✅ Jetson Thor support
- ✅ NVFP4 (4-bit) format support on Blackwell GPUs
- ✅ FP8 support on Hopper and above

### 3. The Real Issue

The problem is likely that you're using an **older vLLM container** that predates Blackwell support. The official NVIDIA vLLM 25.09+ container from NGC should work.

## Recommended Solution

**Use the official NVIDIA vLLM container from NGC:**

```bash
# Pull the latest NVIDIA vLLM container with DGX Spark support
docker pull nvcr.io/nvidia/vllm:25.09

# Or the latest available
docker pull nvcr.io/nvidia/vllm:25.11
```

This container includes:
- vLLM 0.10.1.1
- flashinfer 0.4.0
- flash-attention 2.7.4
- CUDA 13.0 support
- Native DGX Spark/GB10 support

## Alternative Options

1. **Use NVIDIA NIM** - NVIDIA Inference Microservices have better Blackwell optimization
2. **Try BF16 instead of FP8** - May avoid some kernel compilation issues
3. **Use NVFP4 format** - Native 4-bit support on Blackwell for better performance

## References

- [NVIDIA vLLM Release 25.09 Notes](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/rel-25-09.html)
- [Flash-Attention GB10 Issue #1969](https://github.com/Dao-AILab/flash-attention/issues/1969)
- [PyTorch SM_120 Support Discussion](https://discuss.pytorch.org/t/pytorch-support-for-sm-120-nvidia-geforce-rtx-5060/220941)
