#!/bin/bash
#===============================================================================
# NUMA & PCIe Topology Probe for DGX Spark
#
# Captures topology information critical for multi-process and multi-node
# scaling. Even on Ethernet fabric, NUMA locality affects performance.
#
# Target: gx10-alpha, gx10-beta (DGX Spark ARM64)
#===============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

HOSTNAME_SHORT=$(hostname -s)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="/tmp/dgx-topology"
REPORT_FILE="${OUTPUT_DIR}/topology-${HOSTNAME_SHORT}-${TIMESTAMP}.txt"

mkdir -p "$OUTPUT_DIR"

log_section() { echo -e "\n${GREEN}=== $1 ===${NC}"; }

main() {
    echo "=============================================="
    echo "DGX Spark Topology Probe"
    echo "Host: $(hostname)"
    echo "Time: $(date)"
    echo "=============================================="
    
    {
        echo "DGX Spark Topology Report"
        echo "========================="
        echo "Host: $(hostname)"
        echo "Date: $(date)"
        echo "Kernel: $(uname -r)"
        echo "Architecture: $(uname -m)"
        
        log_section "GPU Topology Matrix"
        nvidia-smi topo -m 2>/dev/null || echo "nvidia-smi topo not available"
        
        log_section "CPU Topology"
        lscpu 2>/dev/null | grep -E "(Architecture|CPU\(s\)|Thread|Core|Socket|NUMA|Model name)" || cat /proc/cpuinfo | head -20
        
        log_section "NUMA Topology"
        numactl --hardware 2>/dev/null || echo "numactl not installed"
        
        log_section "PCIe Topology"
        lspci 2>/dev/null | grep -i nvidia || echo "No NVIDIA devices"
        
        log_section "Network Interface NUMA Affinity"
        for iface in enP2p1s0f0np0 enp1s0f0np0; do
            if [[ -d "/sys/class/net/$iface" ]]; then
                numa_node=$(cat "/sys/class/net/$iface/device/numa_node" 2>/dev/null || echo "unknown")
                echo "$iface: NUMA node $numa_node"
            fi
        done
        
        log_section "Memory"
        free -h
        
        log_section "GPU Memory"
        nvidia-smi --query-gpu=index,name,memory.total,memory.free --format=csv 2>/dev/null || echo "nvidia-smi query failed"
        
    } | tee "$REPORT_FILE"
    
    echo ""
    echo "Report saved: $REPORT_FILE"
}

main "$@"
