#!/bin/bash
#===============================================================================
# NCCL Interface Validation Script for DGX Spark
#
# Validates that NCCL is configured to use the correct network interfaces.
#
# Modes:
#   Normal: Warnings reported but don't cause exit failure
#   Strict (--strict): Any warning becomes a failure
#
# Target: gx10-alpha, gx10-beta (DGX Spark ARM64)
#===============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

NCCL_INTERFACES="enP2p1s0f0np0 enp1s0f0np0"
EXCLUDED_INTERFACES="docker0 tailscale0 wlP9s9 lo"
NCCL_IP_PREFIX="192.168.100"

STRICT_MODE=false
QUICK_MODE=false
for arg in "$@"; do
    case $arg in
        --strict) STRICT_MODE=true ;;
        --quick) QUICK_MODE=true ;;
    esac
done

ERRORS=0
WARNINGS=0

log_ok() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn() { 
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
    [[ "$STRICT_MODE" == "true" ]] && ((ERRORS++))
}
log_fail() { 
    echo -e "${RED}[FAIL]${NC} $1"
    ((ERRORS++))
}

check_ifname_set() {
    echo "=== Check 1: NCCL_SOCKET_IFNAME ==="
    if [[ -z "${NCCL_SOCKET_IFNAME:-}" ]]; then
        log_fail "NCCL_SOCKET_IFNAME is not set!"
        echo "       Fix: source scripts/nccl-env.sh"
        return 1
    fi
    log_ok "NCCL_SOCKET_IFNAME=${NCCL_SOCKET_IFNAME}"
}

check_no_forbidden() {
    echo ""
    echo "=== Check 2: Forbidden Interfaces ==="
    for excluded in $EXCLUDED_INTERFACES; do
        if echo "${NCCL_SOCKET_IFNAME:-}" | grep -qw "$excluded"; then
            log_fail "FORBIDDEN: $excluded in NCCL_SOCKET_IFNAME!"
            return 1
        fi
    done
    log_ok "No forbidden interfaces"
}

check_interfaces_exist() {
    echo ""
    echo "=== Check 3: Interface Existence ==="
    
    IFS=',' read -ra IFACES <<< "${NCCL_SOCKET_IFNAME:-}"
    for iface in "${IFACES[@]}"; do
        iface=$(echo "$iface" | xargs)
        if [[ ! -d "/sys/class/net/$iface" ]]; then
            log_fail "Interface $iface does not exist!"
            continue
        fi
        
        local state=$(cat "/sys/class/net/$iface/operstate" 2>/dev/null || echo "unknown")
        local ip=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo "none")
        
        if [[ "$state" != "up" ]]; then
            log_warn "Interface $iface is $state (expected: up)"
        elif [[ "$ip" != ${NCCL_IP_PREFIX}.* ]]; then
            log_warn "Interface $iface has IP $ip (expected: ${NCCL_IP_PREFIX}.x)"
        else
            log_ok "Interface $iface: UP, IP=$ip"
        fi
    done
}

check_gpu() {
    echo ""
    echo "=== Check 4: GPU ==="
    if ! command -v nvidia-smi &>/dev/null; then
        log_fail "nvidia-smi not found"
        return 1
    fi
    
    local gpu_count=$(nvidia-smi --query-gpu=count --format=csv,noheader 2>/dev/null | head -1 || echo "0")
    if [[ "$gpu_count" -gt 0 ]]; then
        log_ok "GPU detected: $gpu_count device(s)"
    else
        log_fail "No GPU detected"
    fi
}

main() {
    echo "=============================================="
    echo "  NCCL Validation for DGX Spark"
    echo "  Mode: $([ "$STRICT_MODE" == "true" ] && echo "STRICT" || echo "Normal")"
    echo "=============================================="
    echo ""
    
    check_ifname_set || true
    check_no_forbidden || true
    check_interfaces_exist || true
    [[ "$QUICK_MODE" == "false" ]] && check_gpu || true
    
    echo ""
    echo "=============================================="
    if [[ $ERRORS -eq 0 ]]; then
        echo -e "${GREEN}✓ All checks passed${NC}"
        exit 0
    else
        echo -e "${RED}✗ $ERRORS check(s) failed${NC}"
        exit 1
    fi
}

main "$@"
