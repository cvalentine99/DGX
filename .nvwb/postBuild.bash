#!/bin/bash
# postBuild.bash - Executed after container build
# This script runs inside the container after packages are installed

set -e

echo "=== NeMo Command Center Post-Build ==="

# Install Node.js 22 LTS
echo "Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install pnpm
echo "Installing pnpm..."
npm install -g pnpm

# Verify installations
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "pnpm version: $(pnpm --version)"

# Create data directories
mkdir -p /project/data
mkdir -p /project/logs
mkdir -p /project/models

# Set permissions
chmod -R 755 /project

echo "Post-build setup complete."
echo "=== Ready to run NeMo Command Center ==="
