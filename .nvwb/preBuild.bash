#!/bin/bash
# preBuild.bash - Executed before container build
# This script runs in the build context, not the project directory

set -e

echo "=== NeMo Command Center Pre-Build ==="
echo "Setting up build environment..."

# Update package lists
apt-get update

# Install build essentials
apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    ca-certificates

echo "Pre-build setup complete."
