#!/bin/bash
# DCGM Setup and Management Script for DGX Spark
#
# USAGE:
#   ./dcgm-setup.sh install     # Install DCGM service
#   ./dcgm-setup.sh start       # Start DCGM
#   ./dcgm-setup.sh status      # Check DCGM status
#   ./dcgm-setup.sh health      # Run health diagnostics
#   ./dcgm-setup.sh metrics     # Show live metrics

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

install_dcgm() {
    echo "=== Installing DCGM Service ==="
    
    if ! command -v dcgmi &>/dev/null; then
        log_fail "DCGM not installed. Install via: sudo apt-get install datacenter-gpu-manager"
        return 1
    fi
    log_ok "DCGM binaries found"
    
    sudo tee /etc/systemd/system/nv-hostengine.service > /dev/null << 'EOF'
[Unit]
Description=NVIDIA DCGM Host Engine
After=nvidia-persistenced.service

[Service]
Type=forking
ExecStart=/usr/bin/nv-hostengine -n
ExecStop=/usr/bin/nv-hostengine --term
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable nv-hostengine
    log_ok "Service installed and enabled"
}

start_dcgm() {
    echo "=== Starting DCGM ==="
    
    if systemctl is-active --quiet nv-hostengine 2>/dev/null; then
        log_ok "DCGM already running"
        return 0
    fi
    
    if systemctl list-unit-files | grep -q nv-hostengine; then
        sudo systemctl start nv-hostengine
        sleep 2
        if systemctl is-active --quiet nv-hostengine; then
            log_ok "DCGM started via systemd"
            return 0
        fi
    fi
    
    sudo nv-hostengine -n &
    sleep 2
    
    if pgrep -x nv-hostengine &>/dev/null; then
        log_ok "DCGM started directly"
    else
        log_fail "Failed to start DCGM"
        return 1
    fi
}

check_status() {
    echo "=== DCGM Status ==="
    
    if pgrep -x nv-hostengine &>/dev/null; then
        log_ok "nv-hostengine process running"
    else
        log_fail "nv-hostengine not running"
        return 1
    fi
    
    if dcgmi discovery -l &>/dev/null; then
        log_ok "dcgmi can connect to host engine"
        echo ""
        dcgmi discovery -l
    else
        log_fail "dcgmi cannot connect to host engine"
        return 1
    fi
}

run_health_check() {
    echo "=== DCGM Health Diagnostics ==="
    
    if ! pgrep -x nv-hostengine &>/dev/null; then
        log_warn "DCGM not running, starting..."
        start_dcgm
    fi
    
    echo ""
    echo "=== Quick Health Check (Level 1) ==="
    dcgmi diag -r 1
    
    echo ""
    echo "=== GPU Information ==="
    dcgmi discovery -l
}

show_metrics() {
    echo "=== DCGM Live Metrics ==="
    echo "Press Ctrl+C to stop"
    
    if ! pgrep -x nv-hostengine &>/dev/null; then
        start_dcgm
    fi
    
    # Fields: SM_CLK, MEM_CLK, TEMP, POWER, GPU_UTIL, MEM_UTIL
    dcgmi dmon -e 155,156,203,204,1001,1005 -d 1000
}

main() {
    local cmd="${1:-status}"
    
    echo "=============================================="
    echo "  DCGM Management for DGX Spark"
    echo "=============================================="
    
    case "$cmd" in
        install) install_dcgm ;;
        start) start_dcgm ;;
        stop)
            sudo systemctl stop nv-hostengine 2>/dev/null || sudo pkill nv-hostengine 2>/dev/null || true
            log_ok "DCGM stopped"
            ;;
        restart)
            sudo systemctl restart nv-hostengine 2>/dev/null || {
                sudo pkill nv-hostengine 2>/dev/null || true
                sleep 1
                start_dcgm
            }
            ;;
        status) check_status ;;
        health) run_health_check ;;
        metrics) show_metrics ;;
        *)
            echo "Usage: $0 {install|start|stop|restart|status|health|metrics}"
            exit 1
            ;;
    esac
}

main "$@"
