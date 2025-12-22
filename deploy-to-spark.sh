#!/bin/bash
#===============================================================================
# NeMo Command Center - DGX Spark Bare Metal Installer V8
# Builds from source, MySQL database, proper systemd service
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Configuration
APP_NAME="nemo-command-center"
INSTALL_DIR="/opt/${APP_NAME}"
CONFIG_DIR="/etc/nemo"
LOG_DIR="/var/log/nemo"
SERVICE_USER="nemo"
APP_PORT=3000
NGINX_PORT=87

# Get script directory (where the source code is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

#===============================================================================
# Helper Functions
#===============================================================================

print_banner() {
    clear
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                       ║"
    echo "║     ███╗   ██╗███████╗███╗   ███╗ ██████╗                             ║"
    echo "║     ████╗  ██║██╔════╝████╗ ████║██╔═══██╗                            ║"
    echo "║     ██╔██╗ ██║█████╗  ██╔████╔██║██║   ██║                            ║"
    echo "║     ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██║   ██║                            ║"
    echo "║     ██║ ╚████║███████╗██║ ╚═╝ ██║╚██████╔╝                            ║"
    echo "║     ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝ ╚═════╝                             ║"
    echo "║                                                                       ║"
    echo "║              ${BOLD}Command Center - V8 Installer${NC}${CYAN}                          ║"
    echo "║                  DGX Spark Bare Metal                                 ║"
    echo "║                                                                       ║"
    echo "╚═══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_step() {
    echo -e "${BLUE}▸${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}!${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

generate_password() {
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24
}

#===============================================================================
# System Detection
#===============================================================================

detect_system() {
    echo -e "\n${MAGENTA}━━━ System Detection ━━━${NC}\n"
    
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    echo -e "  Hostname: ${BOLD}$(hostname)${NC}"
    echo -e "  IP Address: ${BOLD}$LOCAL_IP${NC}"
    
    # Detect if this is Alpha or Beta
    if [[ "$LOCAL_IP" == "192.168.50.110" ]]; then
        echo -e "  ${GREEN}●${NC} Detected: ${BOLD}DGX Spark Beta (LOCAL)${NC}"
        IS_BETA=true
        REMOTE_HOST="192.168.50.139"
    elif [[ "$LOCAL_IP" == "192.168.50.139" ]]; then
        echo -e "  ${GREEN}●${NC} Detected: ${BOLD}DGX Spark Alpha (LOCAL)${NC}"
        IS_BETA=false
        REMOTE_HOST="192.168.50.110"
    else
        echo -e "  ${YELLOW}●${NC} Unknown host - will configure manually"
        IS_BETA=true
        REMOTE_HOST=""
    fi
    
    # Check GPU
    if command -v nvidia-smi &> /dev/null; then
        GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
        echo -e "  GPU: ${BOLD}$GPU_INFO${NC}"
    fi
    
    # Check MySQL
    if command -v mysql &> /dev/null; then
        MYSQL_VERSION=$(mysql --version 2>/dev/null | awk '{print $3}')
        echo -e "  MySQL: ${BOLD}$MYSQL_VERSION${NC}"
        MYSQL_INSTALLED=true
    else
        echo -e "  MySQL: ${DIM}Not installed${NC}"
        MYSQL_INSTALLED=false
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "  Node.js: ${BOLD}$NODE_VERSION${NC}"
    else
        echo -e "  Node.js: ${DIM}Not installed${NC}"
    fi
}

#===============================================================================
# Configuration Collection
#===============================================================================

collect_config() {
    echo -e "\n${MAGENTA}━━━ Configuration ━━━${NC}\n"
    
    # Database
    echo -e "${CYAN}Database Configuration:${NC}"
    read -p "  Database name [nemo_db]: " DB_NAME
    DB_NAME=${DB_NAME:-nemo_db}
    
    read -p "  Database user [nemo]: " DB_USER
    DB_USER=${DB_USER:-nemo}
    
    DEFAULT_DB_PASS=$(generate_password)
    read -s -p "  Database password [$DEFAULT_DB_PASS]: " DB_PASSWORD
    echo ""
    DB_PASSWORD=${DB_PASSWORD:-$DEFAULT_DB_PASS}
    
    if [[ "$MYSQL_INSTALLED" == "true" ]]; then
        read -s -p "  MySQL root password: " MYSQL_ROOT_PASS
        echo ""
    fi
    
    # JWT Secret
    DEFAULT_JWT=$(generate_password)
    read -s -p "  JWT Secret [$DEFAULT_JWT]: " JWT_SECRET
    echo ""
    JWT_SECRET=${JWT_SECRET:-$DEFAULT_JWT}
    
    # Remote SSH (for managing the other DGX Spark)
    echo -e "\n${CYAN}Remote DGX Spark Configuration:${NC}"
    if [[ -n "$REMOTE_HOST" ]]; then
        echo -e "  ${DIM}This host is LOCAL. Configure SSH to manage the REMOTE host.${NC}"
    fi
    
    read -p "  Configure remote SSH? [Y/n]: " CONFIGURE_SSH
    CONFIGURE_SSH=${CONFIGURE_SSH:-Y}
    
    if [[ "$CONFIGURE_SSH" =~ ^[Yy] ]]; then
        read -p "  Remote host IP [$REMOTE_HOST]: " DGX_SSH_HOST
        DGX_SSH_HOST=${DGX_SSH_HOST:-$REMOTE_HOST}
        
        read -p "  Remote SSH port [22]: " DGX_SSH_PORT
        DGX_SSH_PORT=${DGX_SSH_PORT:-22}
        
        read -p "  Remote SSH username [cvalentine]: " DGX_SSH_USERNAME
        DGX_SSH_USERNAME=${DGX_SSH_USERNAME:-cvalentine}
        
        read -s -p "  Remote SSH password: " DGX_SSH_PASSWORD
        echo ""
    fi
    
    # API Keys
    echo -e "\n${CYAN}API Keys (optional):${NC}"
    read -p "  NGC API Key: " NGC_API_KEY
    read -p "  HuggingFace Token: " HUGGINGFACE_TOKEN
    
    # vLLM
    echo -e "\n${CYAN}vLLM Configuration:${NC}"
    read -p "  vLLM URL [http://localhost:8001/v1]: " VLLM_API_URL
    VLLM_API_URL=${VLLM_API_URL:-http://localhost:8001/v1}
}

#===============================================================================
# Installation Steps
#===============================================================================

install_dependencies() {
    echo -e "\n${MAGENTA}━━━ Installing Dependencies ━━━${NC}\n"
    
    log_step "Updating package lists..."
    apt-get update -qq
    log_success "Package lists updated"
    
    log_step "Installing system packages..."
    apt-get install -y -qq curl wget git build-essential nginx
    log_success "System packages installed"
    
    # Node.js 22
    if ! command -v node &> /dev/null || [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -lt 22 ]]; then
        log_step "Installing Node.js 22..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
        apt-get install -y -qq nodejs
        log_success "Node.js 22 installed"
    else
        log_success "Node.js already installed"
    fi
    
    # pnpm
    if ! command -v pnpm &> /dev/null; then
        log_step "Installing pnpm..."
        npm install -g pnpm > /dev/null 2>&1
        log_success "pnpm installed"
    else
        log_success "pnpm already installed"
    fi
}

setup_mysql() {
    echo -e "\n${MAGENTA}━━━ Setting Up MySQL ━━━${NC}\n"
    
    if [[ "$MYSQL_INSTALLED" != "true" ]]; then
        log_step "Installing MySQL server..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server
        systemctl start mysql
        systemctl enable mysql
        log_success "MySQL installed and started"
        
        MYSQL_ROOT_PASS=$(generate_password)
        mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASS}'; FLUSH PRIVILEGES;"
        log_warn "MySQL root password: $MYSQL_ROOT_PASS (SAVE THIS!)"
    fi
    
    log_step "Creating database and user..."
    mysql -u root -p"${MYSQL_ROOT_PASS}" -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || \
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    mysql -u root -p"${MYSQL_ROOT_PASS}" -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}'; GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null || \
    mysql -u root -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}'; GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"
    
    log_success "Database '${DB_NAME}' and user '${DB_USER}' created"
    
    DATABASE_URL="mysql://${DB_USER}:${DB_PASSWORD}@localhost:3306/${DB_NAME}"
}

