#!/bin/bash
# NCCL Validation Script for DGX Spark
# Verifies correct NIC selection and multi-node visibility
#
# USAGE:
#   ./nccl-validate.sh              # Run all checks
#   ./nccl-validate.sh --quick      # Quick interface check only

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

NCCL_INTERFACES="enP2p1s0f0np0 enp1s0f0np0"
EXCLUDED_INTERFACES="docker0 tailscale0 wlP9s9 lo"
NCCL_IP_PREFIX="192.168.100"

log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

check_interfaces() {
    echo "=== Check 1: NCCL Interface Verification ==="
    local errors=0
    
    for iface in $NCCL_INTERFACES; do
        if ip link show "$iface" &>/dev/null; then
            local state=$(ip link show "$iface" | grep -oP '(?<=state )\w+')
            local ip=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
            
            if [[ "$state" == "UP" ]]; then
                if [[ "$ip" == ${NCCL_IP_PREFIX}.* ]]; then
                    log_ok "$iface: UP, IP=$ip (correct subnet)"
                else
                    log_warn "$iface: UP, IP=$ip (unexpected subnet)"
                fi
            else
                log_fail "$iface: state=$state (expected UP)"
                ((errors++))
            fi
        else
            log_warn "$iface: not found"
        fi
    done
    
    return $errors
}

check_excluded() {
    echo ""
    echo "=== Check 2: Excluded Interface Verification ==="
    
    if [[ -z "${NCCL_SOCKET_IFNAME:-}" ]]; then
        log_fail "NCCL_SOCKET_IFNAME not set!"
        return 1
    fi
    
    log_ok "NCCL_SOCKET_IFNAME=${NCCL_SOCKET_IFNAME}"
    
    for excluded in $EXCLUDED_INTERFACES; do
        if echo "$NCCL_SOCKET_IFNAME" | grep -q "$excluded"; then
            log_fail "$excluded found in NCCL_SOCKET_IFNAME!"
            return 1
        fi
    done
    
    log_ok "No excluded interfaces in NCCL configuration"
    return 0
}

check_nccl_env() {
    echo ""
    echo "=== Check 3: NCCL Environment Variables ==="
    local errors=0
    
    if [[ "${NCCL_IB_DISABLE:-}" == "1" ]]; then
        log_ok "NCCL_IB_DISABLE=1 (InfiniBand disabled)"
    else
        log_warn "NCCL_IB_DISABLE not set to 1"
    fi
    
    if [[ -n "${NCCL_SOCKET_IFNAME:-}" ]]; then
        log_ok "NCCL_SOCKET_IFNAME=${NCCL_SOCKET_IFNAME}"
    else
        log_fail "NCCL_SOCKET_IFNAME not set!"
        ((errors++))
    fi
    
    return $errors
}

check_gpu() {
    echo ""
    echo "=== Check 4: GPU Verification ==="
    
    if ! command -v nvidia-smi &>/dev/null; then
        log_fail "nvidia-smi not found"
        return 1
    fi
    
    local gpu_count=$(nvidia-smi --query-gpu=count --format=csv,noheader 2>/dev/null | head -1)
    if [[ -n "$gpu_count" && "$gpu_count" -gt 0 ]]; then
        log_ok "GPU detected: $gpu_count device(s)"
        nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null
    else
        log_fail "No GPU detected"
        return 1
    fi
    
    return 0
}

main() {
    echo "=============================================="
    echo "  NCCL Validation for DGX Spark"
    echo "=============================================="
    
    local mode="${1:-full}"
    local total_errors=0
    
    case "$mode" in
        --quick)
            check_interfaces || ((total_errors++))
            check_nccl_env || ((total_errors++))
            ;;
        *)
            check_interfaces || ((total_errors++))
            check_excluded || ((total_errors++))
            check_nccl_env || ((total_errors++))
            check_gpu || ((total_errors++))
            ;;
    esac
    
    echo ""
    if [[ $total_errors -eq 0 ]]; then
        echo -e "${GREEN}All checks passed${NC}"
        return 0
    else
        echo -e "${RED}$total_errors check(s) failed${NC}"
        return 1
    fi
}

main "$@"
