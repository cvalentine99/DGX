# NeMo Command Center Dockerfile
# Compatible with NVIDIA AI Workbench

# Use NVIDIA PyTorch base image for GPU support
FROM nvcr.io/nvidia/pytorch:24.10-py3

# AI Workbench Required Labels
LABEL com.nvidia.workbench.application.name="NeMo Command Center"
LABEL com.nvidia.workbench.application.version="1.0.0"
LABEL com.nvidia.workbench.application.description="Valentine RF Command Center for NVIDIA DGX Spark infrastructure"
LABEL com.nvidia.workbench.os.distro="ubuntu"
LABEL com.nvidia.workbench.os.version="22.04"

# AI Workbench Recommended Labels
LABEL com.nvidia.workbench.package-manager.pip.path="/usr/bin/pip3"
LABEL com.nvidia.workbench.package-manager.apt.path="/usr/bin/apt"
LABEL com.nvidia.workbench.cuda.version="12.4"

# AI Workbench Optional Labels
LABEL maintainer="Valentine RF Team"
LABEL com.nvidia.workbench.icon="https://raw.githubusercontent.com/NVIDIA/NeMo/main/docs/source/_static/nemo_logo.png"

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    sqlite3 \
    libssl-dev \
    ca-certificates \
    openssh-client \
    supervisor \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install Node.js dependencies
RUN pnpm install --frozen-lockfile

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Build the application
RUN pnpm build

# Create data directories
RUN mkdir -p /app/data /app/logs /app/models

# Expose ports
EXPOSE 3000 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Default command
CMD ["pnpm", "start"]
