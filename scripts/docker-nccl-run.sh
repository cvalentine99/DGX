#!/bin/bash
# Docker Run Helper for NCCL Workloads on DGX Spark
#
# USAGE:
#   ./docker-nccl-run.sh <image> [command...]
#   ./docker-nccl-run.sh -i nvcr.io/nvidia/pytorch:24.10-py3

set -euo pipefail

NCCL_SOCKET_IFNAME="enP2p1s0f0np0,enp1s0f0np0"
MASTER_ADDR="${MASTER_ADDR:-192.168.100.10}"
MASTER_PORT="${MASTER_PORT:-29500}"

INTERACTIVE=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -i|--interactive) INTERACTIVE=true; shift ;;
        *) break ;;
    esac
done

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 [-i] <image> [command...]"
    exit 1
fi

IMAGE="$1"; shift
COMMAND=("$@")

DOCKER_ARGS=(
    "docker" "run" "--rm"
    "--gpus" "all"
    "--network=host"
    "--ipc=host"
    "--ulimit" "memlock=-1"
    "--cap-add=SYS_ADMIN"
    "-e" "NCCL_SOCKET_IFNAME=${NCCL_SOCKET_IFNAME}"
    "-e" "NCCL_IB_DISABLE=1"
    "-e" "NCCL_DEBUG=${NCCL_DEBUG:-WARN}"
    "-e" "MASTER_ADDR=${MASTER_ADDR}"
    "-e" "MASTER_PORT=${MASTER_PORT}"
    "-v" "$(pwd):/workspace"
    "-w" "/workspace"
)

$INTERACTIVE && DOCKER_ARGS+=("-it") && [[ ${#COMMAND[@]} -eq 0 ]] && COMMAND=("/bin/bash")

[[ -d /run/dcgm ]] && DOCKER_ARGS+=("-v" "/run/dcgm:/run/dcgm:ro")

DOCKER_ARGS+=("$IMAGE")
[[ ${#COMMAND[@]} -gt 0 ]] && DOCKER_ARGS+=("${COMMAND[@]}")

echo "NCCL_SOCKET_IFNAME: $NCCL_SOCKET_IFNAME"
exec "${DOCKER_ARGS[@]}"
