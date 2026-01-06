#!/bin/bash
# NCCL Environment Configuration for DGX Spark
# Target: gx10-alpha, gx10-beta (ARM64, Ethernet fabric)
#
# USAGE:
#   source scripts/nccl-env.sh
#
# Node Identity: Sets per-node topology dumps and logs to prevent
# log blurring in multi-node runs.

# =============================================================================
# NODE IDENTITY
# =============================================================================
export NCCL_HOSTNAME="${HOSTNAME:-$(hostname -s)}"
export NCCL_LOG_DIR="${NCCL_LOG_DIR:-/tmp/nccl-logs}"
mkdir -p "$NCCL_LOG_DIR" 2>/dev/null || true

# Per-node topology dump - critical for debugging multi-node issues
export NCCL_TOPO_DUMP_FILE="${NCCL_LOG_DIR}/nccl-topo-${NCCL_HOSTNAME}.xml"
export NCCL_DEBUG_FILE="${NCCL_LOG_DIR}/nccl-debug-${NCCL_HOSTNAME}.log"

# =============================================================================
# NCCL INTERFACE BINDING (CRITICAL)
# =============================================================================
# Explicitly bind NCCL to the 192.168.100.x fabric interfaces ONLY.
# gx10-alpha: enP2p1s0f0np0 (192.168.100.14), enp1s0f0np0 (192.168.100.10)
# gx10-beta:  enP2p1s0f0np0 (192.168.100.15), enp1s0f0np0 (192.168.100.11)

export NCCL_SOCKET_IFNAME="enP2p1s0f0np0,enp1s0f0np0"

# =============================================================================
# EXCLUDED INTERFACES (DO NOT USE)
# =============================================================================
# docker0, br-*, veth* : Docker bridges (172.x.x.x)
# tailscale0           : Tailscale VPN (100.x.x.x)
# wlP9s9               : WiFi (192.168.50.x)
# lo                   : Loopback

# =============================================================================
# INFINIBAND / ROCE SETTINGS
# =============================================================================
export NCCL_IB_DISABLE=1

# =============================================================================
# NETWORK TUNING
# =============================================================================
export NCCL_SOCKET_NTHREADS=4
export NCCL_NSOCKS_PERTHREAD=4
export NCCL_NET_GDR_LEVEL=0
export NCCL_P2P_LEVEL=NVL

# =============================================================================
# DEBUG SETTINGS
# =============================================================================
export NCCL_DEBUG=WARN

# =============================================================================
# HOST CONFIGURATION
# =============================================================================
export NCCL_ALPHA_IP="192.168.100.10"
export NCCL_BETA_IP="192.168.100.11"
export MASTER_ADDR="${MASTER_ADDR:-192.168.100.10}"
export MASTER_PORT="${MASTER_PORT:-29500}"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================
nccl_validate_env() {
    echo "=== NCCL Environment Validation ==="
    echo "Host:                  ${NCCL_HOSTNAME}"
    echo "NCCL_SOCKET_IFNAME:    ${NCCL_SOCKET_IFNAME:-NOT SET}"
    echo "NCCL_IB_DISABLE:       ${NCCL_IB_DISABLE:-NOT SET}"
    echo "NCCL_TOPO_DUMP_FILE:   ${NCCL_TOPO_DUMP_FILE:-NOT SET}"
    echo "MASTER_ADDR:           ${MASTER_ADDR:-NOT SET}"
    
    for iface in $(echo "$NCCL_SOCKET_IFNAME" | tr ',' ' '); do
        if ip link show "$iface" &>/dev/null; then
            local ip=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
            echo "[OK] Interface $iface exists (IP: ${ip:-NO IP})"
        else
            echo "[WARN] Interface $iface not found"
        fi
    done
}

nccl_enable_debug() {
    export NCCL_DEBUG=INFO
    export NCCL_DEBUG_SUBSYS=NET
    echo "NCCL debug enabled. Look for: NET/Socket : Using [0]enP2p1s0f0np0"
}

nccl_disable_debug() {
    export NCCL_DEBUG=WARN
    unset NCCL_DEBUG_SUBSYS
    echo "NCCL debug disabled"
}

export -f nccl_validate_env nccl_enable_debug nccl_disable_debug

if [[ "${NCCL_ENV_QUIET:-0}" != "1" ]]; then
    echo "NCCL environment configured for DGX Spark (${NCCL_HOSTNAME})"
    echo "  Topology dump: ${NCCL_TOPO_DUMP_FILE}"
    echo "Run 'nccl_validate_env' to verify, 'nccl_enable_debug' before training"
fi