setup_directories() {
    echo -e "\n${MAGENTA}━━━ Setting Up Directories ━━━${NC}\n"
    
    log_step "Creating directories..."
    mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR"
    
    # Create service user if not exists
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --home-dir "$INSTALL_DIR" --shell /bin/false "$SERVICE_USER"
        log_success "Service user '$SERVICE_USER' created"
    else
        log_success "Service user already exists"
    fi
    
    log_success "Directories created"
}

copy_source() {
    echo -e "\n${MAGENTA}━━━ Copying Source Files ━━━${NC}\n"
    
    log_step "Copying source code to $INSTALL_DIR..."
    
    # Copy all source directories
    cp -r "$SCRIPT_DIR/client" "$INSTALL_DIR/"
    cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/"
    cp -r "$SCRIPT_DIR/shared" "$INSTALL_DIR/"
    cp -r "$SCRIPT_DIR/drizzle" "$INSTALL_DIR/" 2>/dev/null || true
    
    # Copy config files
    cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
    cp "$SCRIPT_DIR/pnpm-lock.yaml" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/vite.config.ts" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/drizzle.config.ts" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/tailwind.config.js" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/postcss.config.js" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/components.json" "$INSTALL_DIR/" 2>/dev/null || true
    
    log_success "Source files copied"
}

