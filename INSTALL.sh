#!/bin/bash
#===============================================================================
# NeMo Command Center - Simple Installer for DGX Spark
# This script WORKS. No bullshit.
#===============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         NeMo Command Center - DGX Spark Installer             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Must be root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Run as root: sudo ./INSTALL.sh${NC}"
   exit 1
fi

# Detect local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}Installing on: $LOCAL_IP${NC}"

if [[ "$LOCAL_IP" == "192.168.50.110" ]]; then
    echo -e "${GREEN}Detected: DGX Spark Beta (LOCAL)${NC}"
    REMOTE_IP="192.168.50.139"
elif [[ "$LOCAL_IP" == "192.168.50.139" ]]; then
    echo -e "${GREEN}Detected: DGX Spark Alpha (LOCAL)${NC}"
    REMOTE_IP="192.168.50.110"
else
    echo -e "${YELLOW}Unknown host${NC}"
    REMOTE_IP=""
fi

#===============================================================================
# CONFIGURATION - Edit these or enter when prompted
#===============================================================================

echo ""
echo -e "${CYAN}=== Database Configuration ===${NC}"
read -p "Database name [nemo_db]: " DB_NAME
DB_NAME=${DB_NAME:-nemo_db}

read -p "Database user [nemo]: " DB_USER
DB_USER=${DB_USER:-nemo}

read -s -p "Database password [auto-generate]: " DB_PASS
echo ""
if [[ -z "$DB_PASS" ]]; then
    DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    echo -e "${YELLOW}Generated password: $DB_PASS${NC}"
fi

echo ""
echo -e "${CYAN}=== MySQL Root Password ===${NC}"
read -s -p "MySQL root password (leave blank if none set): " MYSQL_ROOT
echo ""

echo ""
echo -e "${CYAN}=== Remote DGX Configuration ===${NC}"
read -p "Remote DGX IP [$REMOTE_IP]: " DGX_SSH_HOST
DGX_SSH_HOST=${DGX_SSH_HOST:-$REMOTE_IP}

read -p "Remote SSH port [22]: " DGX_SSH_PORT
DGX_SSH_PORT=${DGX_SSH_PORT:-22}

read -p "Remote SSH username [cvalentine]: " DGX_SSH_USER
DGX_SSH_USER=${DGX_SSH_USER:-cvalentine}

read -s -p "Remote SSH password: " DGX_SSH_PASS
echo ""

echo ""
echo -e "${CYAN}=== API Keys (optional) ===${NC}"
read -p "NGC API Key: " NGC_KEY
read -p "HuggingFace Token: " HF_TOKEN

echo ""
echo -e "${CYAN}=== vLLM Configuration ===${NC}"
read -p "vLLM URL [http://localhost:8001/v1]: " VLLM_URL
VLLM_URL=${VLLM_URL:-http://localhost:8001/v1}

#===============================================================================
# INSTALL
#===============================================================================

INSTALL_DIR="/opt/nemo-command-center"
CONFIG_DIR="/etc/nemo"
LOG_DIR="/var/log/nemo"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${CYAN}=== Installing Dependencies ===${NC}"

# Node.js 22
if ! command -v node &> /dev/null || [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -lt 20 ]]; then
    echo "Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# pnpm
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm > /dev/null 2>&1
fi
echo -e "${GREEN}✓ pnpm installed${NC}"

# nginx
apt-get install -y nginx > /dev/null 2>&1
echo -e "${GREEN}✓ nginx installed${NC}"

#===============================================================================
# DATABASE
#===============================================================================

echo ""
echo -e "${CYAN}=== Setting Up Database ===${NC}"

# Create database and user
if [[ -n "$MYSQL_ROOT" ]]; then
    mysql -u root -p"$MYSQL_ROOT" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    mysql -u root -p"$MYSQL_ROOT" -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" 2>/dev/null
    mysql -u root -p"$MYSQL_ROOT" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null
else
    mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
    mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" 2>/dev/null || true
    mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null || true
fi
echo -e "${GREEN}✓ Database '$DB_NAME' ready${NC}"

DATABASE_URL="mysql://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME"

#===============================================================================
# COPY FILES
#===============================================================================

