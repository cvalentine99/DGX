#===============================================================================
# DGX Spark Validation & Management Makefile
#
# Usage:
#   make validate-dgx      # Full validation suite
#   make pre-train         # Pre-training gate (fails if unhealthy)
#   make topology          # Probe NUMA/PCIe topology
#===============================================================================

SHELL := /bin/bash
.PHONY: help validate-dgx validate-quick validate-strict topology dcgm-status pre-train failure-test clean

SCRIPT_DIR := scripts
LOG_DIR := /tmp/dgx-validation
HOSTNAME := $(shell hostname -s)

help:
	@echo "DGX Spark Validation Targets"
	@echo "============================"
	@echo "  make validate-dgx     Full NCCL/DCGM validation"
	@echo "  make validate-quick   Quick NCCL check"
	@echo "  make validate-strict  Strict mode (warnings = errors)"
	@echo "  make topology         Probe NUMA/PCIe topology"
	@echo "  make dcgm-status      Check DCGM status"
	@echo "  make pre-train        Pre-training gate"
	@echo "  make failure-test     Run failure injection tests"

validate-dgx:
	@echo "=== DGX Spark Full Validation ==="
	@mkdir -p $(LOG_DIR)
	@source $(SCRIPT_DIR)/nccl-env.sh && $(SCRIPT_DIR)/nccl-validate.sh

validate-quick:
	@source $(SCRIPT_DIR)/nccl-env.sh && $(SCRIPT_DIR)/nccl-validate.sh --quick

validate-strict:
	@source $(SCRIPT_DIR)/nccl-env.sh && $(SCRIPT_DIR)/nccl-validate.sh --strict

topology:
	@$(SCRIPT_DIR)/topology-probe.sh

dcgm-status:
	@$(SCRIPT_DIR)/dcgm-observe.sh status

pre-train:
	@echo "========================================"
	@echo "  PRE-TRAINING VALIDATION GATE"
	@echo "========================================"
	@source $(SCRIPT_DIR)/nccl-env.sh && $(SCRIPT_DIR)/nccl-validate.sh --strict
	@echo ""
	@nvidia-smi -q 2>/dev/null | head -10 || echo "GPU check skipped"
	@echo ""
	@echo "========================================"
	@echo "  PRE-TRAINING GATE: PASSED"
	@echo "========================================"

failure-test:
	@$(SCRIPT_DIR)/nccl-failure-test.sh

clean:
	@rm -rf $(LOG_DIR) /tmp/nccl-validation /tmp/dgx-topology
	@echo "Cleaned validation logs"