install_npm_deps() {
    echo -e "\n${MAGENTA}━━━ Installing Node Dependencies ━━━${NC}\n"
    
    log_step "Installing dependencies (this may take a few minutes)..."
    cd "$INSTALL_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    log_success "Dependencies installed"
}

build_app() {
    echo -e "\n${MAGENTA}━━━ Building Application ━━━${NC}\n"
    
    log_step "Building application..."
    cd "$INSTALL_DIR"
    
    # Export DATABASE_URL for build
    export DATABASE_URL
    
    pnpm build
    log_success "Application built successfully"
}

run_migrations() {
    echo -e "\n${MAGENTA}━━━ Running Database Migrations ━━━${NC}\n"
    
    log_step "Running database migrations..."
    cd "$INSTALL_DIR"
    
    export DATABASE_URL
    pnpm db:push
    
    log_success "Database migrations complete"
}

write_env_file() {
    echo -e "\n${MAGENTA}━━━ Writing Configuration ━━━${NC}\n"
    
    log_step "Writing environment file..."
    
    cat > "$CONFIG_DIR/${APP_NAME}.env" << EOF
# NeMo Command Center Configuration
# Generated on $(date)

# Server
NODE_ENV=production
PORT=${APP_PORT}

# Security
JWT_SECRET=${JWT_SECRET}

# Database (MySQL)
DATABASE_URL=${DATABASE_URL}

# Local Host Detection
LOCAL_HOST=${IS_BETA:+beta}${IS_BETA:-alpha}

# Remote DGX SSH Configuration
DGX_SSH_HOST=${DGX_SSH_HOST:-}
DGX_SSH_PORT=${DGX_SSH_PORT:-22}
DGX_SSH_USERNAME=${DGX_SSH_USERNAME:-}
DGX_SSH_PASSWORD=${DGX_SSH_PASSWORD:-}

# NVIDIA NGC API
NGC_API_KEY=${NGC_API_KEY:-}

# HuggingFace
HUGGINGFACE_TOKEN=${HUGGINGFACE_TOKEN:-}

# vLLM Inference Server
VLLM_API_URL=${VLLM_API_URL:-http://localhost:8001/v1}
EOF

    chmod 600 "$CONFIG_DIR/${APP_NAME}.env"
    log_success "Environment file written to $CONFIG_DIR/${APP_NAME}.env"
}

setup_systemd() {
    echo -e "\n${MAGENTA}━━━ Setting Up Systemd Service ━━━${NC}\n"
    
    log_step "Creating systemd service..."
    
    cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=NeMo Command Center
Documentation=https://github.com/valentine-rf/nemo-command-center
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/dist/index.js
Restart=always
RestartSec=10

# Environment
EnvironmentFile=${CONFIG_DIR}/${APP_NAME}.env

# Logging
StandardOutput=append:${LOG_DIR}/app.log
StandardError=append:${LOG_DIR}/error.log

# Security
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

    # Set ownership
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$LOG_DIR"
    
    systemctl daemon-reload
    log_success "Systemd service created"
}

setup_nginx() {
    echo -e "\n${MAGENTA}━━━ Configuring Nginx ━━━${NC}\n"
    
    log_step "Creating nginx configuration..."
    
    cat > /etc/nginx/sites-available/${APP_NAME} << EOF
server {
    listen ${NGINX_PORT};
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Static assets with caching
    location /assets/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # API and WebSocket
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    
    nginx -t && systemctl reload nginx
    log_success "Nginx configured on port ${NGINX_PORT}"
}

setup_cron() {
    echo -e "\n${MAGENTA}━━━ Setting Up Maintenance Cron ━━━${NC}\n"
    
    log_step "Creating data pruning cron job..."
    
    # Daily cleanup of old metrics (keep 30 days)
    cat > /etc/cron.daily/nemo-cleanup << 'EOF'
#!/bin/bash
source /etc/nemo/nemo-command-center.env
mysql -u nemo -p"${DB_PASSWORD}" nemo_db -e "DELETE FROM gpu_metrics_history WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);" 2>/dev/null
mysql -u nemo -p"${DB_PASSWORD}" nemo_db -e "DELETE FROM inference_request_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);" 2>/dev/null
mysql -u nemo -p"${DB_PASSWORD}" nemo_db -e "DELETE FROM system_alerts WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);" 2>/dev/null
EOF
    
    chmod +x /etc/cron.daily/nemo-cleanup
    log_success "Cron job created"
}

start_service() {
    echo -e "\n${MAGENTA}━━━ Starting Service ━━━${NC}\n"
    
    log_step "Starting NeMo Command Center..."
    systemctl enable ${APP_NAME}
    systemctl start ${APP_NAME}
    
    sleep 3
    
    if systemctl is-active --quiet ${APP_NAME}; then
        log_success "Service started successfully!"
    else
        log_error "Service failed to start. Check logs:"
        echo "  journalctl -u ${APP_NAME} -n 50"
        exit 1
    fi
}

print_summary() {
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "\n${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                       ║"
    echo "║              ${BOLD}Installation Complete!${NC}${GREEN}                                  ║"
    echo "║                                                                       ║"
    echo "╚═══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${CYAN}Access URLs:${NC}"
    echo -e "  Nginx:  ${BOLD}http://${LOCAL_IP}:${NGINX_PORT}${NC}"
    echo -e "  Direct: ${BOLD}http://${LOCAL_IP}:${APP_PORT}${NC}"
    
    echo -e "\n${CYAN}Service Commands:${NC}"
    echo -e "  Status:  ${DIM}sudo systemctl status ${APP_NAME}${NC}"
    echo -e "  Restart: ${DIM}sudo systemctl restart ${APP_NAME}${NC}"
    echo -e "  Logs:    ${DIM}sudo journalctl -u ${APP_NAME} -f${NC}"
    
    echo -e "\n${CYAN}Configuration:${NC}"
    echo -e "  Env File: ${DIM}${CONFIG_DIR}/${APP_NAME}.env${NC}"
    echo -e "  App Dir:  ${DIM}${INSTALL_DIR}${NC}"
    echo -e "  Logs:     ${DIM}${LOG_DIR}${NC}"
    
    echo -e "\n${CYAN}Database:${NC}"
    echo -e "  Name: ${BOLD}${DB_NAME}${NC}"
    echo -e "  User: ${BOLD}${DB_USER}${NC}"
    echo -e "  URL:  ${DIM}${DATABASE_URL}${NC}"
    
    if [[ -n "$DGX_SSH_HOST" ]]; then
        echo -e "\n${CYAN}Remote Host:${NC}"
        echo -e "  SSH Host: ${BOLD}${DGX_SSH_HOST}:${DGX_SSH_PORT}${NC}"
        echo -e "  Username: ${BOLD}${DGX_SSH_USERNAME}${NC}"
    fi
    
    echo ""
}

#===============================================================================
# Main
#===============================================================================

main() {
    # Must run as root
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}This script must be run as root (sudo)${NC}"
        exit 1
    fi
    
    print_banner
    detect_system
    
    echo -e "\n${BOLD}Press Enter to start configuration...${NC}"
    read
    
    collect_config
    
    echo -e "\n${BOLD}Ready to install. Press Enter to continue or Ctrl+C to cancel...${NC}"
    read
    
    install_dependencies
    setup_mysql
    setup_directories
    copy_source
    install_npm_deps
    build_app
    run_migrations
    write_env_file
    setup_systemd
    setup_nginx
    setup_cron
    start_service
    print_summary
}

main "$@"
