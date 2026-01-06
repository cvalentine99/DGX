#!/bin/bash
#===============================================================================
# DCGM Observability - Metrics Export and Integration
#
# Provides three observability paths:
#   1. Prometheus exporter (dcgm-exporter container)
#   2. File/JSON emission (structured logs)
#   3. Live monitoring (dcgmi dmon wrapper)
#
# Target: gx10-alpha, gx10-beta (DGX Spark ARM64)
#===============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

HOSTNAME_SHORT=$(hostname -s)
METRICS_DIR="/var/log/dcgm-metrics"
EXPORTER_PORT=9400

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

usage() {
    cat << EOF
DCGM Observability Tools

Usage: $0 <command>

Commands:
  prometheus    Start dcgm-exporter for Prometheus scraping
  json          Export metrics to JSON file
  monitor       Live terminal monitoring
  status        Check DCGM and exporter status
  stop          Stop dcgm-exporter container
EOF
    exit 1
}

start_prometheus_exporter() {
    log_info "Starting DCGM Prometheus exporter..."
    
    if docker ps --format '{{.Names}}' | grep -q "dcgm-exporter"; then
        log_warn "dcgm-exporter already running"
        return 0
    fi
    
    docker run -d --name dcgm-exporter --gpus all --cap-add SYS_ADMIN \
        -p ${EXPORTER_PORT}:9400 nvcr.io/nvidia/k8s/dcgm-exporter:3.3.5-3.4.1-ubuntu22.04
    
    sleep 3
    log_pass "dcgm-exporter started on port ${EXPORTER_PORT}"
    echo "Test: curl http://localhost:${EXPORTER_PORT}/metrics"
}

export_json() {
    mkdir -p "$METRICS_DIR"
    local OUTPUT_FILE="${METRICS_DIR}/dcgm-${HOSTNAME_SHORT}-$(date +%Y%m%d_%H%M%S).json"
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -Iseconds)\","
        echo "  \"hostname\": \"${HOSTNAME_SHORT}\","
        echo "  \"metrics\": {"
        nvidia-smi --query-gpu=temperature.gpu,power.draw,utilization.gpu,utilization.memory --format=csv,noheader,nounits 2>/dev/null | head -1 | awk -F', ' '{
            printf "    \"gpu_temp_c\": %s,\n", $1
            printf "    \"power_usage_w\": %s,\n", $2
            printf "    \"sm_util_pct\": %s,\n", $3
            printf "    \"mem_util_pct\": %s\n", $4
        }'
        echo "  }"
        echo "}"
    } > "$OUTPUT_FILE"
    
    log_info "Exported: $OUTPUT_FILE"
}

live_monitor() {
    log_info "Starting live GPU monitoring (Ctrl+C to stop)"
    if command -v dcgmi &>/dev/null; then
        dcgmi dmon -e 203,204,1001,1002 -d 1000
    else
        watch -n 1 nvidia-smi --query-gpu=index,temperature.gpu,power.draw,utilization.gpu,memory.used --format=csv
    fi
}

check_status() {
    echo "DCGM Observability Status"
    echo "========================="
    
    if pgrep -x nv-hostengine &>/dev/null; then
        log_pass "nv-hostengine: running"
    else
        log_warn "nv-hostengine: not running"
    fi
    
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "dcgm-exporter"; then
        log_pass "dcgm-exporter: running on port ${EXPORTER_PORT}"
    else
        log_warn "dcgm-exporter: not running"
    fi
}

case ${1:-help} in
    prometheus|prom) start_prometheus_exporter ;;
    json) export_json ;;
    monitor|mon) live_monitor ;;
    status) check_status ;;
    stop) docker stop dcgm-exporter 2>/dev/null; docker rm dcgm-exporter 2>/dev/null ;;
    *) usage ;;
esac
