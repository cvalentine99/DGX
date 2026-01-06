#!/bin/bash
#===============================================================================
# NCCL Failure Injection Tests
#
# Validates that the system DETECTS misconfigurations rather than silently
# producing wrong results.
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
TESTS_PASSED=0
TESTS_FAILED=0

log_test() { echo -e "${YELLOW}[TEST]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }

# Save original environment
ORIG_NCCL_SOCKET_IFNAME="${NCCL_SOCKET_IFNAME:-}"

restore_env() {
    if [[ -n "$ORIG_NCCL_SOCKET_IFNAME" ]]; then
        export NCCL_SOCKET_IFNAME="$ORIG_NCCL_SOCKET_IFNAME"
    else
        unset NCCL_SOCKET_IFNAME 2>/dev/null || true
    fi
}

trap restore_env EXIT

# Test 1: Unset NCCL_SOCKET_IFNAME should fail
test_unset_ifname() {
    log_test "Unset NCCL_SOCKET_IFNAME"
    unset NCCL_SOCKET_IFNAME 2>/dev/null || true
    
    if "${SCRIPT_DIR}/nccl-validate.sh" --strict 2>&1 | grep -q "FAIL"; then
        log_pass "Correctly detected missing NCCL_SOCKET_IFNAME"
    else
        log_fail "Should have failed with unset NCCL_SOCKET_IFNAME"
    fi
}

# Test 2: docker0 interface should fail
test_docker_interface() {
    log_test "docker0 interface (forbidden)"
    export NCCL_SOCKET_IFNAME="docker0"
    
    if "${SCRIPT_DIR}/nccl-validate.sh" 2>&1 | grep -q "FAIL\|FORBIDDEN"; then
        log_pass "Correctly rejected docker0"
    else
        log_fail "Should have rejected docker0"
    fi
}

# Test 3: Correct config should pass
test_correct_config() {
    log_test "Correct configuration"
    source "${SCRIPT_DIR}/nccl-env.sh" 2>/dev/null || true
    
    if "${SCRIPT_DIR}/nccl-validate.sh" 2>&1 | grep -q "passed\|PASS"; then
        log_pass "Correct configuration accepted"
    else
        log_fail "Correct configuration should pass"
    fi
}

main() {
    echo "=============================================="
    echo "NCCL Failure Injection Tests"
    echo "=============================================="
    echo ""
    
    test_unset_ifname
    restore_env
    
    test_docker_interface
    restore_env
    
    test_correct_config
    restore_env
    
    echo ""
    echo "=============================================="
    echo "Results: $TESTS_PASSED passed, $TESTS_FAILED failed"
    echo "=============================================="
    
    [[ $TESTS_FAILED -eq 0 ]]
}

main "$@"
