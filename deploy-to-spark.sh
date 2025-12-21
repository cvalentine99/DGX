#!/bin/bash
#===============================================================================
# NeMo Command Center - DGX Spark Bare Metal Installer
# Interactive installer with MySQL database support
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

# Configuration defaults
APP_NAME="nemo-command-center"
INSTALL_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/nemo"
CONFIG_DIR="/etc/nemo"
SERVICE_USER="nemo"
APP_PORT=3000
DB_NAME="nemo_db"
DB_USER="nemo"

# Collected configuration
declare -A CONFIG

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
    echo "║              ${BOLD}Command Center - Bare Metal Installer${NC}${CYAN}                   ║"
    echo "║                      DGX Spark Edition                                ║"
    echo "║                                                                       ║"
    echo "╚═══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

prompt() {
    local var_name="$1"
    local prompt_text="$2"
    local default_value="$3"
    local is_secret="$4"
    local value
    
    if [[ -n "$default_value" ]]; then
        echo -e -n "${BOLD}${prompt_text}${NC} ${DIM}[${default_value}]${NC}: "
    else
        echo -e -n "${BOLD}${prompt_text}${NC}: "
    fi
    
    if [[ "$is_secret" == "true" ]]; then
        read -s value
        echo ""
    else
        read value
    fi
    
    if [[ -z "$value" && -n "$default_value" ]]; then
        value="$default_value"
    fi
    
    CONFIG[$var_name]="$value"
}

