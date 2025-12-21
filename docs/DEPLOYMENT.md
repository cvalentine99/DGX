# NeMo Command Center Deployment Guide

This guide covers two deployment methods for NeMo Command Center: **AI Workbench** (containerized) and **Bare Metal** installation.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AI Workbench Deployment](#ai-workbench-deployment)
3. [Bare Metal Deployment](#bare-metal-deployment)
4. [Configuration](#configuration)
5. [Post-Installation](#post-installation)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16 GB | 32+ GB |
| Storage | 100 GB SSD | 500+ GB NVMe |
| GPU | NVIDIA GPU with 8GB VRAM | NVIDIA GB10 Grace Blackwell |

### Software Requirements

| Software | Version | Notes |
|----------|---------|-------|
| Ubuntu | 22.04 or 24.04 | Other Debian-based distros may work |
| NVIDIA Driver | 535+ | Required for GPU features |
| Docker | 24.0+ | For AI Workbench deployment |
| Node.js | 22 LTS | For bare metal deployment |

---

## AI Workbench Deployment

AI Workbench provides a containerized development environment with automatic GPU configuration.

### Step 1: Install AI Workbench

**Ubuntu:**
```bash
curl -fsSL https://workbench.download.nvidia.com/stable/linux/gpgkey | \
  sudo tee -a /etc/apt/trusted.gpg.d/ai-workbench-desktop-key.asc
echo "deb https://workbench.download.nvidia.com/stable/linux/debian default proprietary" | \
  sudo tee -a /etc/apt/sources.list
sudo apt update
sudo apt install nvidia-ai-workbench
```

### Step 2: Clone the Project

1. Open AI Workbench Desktop App
2. Click "Clone Project"
3. Enter the repository URL
4. Select your target location (local or remote DGX)

### Step 3: Configure Environment

1. Navigate to **Environment** tab
2. Add required secrets:
   - `NGC_API_KEY` - Your NVIDIA NGC API key
   - `HUGGINGFACE_TOKEN` - HuggingFace access token
   - `JWT_SECRET` - Random string for authentication

### Step 4: Start the Application

1. Click **Start** in the AI Workbench UI
2. Wait for container build (first time takes ~10 minutes)
3. Access the application at `http://localhost:3000`

### Using Docker Compose Directly

If you prefer Docker Compose without AI Workbench:

```bash
# Clone the repository
git clone https://github.com/valentine-rf/nemo-command-center.git
cd nemo-command-center

# Copy and configure environment
cp .env.example .env
nano .env  # Edit with your values

# Start services
docker compose up -d

# View logs
docker compose logs -f app
```

### Available Profiles

```bash
# Basic (app only)
docker compose up -d

# With JupyterLab
docker compose up -d jupyter

# Production with nginx
docker compose --profile production up -d

# With vLLM inference server
docker compose --profile inference up -d
```

---

## Bare Metal Deployment

Direct installation on DGX Spark or Ubuntu systems for maximum performance.

### Step 1: Download and Extract

```bash
# Download the release
wget https://github.com/valentine-rf/nemo-command-center/releases/latest/download/nemo-command-center.tar.gz

# Extract
tar -xzf nemo-command-center.tar.gz
cd nemo-command-center
```

### Step 2: Run Installation Script

```bash
# Make scripts executable
chmod +x deploy/scripts/*.sh

# Run installer as root
sudo ./deploy/scripts/install.sh
```

### Step 3: Configure Environment

```bash
# Edit the environment file
sudo nano /etc/nemo/nemo-command-center.env
```

Required configuration:

```bash
JWT_SECRET=your-secure-random-string
NGC_API_KEY=your-ngc-api-key
HUGGINGFACE_TOKEN=your-hf-token
DGX_SSH_HOST=192.168.50.139
DGX_SSH_USERNAME=your-username
DGX_SSH_PASSWORD=your-password
```

### Step 4: Start the Service

```bash
# Restart to apply configuration
sudo systemctl restart nemo-command-center

# Check status
sudo systemctl status nemo-command-center

# View logs
sudo journalctl -u nemo-command-center -f
```

### Manual Installation

If you prefer manual installation:

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Install dependencies
pnpm install

# Build
pnpm build

# Initialize database
DATABASE_URL=file:./data/nemo.db pnpm db:push

# Start
NODE_ENV=production node dist/index.js
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for JWT tokens |
| `DATABASE_URL` | Yes | SQLite database path |
| `NGC_API_KEY` | Yes | NVIDIA NGC API key |
| `HUGGINGFACE_TOKEN` | Yes | HuggingFace access token |
| `VLLM_API_URL` | No | vLLM inference endpoint |
| `DGX_SSH_HOST` | Yes | DGX Spark hostname/IP |
| `DGX_SSH_USERNAME` | Yes | SSH username |
| `DGX_SSH_PASSWORD` | Yes* | SSH password |
| `DGX_SSH_PRIVATE_KEY` | Yes* | Base64-encoded SSH key |

*Either password or private key is required

### SSL/TLS Configuration

For production deployments with HTTPS:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

---

## Post-Installation

### Verify Installation

```bash
# Check service status
sudo systemctl status nemo-command-center

# Test health endpoint
curl http://localhost:3000/api/health

# Check GPU access
nvidia-smi
```

### Initial Setup

1. Open `http://your-server:3000` in a browser
2. Log in with your OAuth credentials (or create local account)
3. Navigate to **Settings** to configure DGX hosts
4. Test SSH connectivity from the **Dashboard**

### Backup Configuration

```bash
# Backup database
cp /var/lib/nemo/nemo.db /backup/nemo-$(date +%Y%m%d).db

# Backup configuration
cp /etc/nemo/nemo-command-center.env /backup/
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u nemo-command-center -n 100 --no-pager

# Verify permissions
ls -la /opt/nemo-command-center
ls -la /var/lib/nemo

# Check port availability
sudo netstat -tlnp | grep 3000
```

### SSH Connection Issues

```bash
# Test SSH manually
ssh -v user@dgx-host

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa

# Verify host is reachable
ping dgx-host
```

### GPU Not Detected

```bash
# Check NVIDIA driver
nvidia-smi

# For Docker, verify nvidia-container-toolkit
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

### Database Issues

```bash
# Reset database
rm /var/lib/nemo/nemo.db
DATABASE_URL=file:/var/lib/nemo/nemo.db pnpm db:push
```

---

## Uninstallation

### AI Workbench

1. Stop the project in AI Workbench
2. Delete the project from the UI
3. Remove Docker volumes if needed

### Bare Metal

```bash
sudo ./deploy/scripts/uninstall.sh
```

---

## Support

For issues and feature requests, please open an issue on GitHub or contact the Valentine RF team.
