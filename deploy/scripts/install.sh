#!/bin/bash
# NeMo Command Center - Bare Metal Installation Script
# For direct installation on DGX Spark or Ubuntu systems

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/nemo-command-center}"
DATA_DIR="${DATA_DIR:-/var/lib/nemo}"
LOG_DIR="${LOG_DIR:-/var/log/nemo}"
USER="${NEMO_USER:-nemo}"
GROUP="${NEMO_GROUP:-nemo}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     NeMo Command Center - Bare Metal Installation         ║${NC}"
echo -e "${BLUE}║              Valentine RF Infrastructure                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root${NC}"
   exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo -e "${RED}Error: Cannot detect operating system${NC}"
    exit 1
fi

echo -e "${GREEN}Detected OS: $OS $VER${NC}"

# Check for NVIDIA GPU
if command -v nvidia-smi &> /dev/null; then
    echo -e "${GREEN}NVIDIA GPU detected:${NC}"
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
else
    echo -e "${YELLOW}Warning: No NVIDIA GPU detected. Some features may not work.${NC}"
fi

echo ""
echo -e "${BLUE}Step 1: Installing system dependencies...${NC}"

# Update package lists
apt-get update

# Install dependencies
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    sqlite3 \
    libssl-dev \
    ca-certificates \
    gnupg \
    lsb-release \
    supervisor \
    nginx

echo -e "${GREEN}✓ System dependencies installed${NC}"

echo ""
echo -e "${BLUE}Step 2: Installing Node.js 22 LTS...${NC}"

# Install Node.js 22
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 22 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# Install pnpm
npm install -g pnpm

echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"
echo -e "${GREEN}✓ pnpm $(pnpm -v) installed${NC}"

echo ""
echo -e "${BLUE}Step 3: Creating system user and directories...${NC}"

# Create system user if not exists
if ! id "$USER" &>/dev/null; then
    useradd --system --shell /bin/false --home-dir "$INSTALL_DIR" "$USER"
fi

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"
mkdir -p /etc/nemo

echo -e "${GREEN}✓ Directories created${NC}"

echo ""
echo -e "${BLUE}Step 4: Copying application files...${NC}"

# Get the script's directory (where the project is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Copy application files
cp -r "$PROJECT_DIR"/* "$INSTALL_DIR/"

# Remove deployment scripts from install dir
rm -rf "$INSTALL_DIR/deploy"

echo -e "${GREEN}✓ Application files copied to $INSTALL_DIR${NC}"

echo ""
echo -e "${BLUE}Step 5: Installing application dependencies...${NC}"

cd "$INSTALL_DIR"
pnpm install --frozen-lockfile

echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo -e "${BLUE}Step 6: Building application...${NC}"

pnpm build

echo -e "${GREEN}✓ Application built${NC}"

echo ""
echo -e "${BLUE}Step 7: Setting up database...${NC}"

# Initialize database
if [ ! -f "$DATA_DIR/nemo.db" ]; then
    DATABASE_URL="file:$DATA_DIR/nemo.db" pnpm db:push
    echo -e "${GREEN}✓ Database initialized${NC}"
else
    echo -e "${YELLOW}Database already exists, skipping initialization${NC}"
fi

echo ""
echo -e "${BLUE}Step 8: Installing systemd services...${NC}"

# Copy systemd service files
cp "$PROJECT_DIR/deploy/systemd/nemo-command-center.service" /etc/systemd/system/
cp "$PROJECT_DIR/deploy/systemd/nemo-command-center.env" /etc/nemo/

# Set permissions
chown -R "$USER:$GROUP" "$INSTALL_DIR"
chown -R "$USER:$GROUP" "$DATA_DIR"
chown -R "$USER:$GROUP" "$LOG_DIR"
chmod 600 /etc/nemo/nemo-command-center.env

# Reload systemd
systemctl daemon-reload

echo -e "${GREEN}✓ Systemd services installed${NC}"

echo ""
echo -e "${BLUE}Step 9: Configuring nginx...${NC}"

# Copy nginx configuration
cp "$PROJECT_DIR/deploy/nginx/nemo-site.conf" /etc/nginx/sites-available/nemo-command-center
ln -sf /etc/nginx/sites-available/nemo-command-center /etc/nginx/sites-enabled/

# Test nginx configuration
nginx -t

echo -e "${GREEN}✓ Nginx configured${NC}"

echo ""
echo -e "${BLUE}Step 10: Starting services...${NC}"

# Enable and start services
systemctl enable nemo-command-center
systemctl start nemo-command-center
systemctl reload nginx

echo -e "${GREEN}✓ Services started${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Installation Complete!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Application URL: ${BLUE}http://localhost:3000${NC}"
echo -e "Installation directory: ${BLUE}$INSTALL_DIR${NC}"
echo -e "Data directory: ${BLUE}$DATA_DIR${NC}"
echo -e "Log directory: ${BLUE}$LOG_DIR${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit /etc/nemo/nemo-command-center.env with your configuration"
echo "2. Restart the service: systemctl restart nemo-command-center"
echo "3. Check status: systemctl status nemo-command-center"
echo "4. View logs: journalctl -u nemo-command-center -f"
echo ""