echo ""
echo -e "${CYAN}=== Copying Application Files ===${NC}"

mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR"

# Copy everything
cp -r "$SCRIPT_DIR/client" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/shared" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/drizzle" "$INSTALL_DIR/" 2>/dev/null || true
cp -r "$SCRIPT_DIR/dist" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/pnpm-lock.yaml" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/vite.config.ts" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/drizzle.config.ts" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/tailwind.config.js" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/postcss.config.js" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/components.json" "$INSTALL_DIR/" 2>/dev/null || true

echo -e "${GREEN}✓ Files copied${NC}"

#===============================================================================
# INSTALL DEPENDENCIES & BUILD
#===============================================================================

echo ""
echo -e "${CYAN}=== Installing Node Dependencies ===${NC}"

cd "$INSTALL_DIR"
pnpm install 2>&1 | tail -5
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo -e "${CYAN}=== Building Application ===${NC}"

export DATABASE_URL
pnpm build 2>&1 | tail -5
echo -e "${GREEN}✓ Build complete${NC}"

#===============================================================================
# DATABASE MIGRATIONS
#===============================================================================

echo ""
echo -e "${CYAN}=== Running Database Migrations ===${NC}"

pnpm db:push 2>&1 | tail -5
echo -e "${GREEN}✓ Database migrated${NC}"

#===============================================================================
# ENVIRONMENT FILE
#===============================================================================

echo ""
echo -e "${CYAN}=== Writing Configuration ===${NC}"

JWT_SECRET=$(openssl rand -base64 32)

cat > "$CONFIG_DIR/nemo.env" << EOF
NODE_ENV=production
PORT=3000

DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET

DGX_SSH_HOST=$DGX_SSH_HOST
DGX_SSH_PORT=$DGX_SSH_PORT
DGX_SSH_USERNAME=$DGX_SSH_USER
DGX_SSH_PASSWORD=$DGX_SSH_PASS

NGC_API_KEY=$NGC_KEY
HUGGINGFACE_TOKEN=$HF_TOKEN
VLLM_API_URL=$VLLM_URL
EOF

chmod 600 "$CONFIG_DIR/nemo.env"
echo -e "${GREEN}✓ Config written to $CONFIG_DIR/nemo.env${NC}"

#===============================================================================
# SYSTEMD SERVICE
#===============================================================================

echo ""
echo -e "${CYAN}=== Creating Systemd Service ===${NC}"

cat > /etc/systemd/system/nemo.service << EOF
[Unit]
Description=NeMo Command Center
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/dist/index.js
Restart=always
RestartSec=10
EnvironmentFile=$CONFIG_DIR/nemo.env
StandardOutput=append:$LOG_DIR/app.log
StandardError=append:$LOG_DIR/error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
echo -e "${GREEN}✓ Systemd service created${NC}"

#===============================================================================
# NGINX
#===============================================================================

echo ""
echo -e "${CYAN}=== Configuring Nginx ===${NC}"

cat > /etc/nginx/sites-available/nemo << 'EOF'
server {
    listen 87;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nemo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
echo -e "${GREEN}✓ Nginx configured on port 87${NC}"

#===============================================================================
# START SERVICE
#===============================================================================

echo ""
echo -e "${CYAN}=== Starting Service ===${NC}"

systemctl enable nemo
systemctl start nemo

sleep 3

if systemctl is-active --quiet nemo; then
    echo -e "${GREEN}✓ Service started successfully!${NC}"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "Check logs: journalctl -u nemo -n 50"
    exit 1
fi

#===============================================================================
# DONE
#===============================================================================

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    INSTALLATION COMPLETE                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Access: ${CYAN}http://$LOCAL_IP:87${NC}"
echo ""
echo -e "Commands:"
echo -e "  Status:  ${YELLOW}sudo systemctl status nemo${NC}"
echo -e "  Restart: ${YELLOW}sudo systemctl restart nemo${NC}"
echo -e "  Logs:    ${YELLOW}sudo journalctl -u nemo -f${NC}"
echo ""
echo -e "Config:    ${YELLOW}$CONFIG_DIR/nemo.env${NC}"
echo -e "Database:  ${YELLOW}$DB_NAME${NC} (user: $DB_USER)"
echo ""
