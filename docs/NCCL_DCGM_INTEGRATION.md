# NCCL/DCGM Integration for DGX Spark

**Target Systems:** gx10-alpha, gx10-beta  
**Architecture:** ARM64 (aarch64)  
**Fabric:** Ethernet (192.168.100.x)

## Quick Start

```bash
# 1. Source NCCL environment
source scripts/nccl-env.sh

# 2. Validate configuration
make validate-dgx

# 3. Run pre-training gate (required before training)
make pre-train
```

## NCCL Configuration

### Interface Binding (CRITICAL)

```bash
export NCCL_SOCKET_IFNAME="enP2p1s0f0np0,enp1s0f0np0"
export NCCL_IB_DISABLE=1
```

| Interface | IP | Use |
|-----------|----|----|
| enP2p1s0f0np0 | 192.168.100.14/15 | NCCL ✅ |
| enp1s0f0np0 | 192.168.100.10/11 | NCCL ✅ |
| docker0 | 172.x.x.x | EXCLUDED ❌ |
| tailscale0 | 100.x.x.x | EXCLUDED ❌ |
| wlP9s9 | 192.168.50.x | EXCLUDED ❌ |

### Node Identity

Per-node logging prevents log blurring in multi-node runs:

```bash
# Automatically set when sourcing nccl-env.sh
NCCL_TOPO_DUMP_FILE=/tmp/nccl-logs/nccl-topo-$(hostname).xml
NCCL_DEBUG_FILE=/tmp/nccl-logs/nccl-debug-$(hostname).log
```

## Runtime Validation

Environment validation alone is insufficient. NCCL can silently fall back.

**Enable debug logging before training:**

```bash
source scripts/nccl-env.sh
nccl_enable_debug

# Run training
torchrun --nproc_per_node=1 --nnodes=2 train.py

# Check logs for evidence
grep "NET/Socket : Using" /tmp/nccl-logs/nccl-debug-$(hostname).log
```

**Required log evidence (PASS criteria):**
```
NET/Socket : Using [0]enP2p1s0f0np0:[192.168.100.x]
```

## DCGM Observability

DCGM metrics are available but not yet integrated into training orchestration.

### Three Export Options

1. **Prometheus**: `./scripts/dcgm-observe.sh prometheus`
2. **JSON**: `./scripts/dcgm-observe.sh json`
3. **Live**: `./scripts/dcgm-observe.sh monitor`

## Makefile Targets

```bash
make validate-dgx     # Full validation
make validate-strict  # Strict mode (warnings = errors)
make topology         # NUMA/PCIe probe
make pre-train        # Pre-training gate
make failure-test     # Failure injection tests
```

## Pre-Training Gate

**Always run before training:**

```bash
make pre-train
```

Training should NOT proceed if this gate fails.

## Failure Injection Tests

Verify validation catches misconfigurations:

```bash
make failure-test
```

## Docker Usage

```bash
./scripts/docker-nccl-run.sh -i nvcr.io/nvidia/pytorch:24.10-py3
```

## Future Integration Points

- [ ] Prometheus/Grafana dashboards
- [ ] Training job auto-injection
- [ ] Alert on GPU health degradation
