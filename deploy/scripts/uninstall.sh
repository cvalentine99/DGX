#!/bin/bash
# NeMo Command Center - Uninstall Script
# Removes bare metal installation

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/nemo-command-center}"
DATA_DIR="${DATA_DIR:-/var/lib/nemo}"
LOG_DIR="${LOG_DIR:-/var/log/nemo}"
USER="${NEMO_USER:-nemo}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     NeMo Command Center - Uninstall                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root${NC}"
   exit 1
fi

echo -e "${YELLOW}Warning: This will remove NeMo Command Center and all its data.${NC}"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Stopping services...${NC}"

# Stop and disable service
systemctl stop nemo-command-center 2>/dev/null || true
systemctl disable nemo-command-center 2>/dev/null || true

echo -e "${GREEN}✓ Services stopped${NC}"

echo ""
echo -e "${BLUE}Removing systemd service...${NC}"

rm -f /etc/systemd/system/nemo-command-center.service
systemctl daemon-reload

echo -e "${GREEN}✓ Systemd service removed${NC}"

echo ""
echo -e "${BLUE}Removing nginx configuration...${NC}"

rm -f /etc/nginx/sites-enabled/nemo-command-center
rm -f /etc/nginx/sites-available/nemo-command-center
systemctl reload nginx 2>/dev/null || true

echo -e "${GREEN}✓ Nginx configuration removed${NC}"

echo ""
echo -e "${BLUE}Removing application files...${NC}"

rm -rf "$INSTALL_DIR"
rm -rf /etc/nemo

echo -e "${GREEN}✓ Application files removed${NC}"

echo ""
read -p "Do you want to remove data and logs? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$DATA_DIR"
    rm -rf "$LOG_DIR"
    echo -e "${GREEN}✓ Data and logs removed${NC}"
else
    echo -e "${YELLOW}Data preserved at $DATA_DIR${NC}"
fi

echo ""
read -p "Do you want to remove the nemo user? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    userdel "$USER" 2>/dev/null || true
    echo -e "${GREEN}✓ User removed${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Uninstall Complete!                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
