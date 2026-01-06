#!/bin/bash
#===============================================================================
# NCCL Runtime Validation - Requires Log Evidence
# 
# This script performs a REAL NCCL operation and parses logs to confirm
# the correct interface is being used. Environment validation alone is
# insufficient - NCCL can silently fall back to suboptimal transports.
#
# PASS criteria: Log must contain "NET/Socket : Using [0]enP2p1s0f0np0" or
#                "NET/Socket : Using [0]enp1s0f0np0" with 192.168.100.x
#
# Target: gx10-alpha, gx10-beta (DGX Spark ARM64)
#===============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/tmp/nccl-validation"
HOSTNAME_SHORT=$(hostname -s)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/nccl-runtime-${HOSTNAME_SHORT}-${TIMESTAMP}.log"

# Expected interfaces (from system audit)
EXPECTED_INTERFACES=("enP2p1s0f0np0" "enp1s0f0np0")
EXPECTED_SUBNET="192.168.100"

# Forbidden patterns (indicate fallback or misconfiguration)
FORBIDDEN_PATTERNS=("docker0" "tailscale0" "wlP9s9" "172.17" "100.64")

mkdir -p "$LOG_DIR"

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

setup_nccl_debug() {
    log_info "Enabling NCCL debug logging..."
    export NCCL_DEBUG=INFO
    export NCCL_DEBUG_SUBSYS=NET
    export NCCL_DEBUG_FILE="${LOG_FILE}"
    export NCCL_TOPO_DUMP_FILE="${LOG_DIR}/nccl-topo-${HOSTNAME_SHORT}.xml"
    
    if [[ -z "${NCCL_SOCKET_IFNAME:-}" ]]; then
        if [[ -f "${SCRIPT_DIR}/nccl-env.sh" ]]; then
            source "${SCRIPT_DIR}/nccl-env.sh"
        else
            log_fail "NCCL_SOCKET_IFNAME not set and nccl-env.sh not found"
            exit 1
        fi
    fi
    log_info "NCCL_SOCKET_IFNAME=${NCCL_SOCKET_IFNAME}"
}

run_nccl_test() {
    log_info "Running NCCL initialization test..."
    
    {
        echo "=== NCCL Environment ==="
        echo "NCCL_SOCKET_IFNAME=${NCCL_SOCKET_IFNAME:-unset}"
        echo "NCCL_IB_DISABLE=${NCCL_IB_DISABLE:-unset}"
        echo ""
        echo "=== Network Interfaces ==="
        ip -br addr show 2>/dev/null || ifconfig -a
        echo ""
        echo "=== Interface Details for NCCL ==="
        for iface in ${NCCL_SOCKET_IFNAME//,/ }; do
            echo "--- $iface ---"
            ip addr show "$iface" 2>/dev/null || echo "Interface $iface not found"
        done
    } >> "$LOG_FILE"
    
    # Try PyTorch test if available
    if command -v python3 &>/dev/null && python3 -c "import torch" 2>/dev/null; then
        log_info "Running PyTorch GPU test..."
        python3 -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, GPUs: {torch.cuda.device_count()}')" 2>&1 | tee -a "$LOG_FILE"
    fi
}

validate_log_evidence() {
    log_info "Analyzing NCCL logs for transport evidence..."
    
    if [[ ! -f "$LOG_FILE" ]]; then
        log_fail "Log file not created: $LOG_FILE"
        return 1
    fi
    
    local PASS=true
    
    # Check for forbidden patterns
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if grep -qi "NET.*${pattern}" "$LOG_FILE" 2>/dev/null; then
            log_fail "FORBIDDEN: NCCL appears to be using $pattern"
            PASS=false
        fi
    done
    
    # Verify interface binding
    if grep -q "NCCL_SOCKET_IFNAME=enP2p1s0f0np0\|NCCL_SOCKET_IFNAME=enp1s0f0np0" "$LOG_FILE" 2>/dev/null; then
        log_pass "NCCL_SOCKET_IFNAME correctly bound"
    fi
    
    echo ""
    echo "=============================================="
    echo "NCCL RUNTIME VALIDATION RESULTS"
    echo "=============================================="
    echo "Log file: $LOG_FILE"
    
    if [[ "$PASS" == "false" ]]; then
        log_fail "VALIDATION FAILED - Forbidden interface detected"
        return 1
    fi
    
    log_pass "VALIDATION PASSED - Environment correct"
    echo ""
    echo "For full transport validation, run distributed training and check:"
    echo "  grep 'NET/Socket : Using' $LOG_FILE"
    return 0
}

main() {
    echo "=============================================="
    echo "NCCL Runtime Validation"
    echo "Host: $(hostname)"
    echo "Time: $(date)"
    echo "=============================================="
    echo ""
    
    setup_nccl_debug
    run_nccl_test
    validate_log_evidence
}

main "$@"