prompt_yes_no() {
    local var_name="$1"
    local prompt_text="$2"
    local default="$3"
    local value
    
    if [[ "$default" == "y" ]]; then
        echo -e -n "${BOLD}${prompt_text}${NC} ${DIM}[Y/n]${NC}: "
    else
        echo -e -n "${BOLD}${prompt_text}${NC} ${DIM}[y/N]${NC}: "
    fi
    
    read value
    value=$(echo "$value" | tr '[:upper:]' '[:lower:]')
    
    if [[ -z "$value" ]]; then
        value="$default"
    fi
    
    if [[ "$value" == "y" || "$value" == "yes" ]]; then
        CONFIG[$var_name]="true"
    else
        CONFIG[$var_name]="false"
    fi
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while ps -p $pid > /dev/null 2>&1; do
        local temp=${spinstr#?}
        printf " ${CYAN}%c${NC}  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

run_step() {
    local description="$1"
    local command="$2"
    
    echo -e -n "  ${BLUE}▸${NC} ${description}..."
    
    eval "$command" > /tmp/install_output.log 2>&1 &
    local pid=$!
    spinner $pid
    wait $pid
    local status=$?
    
    if [[ $status -eq 0 ]]; then
        echo -e " ${GREEN}✓${NC}"
    else
        echo -e " ${RED}✗${NC}"
        echo -e "${RED}Error output:${NC}"
        cat /tmp/install_output.log
        exit 1
    fi
}

generate_password() {
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24
}

#===============================================================================
# System Detection
#===============================================================================

detect_system() {
    print_section "System Detection"
    
    echo -e "  ${BLUE}▸${NC} Detecting system configuration..."
    echo ""
    
    # OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        echo -e "  ${GREEN}●${NC} Operating System: ${BOLD}$PRETTY_NAME${NC}"
    fi
    
    # Hostname
    echo -e "  ${GREEN}●${NC} Hostname: ${BOLD}$(hostname)${NC}"
    
    # IP Address
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    echo -e "  ${GREEN}●${NC} IP Address: ${BOLD}$LOCAL_IP${NC}"
    
    # CPU
    CPU_INFO=$(lscpu | grep "Model name" | cut -d: -f2 | xargs)
    CPU_CORES=$(nproc)
    echo -e "  ${GREEN}●${NC} CPU: ${BOLD}$CPU_INFO ($CPU_CORES cores)${NC}"
    
    # Memory
    TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    echo -e "  ${GREEN}●${NC} Memory: ${BOLD}${TOTAL_MEM}GB${NC}"
    
    # GPU
    if command -v nvidia-smi &> /dev/null; then
        GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
        GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | wc -l)
        echo -e "  ${GREEN}●${NC} GPU: ${BOLD}${GPU_COUNT}x $GPU_INFO${NC}"
        CONFIG[HAS_GPU]="true"
    else
        echo -e "  ${YELLOW}●${NC} GPU: ${DIM}Not detected (nvidia-smi not found)${NC}"
        CONFIG[HAS_GPU]="false"
    fi
    
    # Disk
    AVAIL_DISK=$(df -BG /opt 2>/dev/null | awk 'NR==2{print $4}' | tr -d 'G')
    echo -e "  ${GREEN}●${NC} Available Disk: ${BOLD}${AVAIL_DISK}GB${NC} in /opt"
    
    # Check for MySQL
    if command -v mysql &> /dev/null; then
        MYSQL_VERSION=$(mysql --version 2>/dev/null | awk '{print $3}')
        echo -e "  ${GREEN}●${NC} MySQL: ${BOLD}$MYSQL_VERSION (installed)${NC}"
        CONFIG[MYSQL_INSTALLED]="true"
    else
        echo -e "  ${YELLOW}●${NC} MySQL: ${DIM}Not installed (will be installed)${NC}"
        CONFIG[MYSQL_INSTALLED]="false"
    fi
    
    echo ""
    echo -e "  ${DIM}Press Enter to continue...${NC}"
    read
}

#===============================================================================
# Configuration Prompts
#===============================================================================

collect_basic_config() {
    print_section "Basic Configuration"
    
    echo -e "  ${DIM}Configure the basic settings for NeMo Command Center${NC}"
    echo ""
    
    prompt "APP_PORT" "Application port" "3000"
    prompt_yes_no "ENABLE_NGINX" "Enable nginx reverse proxy (recommended)" "y"
    
    if [[ "${CONFIG[ENABLE_NGINX]}" == "true" ]]; then
        prompt "NGINX_PORT" "Nginx port" "87"
    fi
    
    prompt_yes_no "ENABLE_SSL" "Enable SSL/HTTPS" "n"
    
    if [[ "${CONFIG[ENABLE_SSL]}" == "true" ]]; then
        prompt "DOMAIN" "Domain name for SSL certificate" ""
    fi
}

collect_database_config() {
    print_section "Database Configuration"
    
    echo -e "  ${DIM}Configure MySQL database settings${NC}"
    echo ""
    
    if [[ "${CONFIG[MYSQL_INSTALLED]}" == "true" ]]; then
        echo -e "  ${GREEN}●${NC} MySQL is already installed on this system."
        echo ""
        prompt_yes_no "USE_EXISTING_MYSQL" "Use existing MySQL installation" "y"
        
        if [[ "${CONFIG[USE_EXISTING_MYSQL]}" == "true" ]]; then
            prompt "MYSQL_HOST" "MySQL host" "localhost"
            prompt "MYSQL_PORT" "MySQL port" "3306"
            prompt "MYSQL_ROOT_PASSWORD" "MySQL root password" "" "true"
        fi
    else
        echo -e "  ${YELLOW}●${NC} MySQL will be installed and configured automatically."
        echo ""
        CONFIG[USE_EXISTING_MYSQL]="false"
        CONFIG[MYSQL_HOST]="localhost"
        CONFIG[MYSQL_PORT]="3306"
    fi
    
    prompt "DB_NAME" "Database name" "nemo_db"
    prompt "DB_USER" "Database user" "nemo"
    
    # Generate a random password for the database user
    DEFAULT_DB_PASS=$(generate_password)
    prompt "DB_PASSWORD" "Database password (auto-generated)" "$DEFAULT_DB_PASS" "true"
}

collect_dgx_config() {
    print_section "DGX Spark SSH Configuration"
    
    echo -e "  ${DIM}Configure SSH access to manage DGX Spark hosts${NC}"
    echo -e "  ${DIM}(Leave blank if this IS the DGX Spark you want to manage)${NC}"
    echo ""
    
    prompt_yes_no "CONFIGURE_SSH" "Configure remote DGX SSH access" "n"
    
    if [[ "${CONFIG[CONFIGURE_SSH]}" == "true" ]]; then
        prompt "DGX_SSH_HOST" "DGX Spark IP address" "192.168.50.139"
        prompt "DGX_SSH_PORT" "SSH port" "22"
        prompt "DGX_SSH_USERNAME" "SSH username" "$(whoami)"
        
        echo ""
        echo -e "  ${DIM}Choose authentication method:${NC}"
        echo -e "    ${BOLD}1)${NC} Password"
        echo -e "    ${BOLD}2)${NC} SSH Private Key"
        echo -e -n "  ${BOLD}Select [1/2]:${NC} "
        read auth_choice
        
        if [[ "$auth_choice" == "2" ]]; then
            CONFIG[SSH_AUTH_METHOD]="key"
            prompt "DGX_SSH_KEY_PATH" "Path to SSH private key" "~/.ssh/id_rsa"
        else
            CONFIG[SSH_AUTH_METHOD]="password"
            prompt "DGX_SSH_PASSWORD" "SSH password" "" "true"
        fi
    else
        CONFIG[DGX_SSH_HOST]="localhost"
        CONFIG[DGX_SSH_PORT]="22"
        CONFIG[DGX_SSH_USERNAME]="$(whoami)"
    fi
}

collect_api_keys() {
    print_section "API Keys & Credentials"
    
    echo -e "  ${DIM}Enter your API keys for NVIDIA and HuggingFace services${NC}"
    echo -e "  ${DIM}(These can be added later in /etc/nemo/nemo-command-center.env)${NC}"
    echo ""
    
    prompt "NGC_API_KEY" "NVIDIA NGC API Key (optional)" ""
    prompt "HUGGINGFACE_TOKEN" "HuggingFace Token (optional)" ""
    
    echo ""
    prompt_yes_no "CONFIGURE_VLLM" "Configure vLLM inference server" "n"
    
    if [[ "${CONFIG[CONFIGURE_VLLM]}" == "true" ]]; then
        prompt "VLLM_API_URL" "vLLM API URL" "http://localhost:8000"
        prompt "VLLM_API_KEY" "vLLM API Key (optional)" ""
    fi
}

collect_turn_config() {
    print_section "WebRTC Configuration (Optional)"
    
    echo -e "  ${DIM}Configure TURN server for WebRTC remote desktop features${NC}"
    echo ""
    
    prompt_yes_no "CONFIGURE_TURN" "Configure TURN server" "n"
    
    if [[ "${CONFIG[CONFIGURE_TURN]}" == "true" ]]; then
        prompt "TURN_SERVER_URL" "TURN server URL" "turn:your-server:3478"
        prompt "TURN_SERVER_USERNAME" "TURN username" ""
        prompt "TURN_SERVER_CREDENTIAL" "TURN credential" "" "true"
    fi
}

#===============================================================================
# Configuration Review
#===============================================================================

review_config() {
    print_section "Configuration Review"
    
    echo -e "  ${BOLD}Please review your configuration:${NC}"
    echo ""
    
    echo -e "  ${CYAN}Basic Settings${NC}"
    echo -e "    Application Port: ${BOLD}${CONFIG[APP_PORT]}${NC}"
    echo -e "    Nginx Enabled: ${BOLD}${CONFIG[ENABLE_NGINX]}${NC}"
    if [[ "${CONFIG[ENABLE_NGINX]}" == "true" ]]; then
        echo -e "    Nginx Port: ${BOLD}${CONFIG[NGINX_PORT]}${NC}"
    fi
    echo -e "    SSL Enabled: ${BOLD}${CONFIG[ENABLE_SSL]}${NC}"
    
    echo ""
    echo -e "  ${CYAN}Database Configuration${NC}"
    echo -e "    MySQL Host: ${BOLD}${CONFIG[MYSQL_HOST]}:${CONFIG[MYSQL_PORT]}${NC}"
    echo -e "    Database Name: ${BOLD}${CONFIG[DB_NAME]}${NC}"
    echo -e "    Database User: ${BOLD}${CONFIG[DB_USER]}${NC}"
    
    echo ""
    echo -e "  ${CYAN}DGX SSH Configuration${NC}"
    echo -e "    SSH Host: ${BOLD}${CONFIG[DGX_SSH_HOST]}${NC}"
    echo -e "    SSH Port: ${BOLD}${CONFIG[DGX_SSH_PORT]}${NC}"
    echo -e "    SSH Username: ${BOLD}${CONFIG[DGX_SSH_USERNAME]}${NC}"
    if [[ "${CONFIG[SSH_AUTH_METHOD]}" == "key" ]]; then
        echo -e "    Auth Method: ${BOLD}SSH Key${NC}"
    elif [[ -n "${CONFIG[DGX_SSH_PASSWORD]}" ]]; then
        echo -e "    Auth Method: ${BOLD}Password${NC}"
    fi
    
    echo ""
    echo -e "  ${CYAN}API Keys${NC}"
    if [[ -n "${CONFIG[NGC_API_KEY]}" ]]; then
        echo -e "    NGC API Key: ${BOLD}****${CONFIG[NGC_API_KEY]: -4}${NC}"
    else
        echo -e "    NGC API Key: ${DIM}Not configured${NC}"
    fi
    if [[ -n "${CONFIG[HUGGINGFACE_TOKEN]}" ]]; then
        echo -e "    HuggingFace Token: ${BOLD}****${CONFIG[HUGGINGFACE_TOKEN]: -4}${NC}"
    else
        echo -e "    HuggingFace Token: ${DIM}Not configured${NC}"
    fi
    
    if [[ "${CONFIG[CONFIGURE_VLLM]}" == "true" ]]; then
        echo ""
        echo -e "  ${CYAN}vLLM Configuration${NC}"
        echo -e "    vLLM URL: ${BOLD}${CONFIG[VLLM_API_URL]}${NC}"
    fi
    
    echo ""
    echo -e "  ${CYAN}Installation Paths${NC}"
    echo -e "    Install Directory: ${BOLD}$INSTALL_DIR${NC}"
    echo -e "    Data Directory: ${BOLD}$DATA_DIR${NC}"
    echo -e "    Config Directory: ${BOLD}$CONFIG_DIR${NC}"
    
    echo ""
    echo -e -n "  ${BOLD}Proceed with installation? [Y/n]:${NC} "
    read confirm
    confirm=$(echo "$confirm" | tr '[:upper:]' '[:lower:]')
    
    if [[ "$confirm" == "n" || "$confirm" == "no" ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
}

#===============================================================================
# Installation
#===============================================================================

install_dependencies() {
    print_section "Installing Dependencies"
    
    run_step "Updating package lists" "apt-get update -qq"
    run_step "Installing system packages" "apt-get install -y -qq curl wget git build-essential nginx"
    
    # Node.js
    if ! command -v node &> /dev/null; then
        run_step "Installing Node.js 22 LTS" "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y -qq nodejs"
    else
        echo -e "  ${GREEN}✓${NC} Node.js already installed ($(node --version))"
    fi
    
    # pnpm
    if ! command -v pnpm &> /dev/null; then
        run_step "Installing pnpm" "npm install -g pnpm"
    else
        echo -e "  ${GREEN}✓${NC} pnpm already installed"
    fi
}

install_mysql() {
    print_section "Setting Up MySQL Database"
    
    if [[ "${CONFIG[MYSQL_INSTALLED]}" != "true" ]]; then
        # Install MySQL server
        run_step "Installing MySQL server" "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server"
        run_step "Starting MySQL service" "systemctl start mysql && systemctl enable mysql"
        
        # Secure MySQL installation (set root password)
        ROOT_PASS=$(generate_password)
        CONFIG[MYSQL_ROOT_PASSWORD]="$ROOT_PASS"
        
        run_step "Securing MySQL installation" "mysql -e \"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${ROOT_PASS}'; FLUSH PRIVILEGES;\""
        
        echo -e "  ${YELLOW}!${NC} MySQL root password: ${BOLD}${ROOT_PASS}${NC}"
        echo -e "  ${DIM}(Save this password securely!)${NC}"
    else
        echo -e "  ${GREEN}✓${NC} Using existing MySQL installation"
    fi
    
    # Create database and user
    MYSQL_ROOT_PASS="${CONFIG[MYSQL_ROOT_PASSWORD]}"
    
    run_step "Creating database '${CONFIG[DB_NAME]}'" "mysql -u root -p'${MYSQL_ROOT_PASS}' -e \"CREATE DATABASE IF NOT EXISTS ${CONFIG[DB_NAME]} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
    
    run_step "Creating database user '${CONFIG[DB_USER]}'" "mysql -u root -p'${MYSQL_ROOT_PASS}' -e \"CREATE USER IF NOT EXISTS '${CONFIG[DB_USER]}'@'localhost' IDENTIFIED BY '${CONFIG[DB_PASSWORD]}'; GRANT ALL PRIVILEGES ON ${CONFIG[DB_NAME]}.* TO '${CONFIG[DB_USER]}'@'localhost'; FLUSH PRIVILEGES;\""
    
    # Build the DATABASE_URL
    CONFIG[DATABASE_URL]="mysql://${CONFIG[DB_USER]}:${CONFIG[DB_PASSWORD]}@${CONFIG[MYSQL_HOST]}:${CONFIG[MYSQL_PORT]}/${CONFIG[DB_NAME]}"
}

setup_directories() {
    print_section "Setting Up Directories"
    
    # Create service user
    if ! id "$SERVICE_USER" &>/dev/null; then
        run_step "Creating service user" "useradd --system --home-dir $INSTALL_DIR --shell /bin/false $SERVICE_USER"
    else
        echo -e "  ${GREEN}✓${NC} Service user already exists"
    fi
    
    run_step "Creating directories" "mkdir -p $INSTALL_DIR $DATA_DIR $CONFIG_DIR $INSTALL_DIR/logs"
}

copy_files() {
    print_section "Copying Application Files"
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    if [[ -d "$SCRIPT_DIR/dist" ]]; then
        run_step "Copying application files" "cp -r $SCRIPT_DIR/dist/* $INSTALL_DIR/"
    else
        echo -e "${RED}Error: dist directory not found!${NC}"
        exit 1
    fi
    
    run_step "Copying package files" "cp $SCRIPT_DIR/package.json $INSTALL_DIR/"
    
    if [[ -d "$SCRIPT_DIR/drizzle" ]]; then
        run_step "Copying database migrations" "cp -r $SCRIPT_DIR/drizzle $INSTALL_DIR/"
    fi
    
    if [[ -d "$SCRIPT_DIR/shared" ]]; then
        run_step "Copying shared modules" "cp -r $SCRIPT_DIR/shared $INSTALL_DIR/"
    fi
    
    if [[ -d "$SCRIPT_DIR/server" ]]; then
        run_step "Copying server source" "cp -r $SCRIPT_DIR/server $INSTALL_DIR/"
    fi
    
    if [[ -f "$SCRIPT_DIR/pnpm-lock.yaml" ]]; then
        cp "$SCRIPT_DIR/pnpm-lock.yaml" "$INSTALL_DIR/" 2>/dev/null || true
    fi
    
    if [[ -f "$SCRIPT_DIR/tsconfig.json" ]]; then
        cp "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/" 2>/dev/null || true
    fi
    
    if [[ -f "$SCRIPT_DIR/drizzle.config.ts" ]]; then
        cp "$SCRIPT_DIR/drizzle.config.ts" "$INSTALL_DIR/" 2>/dev/null || true
    fi
}

install_node_deps() {
    print_section "Installing Node.js Dependencies"
    
    run_step "Installing production dependencies" "cd $INSTALL_DIR && pnpm install --prod"
}

run_migrations() {
    print_section "Running Database Migrations"
    
    # Create a migration script that uses the schema
    cat > "$INSTALL_DIR/migrate.mjs" << 'MIGRATE_EOF'
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to database...');
  
  // Parse the connection URL
  const url = new URL(DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
  });
  
  const db = drizzle(connection);
  
  console.log('Running migrations...');
  
  // Create tables
  const migrations = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openId VARCHAR(64) NOT NULL UNIQUE,
      name TEXT,
      email VARCHAR(320),
      loginMethod VARCHAR(64),
      role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Container pull history
    `CREATE TABLE IF NOT EXISTS container_pull_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hostId VARCHAR(32) NOT NULL,
      hostName VARCHAR(128) NOT NULL,
      hostIp VARCHAR(45) NOT NULL,
      imageTag VARCHAR(512) NOT NULL,
      action ENUM('pull', 'update', 'remove') NOT NULL,
      status ENUM('started', 'completed', 'failed') NOT NULL,
      userId INT,
      userName VARCHAR(256),
      errorMessage TEXT,
      startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`,
    
    // GPU metrics history
    `CREATE TABLE IF NOT EXISTS gpu_metrics_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hostId VARCHAR(32) NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      gpuUtilization INT NOT NULL,
      gpuTemperature INT NOT NULL,
      gpuPowerDraw INT NOT NULL,
      gpuMemoryUsed INT NOT NULL,
      gpuMemoryTotal INT NOT NULL,
      cpuUtilization INT,
      systemMemoryUsed INT,
      systemMemoryTotal INT,
      INDEX idx_host_time (hostId, timestamp)
    )`,
    
    // Inference request logs
    `CREATE TABLE IF NOT EXISTS inference_request_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      model VARCHAR(256) NOT NULL,
      promptTokens INT NOT NULL,
      completionTokens INT NOT NULL,
      totalTokens INT NOT NULL,
      latencyMs INT NOT NULL,
      userId INT,
      success INT NOT NULL DEFAULT 1,
      FOREIGN KEY (userId) REFERENCES users(id),
      INDEX idx_timestamp (timestamp)
    )`,
    
    // System alerts
    `CREATE TABLE IF NOT EXISTS system_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type ENUM('success', 'info', 'warning', 'error') NOT NULL,
      message TEXT NOT NULL,
      hostId VARCHAR(32),
      dismissed INT NOT NULL DEFAULT 0
    )`,
    
    // System settings
    `CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sshHost VARCHAR(256),
      sshPort INT,
      sshUsername VARCHAR(128),
      sshPassword VARCHAR(256),
      vllmUrl VARCHAR(512),
      vllmApiKey VARCHAR(256),
      turnUrl VARCHAR(256),
      turnUsername VARCHAR(128),
      turnCredential VARCHAR(256),
      tempWarning INT,
      tempCritical INT,
      powerWarning INT,
      memoryWarning INT,
      alertsEnabled INT DEFAULT 1,
      splunkHost VARCHAR(256),
      splunkPort INT,
      splunkToken VARCHAR(256),
      splunkIndex VARCHAR(128),
      splunkSourceType VARCHAR(128),
      splunkSsl INT DEFAULT 1,
      splunkEnabled INT DEFAULT 0,
      splunkForwardMetrics INT DEFAULT 1,
      splunkForwardAlerts INT DEFAULT 1,
      splunkForwardContainers INT DEFAULT 0,
      splunkForwardInference INT DEFAULT 0,
      splunkInterval INT DEFAULT 60,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    
    // Container presets
    `CREATE TABLE IF NOT EXISTS container_presets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      category VARCHAR(64) NOT NULL DEFAULT 'Custom',
      icon VARCHAR(32) DEFAULT 'box',
      image VARCHAR(512) NOT NULL,
      defaultPort INT NOT NULL DEFAULT 8080,
      gpuRequired INT NOT NULL DEFAULT 0,
      command TEXT,
      envVars TEXT,
      volumes TEXT,
      networkMode VARCHAR(32) DEFAULT 'bridge',
      restartPolicy VARCHAR(32) DEFAULT 'no',
      isPublic INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`,
    
    // Training jobs
    `CREATE TABLE IF NOT EXISTS training_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      name VARCHAR(256) NOT NULL,
      description TEXT,
      baseModel VARCHAR(256) NOT NULL,
      modelPath VARCHAR(512),
      outputPath VARCHAR(512),
      trainingType ENUM('sft', 'lora', 'qlora', 'full') NOT NULL DEFAULT 'lora',
      datasetPath VARCHAR(512) NOT NULL,
      epochs INT NOT NULL DEFAULT 3,
      batchSize INT NOT NULL DEFAULT 4,
      learningRate VARCHAR(32) DEFAULT '2e-5',
      maxSeqLength INT DEFAULT 2048,
      gradientAccumulation INT DEFAULT 1,
      warmupSteps INT DEFAULT 100,
      loraRank INT DEFAULT 16,
      loraAlpha INT DEFAULT 32,
      loraDropout VARCHAR(16) DEFAULT '0.05',
      hostId VARCHAR(32) NOT NULL,
      gpuCount INT NOT NULL DEFAULT 1,
      status ENUM('queued', 'preparing', 'running', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
      progress INT DEFAULT 0,
      currentEpoch INT DEFAULT 0,
      currentStep INT DEFAULT 0,
      totalSteps INT DEFAULT 0,
      trainLoss VARCHAR(32),
      evalLoss VARCHAR(32),
      startedAt TIMESTAMP,
      completedAt TIMESTAMP,
      estimatedTimeRemaining INT,
      errorMessage TEXT,
      logPath VARCHAR(512),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`,
    
    // Training templates
    `CREATE TABLE IF NOT EXISTS training_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      name VARCHAR(256) NOT NULL,
      description TEXT,
      isPublic BOOLEAN DEFAULT FALSE,
      baseModel VARCHAR(256) NOT NULL,
      trainingType ENUM('lora', 'qlora', 'full_sft', 'full_finetune') NOT NULL,
      datasetPath VARCHAR(512),
      epochs INT NOT NULL DEFAULT 3,
      batchSize INT NOT NULL DEFAULT 4,
      learningRate VARCHAR(32) NOT NULL DEFAULT '2e-5',
      warmupSteps INT DEFAULT 100,
      loraRank INT DEFAULT 16,
      loraAlpha INT DEFAULT 32,
      gpuCount INT NOT NULL DEFAULT 1,
      preferredHost VARCHAR(32),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`
  ];
  
  for (const migration of migrations) {
    try {
      await connection.execute(migration);
      console.log('✓ Migration executed successfully');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('✓ Table already exists, skipping');
      } else {
        console.error('Migration error:', error.message);
      }
    }
  }
  
  // Insert default settings if not exists
  const [settings] = await connection.execute('SELECT COUNT(*) as count FROM system_settings');
  if (settings[0].count === 0) {
    await connection.execute(`INSERT INTO system_settings (tempWarning, tempCritical, powerWarning, memoryWarning) VALUES (75, 85, 250, 90)`);
    console.log('✓ Default settings created');
  }
  
  await connection.end();
  console.log('Migration completed successfully!');
}

migrate().catch(console.error);
MIGRATE_EOF

    run_step "Running database migrations" "cd $INSTALL_DIR && DATABASE_URL='${CONFIG[DATABASE_URL]}' node migrate.mjs"
}

write_config() {
    print_section "Writing Configuration"
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Build environment file
    cat > "$CONFIG_DIR/${APP_NAME}.env" << EOF
#===============================================================================
# NeMo Command Center Configuration
# Generated on $(date)
# Edit this file to update your configuration
#===============================================================================

# Server Configuration
NODE_ENV=production
PORT=${CONFIG[APP_PORT]}

# Security
JWT_SECRET=${JWT_SECRET}

# Database (MySQL)
DATABASE_URL=${CONFIG[DATABASE_URL]}

# DGX SSH Configuration
DGX_SSH_HOST=${CONFIG[DGX_SSH_HOST]}
DGX_SSH_PORT=${CONFIG[DGX_SSH_PORT]}
DGX_SSH_USERNAME=${CONFIG[DGX_SSH_USERNAME]}
EOF

    if [[ "${CONFIG[SSH_AUTH_METHOD]}" == "key" && -n "${CONFIG[DGX_SSH_KEY_PATH]}" ]]; then
        # Read and base64 encode the SSH key
        if [[ -f "${CONFIG[DGX_SSH_KEY_PATH]}" ]]; then
            SSH_KEY_B64=$(base64 -w 0 "${CONFIG[DGX_SSH_KEY_PATH]}")
            echo "DGX_SSH_PRIVATE_KEY=${SSH_KEY_B64}" >> "$CONFIG_DIR/${APP_NAME}.env"
        fi
    elif [[ -n "${CONFIG[DGX_SSH_PASSWORD]}" ]]; then
        echo "DGX_SSH_PASSWORD=${CONFIG[DGX_SSH_PASSWORD]}" >> "$CONFIG_DIR/${APP_NAME}.env"
    fi

    cat >> "$CONFIG_DIR/${APP_NAME}.env" << EOF

# NVIDIA NGC API
EOF
    if [[ -n "${CONFIG[NGC_API_KEY]}" ]]; then
        echo "NGC_API_KEY=${CONFIG[NGC_API_KEY]}" >> "$CONFIG_DIR/${APP_NAME}.env"
    else
        echo "# NGC_API_KEY=your-ngc-api-key" >> "$CONFIG_DIR/${APP_NAME}.env"
    fi

    cat >> "$CONFIG_DIR/${APP_NAME}.env" << EOF

# HuggingFace
EOF
    if [[ -n "${CONFIG[HUGGINGFACE_TOKEN]}" ]]; then
        echo "HUGGINGFACE_TOKEN=${CONFIG[HUGGINGFACE_TOKEN]}" >> "$CONFIG_DIR/${APP_NAME}.env"
    else
        echo "# HUGGINGFACE_TOKEN=your-hf-token" >> "$CONFIG_DIR/${APP_NAME}.env"
    fi

    if [[ "${CONFIG[CONFIGURE_VLLM]}" == "true" ]]; then
        cat >> "$CONFIG_DIR/${APP_NAME}.env" << EOF

# vLLM Inference Server
VLLM_API_URL=${CONFIG[VLLM_API_URL]}
EOF
        if [[ -n "${CONFIG[VLLM_API_KEY]}" ]]; then
            echo "VLLM_API_KEY=${CONFIG[VLLM_API_KEY]}" >> "$CONFIG_DIR/${APP_NAME}.env"
        fi
    fi

    if [[ "${CONFIG[CONFIGURE_TURN]}" == "true" ]]; then
        cat >> "$CONFIG_DIR/${APP_NAME}.env" << EOF

# WebRTC TURN Server
TURN_SERVER_URL=${CONFIG[TURN_SERVER_URL]}
TURN_SERVER_USERNAME=${CONFIG[TURN_SERVER_USERNAME]}
TURN_SERVER_CREDENTIAL=${CONFIG[TURN_SERVER_CREDENTIAL]}
EOF
    fi

    echo -e "  ${GREEN}✓${NC} Configuration written to $CONFIG_DIR/${APP_NAME}.env"
    
    # Set permissions
    run_step "Setting permissions" "chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR && chown -R $SERVICE_USER:$SERVICE_USER $DATA_DIR && chmod 600 $CONFIG_DIR/${APP_NAME}.env"
}

setup_systemd() {
    print_section "Setting Up Systemd Service"
    
    cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=NeMo Command Center
Documentation=https://github.com/valentine-rf/nemo-command-center
After=network.target mysql.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:${INSTALL_DIR}/logs/app.log
StandardError=append:${INSTALL_DIR}/logs/error.log
EnvironmentFile=${CONFIG_DIR}/${APP_NAME}.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${INSTALL_DIR}/logs
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    run_step "Reloading systemd" "systemctl daemon-reload"
    echo -e "  ${GREEN}✓${NC} Systemd service created"
}

setup_nginx() {
    if [[ "${CONFIG[ENABLE_NGINX]}" != "true" ]]; then
        return
    fi
    
    print_section "Configuring Nginx"
    
    cat > /etc/nginx/sites-available/${APP_NAME} << EOF
server {
    listen ${CONFIG[NGINX_PORT]};
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression for static assets
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Static assets - serve directly from disk (high performance)
    location /assets/ {
        alias ${INSTALL_DIR}/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Images - serve directly from disk
    location /images/ {
        alias ${INSTALL_DIR}/public/images/;
        expires 30d;
        add_header Cache-Control "public";
        access_log off;
    }

    # Favicon and static root files
    location ~* ^/(favicon\.ico|robots\.txt|\.well-known)/ {
        root ${INSTALL_DIR}/public;
        expires 7d;
        access_log off;
    }

    # API and dynamic routes - proxy to Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:${CONFIG[APP_PORT]};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }

    # tRPC endpoint
    location /trpc/ {
        proxy_pass http://127.0.0.1:${CONFIG[APP_PORT]};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }

    # Socket.io WebSocket connections
    location /socket.io/ {
        proxy_pass http://127.0.0.1:${CONFIG[APP_PORT]};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://127.0.0.1:${CONFIG[APP_PORT]};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # SPA fallback - try static file first, then proxy to Node.js
    location / {
        root ${INSTALL_DIR}/public;
        try_files \$uri \$uri/ @backend;
    }

    # Backend fallback for SPA routes
    location @backend {
        proxy_pass http://127.0.0.1:${CONFIG[APP_PORT]};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    run_step "Enabling nginx site" "ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default"
    run_step "Testing nginx config" "nginx -t"
    run_step "Reloading nginx" "systemctl reload nginx"
}

setup_data_pruning() {
    print_section "Setting Up Data Pruning"
    
    # Create the pruning script
    cat > ${INSTALL_DIR}/prune-metrics.sh << 'PRUNE_EOF'
#!/bin/bash
#===============================================================================
# NeMo Command Center - Metrics Data Pruning Script
# Deletes metrics older than specified retention period to prevent disk fill
#===============================================================================

# Load environment
if [[ -f /etc/nemo/nemo-command-center.env ]]; then
    source /etc/nemo/nemo-command-center.env
fi

# Default retention: 30 days
RETENTION_DAYS=${METRICS_RETENTION_DAYS:-30}

# Parse DATABASE_URL to extract credentials
if [[ -z "$DATABASE_URL" ]]; then
    echo "ERROR: DATABASE_URL not set"
    exit 1
fi

# Extract MySQL connection details from URL
# Format: mysql://user:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo $DATABASE_URL | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo $DATABASE_URL | sed -E 's|mysql://[^@]+@([^:]+):.*|\1|')
DB_PORT=$(echo $DATABASE_URL | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo $DATABASE_URL | sed -E 's|mysql://[^/]+/(.+)|\1|')

LOG_FILE="/opt/nemo-command-center/logs/prune.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log "Starting metrics pruning (retention: ${RETENTION_DAYS} days)"

# Prune gpu_metrics_history
GPU_DELETED=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" "$DB_NAME" -N -e "
    DELETE FROM gpu_metrics_history 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL ${RETENTION_DAYS} DAY);
    SELECT ROW_COUNT();
" 2>/dev/null)
log "Deleted ${GPU_DELETED:-0} rows from gpu_metrics_history"

# Prune inference_request_logs
INFERENCE_DELETED=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" "$DB_NAME" -N -e "
    DELETE FROM inference_request_logs 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL ${RETENTION_DAYS} DAY);
    SELECT ROW_COUNT();
" 2>/dev/null)
log "Deleted ${INFERENCE_DELETED:-0} rows from inference_request_logs"

# Prune dismissed system_alerts older than 7 days
ALERTS_DELETED=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" "$DB_NAME" -N -e "
    DELETE FROM system_alerts 
    WHERE dismissed = 1 AND timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
    SELECT ROW_COUNT();
" 2>/dev/null)
log "Deleted ${ALERTS_DELETED:-0} dismissed alerts"

# Optimize tables after deletion
mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" "$DB_NAME" -e "
    OPTIMIZE TABLE gpu_metrics_history;
    OPTIMIZE TABLE inference_request_logs;
    OPTIMIZE TABLE system_alerts;
" 2>/dev/null
log "Tables optimized"

log "Pruning complete"
PRUNE_EOF

    chmod +x ${INSTALL_DIR}/prune-metrics.sh
    
    # Add cron job to run daily at 3 AM
    CRON_LINE="0 3 * * * ${INSTALL_DIR}/prune-metrics.sh"
    
    # Check if cron job already exists
    if ! crontab -l 2>/dev/null | grep -q "prune-metrics.sh"; then
        (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
        echo -e "  ${GREEN}✓${NC} Cron job added (daily at 3 AM)"
    else
        echo -e "  ${GREEN}✓${NC} Cron job already exists"
    fi
    
    # Add retention config to env file if not present
    if ! grep -q "METRICS_RETENTION_DAYS" "$CONFIG_DIR/${APP_NAME}.env" 2>/dev/null; then
        echo "" >> "$CONFIG_DIR/${APP_NAME}.env"
        echo "# Data retention (days) - metrics older than this are automatically deleted" >> "$CONFIG_DIR/${APP_NAME}.env"
        echo "METRICS_RETENTION_DAYS=30" >> "$CONFIG_DIR/${APP_NAME}.env"
    fi
    
    echo -e "  ${GREEN}✓${NC} Data pruning configured (30 day retention)"
}

#===============================================================================
# Completion
#===============================================================================

print_completion() {
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                       ║"
    echo "║                    Installation Complete! 🎉                          ║"
    echo "║                                                                       ║"
    echo "╚═══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${CYAN}${BOLD}Quick Start Commands:${NC}"
    echo ""
    echo -e "  ${BOLD}Start the service:${NC}"
    echo -e "    sudo systemctl start ${APP_NAME}"
    echo -e "    sudo systemctl enable ${APP_NAME}"
    echo ""
    echo -e "  ${BOLD}Check status:${NC}"
    echo -e "    sudo systemctl status ${APP_NAME}"
    echo ""
    echo -e "  ${BOLD}View logs:${NC}"
    echo -e "    sudo journalctl -u ${APP_NAME} -f"
    echo -e "    tail -f ${INSTALL_DIR}/logs/app.log"
    echo ""
    
    echo -e "${CYAN}${BOLD}Access URLs:${NC}"
    echo ""
    if [[ "${CONFIG[ENABLE_NGINX]}" == "true" ]]; then
        echo -e "  ${GREEN}▸${NC} http://${LOCAL_IP}:${CONFIG[NGINX_PORT]}"
    fi
    echo -e "  ${GREEN}▸${NC} http://localhost:${CONFIG[APP_PORT]}"
    echo ""
    
    echo -e "${CYAN}${BOLD}Database Information:${NC}"
    echo ""
    echo -e "  ${GREEN}▸${NC} MySQL Host: ${BOLD}${CONFIG[MYSQL_HOST]}:${CONFIG[MYSQL_PORT]}${NC}"
    echo -e "  ${GREEN}▸${NC} Database: ${BOLD}${CONFIG[DB_NAME]}${NC}"
    echo -e "  ${GREEN}▸${NC} User: ${BOLD}${CONFIG[DB_USER]}${NC}"
    if [[ "${CONFIG[MYSQL_INSTALLED]}" != "true" ]]; then
        echo -e "  ${YELLOW}▸${NC} MySQL Root Password: ${BOLD}${CONFIG[MYSQL_ROOT_PASSWORD]}${NC}"
    fi
    echo ""
    
    echo -e "${CYAN}${BOLD}Configuration Files:${NC}"
    echo ""
    echo -e "  ${GREEN}▸${NC} Environment: ${BOLD}$CONFIG_DIR/${APP_NAME}.env${NC}"
    echo -e "  ${GREEN}▸${NC} Systemd: ${BOLD}/etc/systemd/system/${APP_NAME}.service${NC}"
    if [[ "${CONFIG[ENABLE_NGINX]}" == "true" ]]; then
        echo -e "  ${GREEN}▸${NC} Nginx: ${BOLD}/etc/nginx/sites-available/${APP_NAME}${NC}"
    fi
    echo ""
    
    echo -e "${YELLOW}${BOLD}Next Steps:${NC}"
    echo ""
    echo -e "  1. Review configuration: ${BOLD}sudo nano $CONFIG_DIR/${APP_NAME}.env${NC}"
    echo -e "  2. Start the service: ${BOLD}sudo systemctl start ${APP_NAME}${NC}"
    echo -e "  3. Enable auto-start: ${BOLD}sudo systemctl enable ${APP_NAME}${NC}"
    echo -e "  4. Open in browser: ${BOLD}http://${LOCAL_IP}${NC}"
    echo ""
    
    echo -e "${DIM}For support, visit: https://github.com/valentine-rf/nemo-command-center${NC}"
    echo ""
}

#===============================================================================
# Main
#===============================================================================

main() {
    # Check root
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}This script must be run as root (use sudo)${NC}"
        exit 1
    fi
    
    print_banner
    
    echo -e "  ${DIM}Welcome to the NeMo Command Center installer!${NC}"
    echo -e "  ${DIM}This wizard will guide you through the installation process.${NC}"
    echo ""
    echo -e "  ${DIM}Press Enter to begin...${NC}"
    read
    
    # Collect configuration
    detect_system
    collect_basic_config
    collect_database_config
    collect_dgx_config
    collect_api_keys
    collect_turn_config
    review_config
    
    # Install
    install_dependencies
    install_mysql
    setup_directories
    copy_files
    install_node_deps
    run_migrations
    write_config
    setup_systemd
    setup_nginx
    setup_data_pruning
    
    # Done
    print_completion
}

main "$@"
