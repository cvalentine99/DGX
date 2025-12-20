/**
 * ExtraHop API JSON Schema Validation
 * Validates assistant responses against the ExtraHop Metrics API schema
 */

// Valid metric categories from ExtraHop API
export const VALID_METRIC_CATEGORIES = [
  "db_server",
  "http_server", 
  "ssl_server",
  "tcp",
  "net",
  "dns_server",
  "sip",
  "ldap_server",
  "dhcp_server",
  "nas",
  "cifs_server",
  "nfs_server",
  "ftp_server",
  "smtp_server",
  "ica_server",
  "rdp_server",
  "ssh_server",
  "telnet_server",
  "amf_server",
  "memcache_server",
  "mongo_server",
  "redis_server",
] as const;

// Valid object types
export const VALID_OBJECT_TYPES = [
  "device",
  "device_group",
  "application",
  "network",
  "vlan",
  "activity_group",
  "system",
] as const;

// Valid cycle types
export const VALID_CYCLES = [
  "auto",
  "1sec",
  "30sec", 
  "5min",
  "1hr",
  "24hr",
] as const;

// Common metrics by category
export const METRICS_BY_CATEGORY: Record<string, string[]> = {
  db_server: ["req", "rsp", "rsp_error", "process_time", "req_xfer_time", "rsp_xfer_time", "rows", "method"],
  http_server: ["req", "rsp", "rsp_error", "status_code", "method", "uri", "process_time", "req_size", "rsp_size"],
  ssl_server: ["handshake", "session", "version", "cipher", "cert_expiry", "renegotiation", "alert"],
  tcp: ["syn", "syn_ack", "rst", "fin", "retransmit", "zero_wnd", "rtt", "bytes_in", "bytes_out"],
  net: ["pkts_in", "pkts_out", "bytes_in", "bytes_out", "broadcast", "multicast", "errors"],
  dns_server: ["req", "rsp", "rsp_code", "query_type", "process_time", "nxdomain", "servfail"],
  sip: ["req", "rsp", "invite", "bye", "register", "ack", "cancel", "rsp_code"],
  ldap_server: ["bind", "search", "add", "modify", "delete", "compare", "abandon", "extended"],
  dhcp_server: ["discover", "offer", "request", "ack", "nak", "release", "inform", "decline"],
  nas: ["read", "write", "open", "close", "lock", "unlock", "create", "delete", "rename"],
};

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  parsedResponse?: ExtraHopApiRequest;
}

export interface MetricSpec {
  name: string;
  key1?: string;
  key2?: string;
  calc_type?: "mean" | "max" | "min" | "sum" | "count" | "percentile";
  percentile?: number;
}

export interface ExtraHopApiRequest {
  metric_category: string;
  object_type: string;
  metric_specs: MetricSpec[];
  object_ids?: number[];
  from?: string;
  until?: string;
  cycle?: string;
}

/**
 * Validate an ExtraHop API request JSON
 */
export function validateExtraHopResponse(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if content is empty
  if (!content || content.trim() === "") {
    return {
      isValid: false,
      errors: [{ field: "response", message: "Response content is empty", severity: "error" }],
      warnings: [],
    };
  }

  // Check if it's a refusal response (negative example)
  if (content.toLowerCase().includes("cannot") || 
      content.toLowerCase().includes("unable to") ||
      content.toLowerCase().includes("not supported") ||
      content.toLowerCase().includes("outside the scope") ||
      content.toLowerCase().includes("i can't")) {
    return {
      isValid: true,
      errors: [],
      warnings: [{ field: "response", message: "This appears to be a refusal response (negative example)", severity: "warning" }],
    };
  }

  // Try to parse as JSON
  let parsed: ExtraHopApiRequest;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      isValid: false,
      errors: [{ field: "response", message: `Invalid JSON: ${(e as Error).message}`, severity: "error" }],
      warnings: [],
    };
  }

  // Validate required fields
  if (!parsed.metric_category) {
    errors.push({ field: "metric_category", message: "Missing required field: metric_category", severity: "error" });
  } else if (!VALID_METRIC_CATEGORIES.includes(parsed.metric_category as any)) {
    warnings.push({ 
      field: "metric_category", 
      message: `Unknown metric_category: "${parsed.metric_category}". Valid categories: ${VALID_METRIC_CATEGORIES.slice(0, 5).join(", ")}...`, 
      severity: "warning" 
    });
  }

  if (!parsed.object_type) {
    errors.push({ field: "object_type", message: "Missing required field: object_type", severity: "error" });
  } else if (!VALID_OBJECT_TYPES.includes(parsed.object_type as any)) {
    errors.push({ 
      field: "object_type", 
      message: `Invalid object_type: "${parsed.object_type}". Valid types: ${VALID_OBJECT_TYPES.join(", ")}`, 
      severity: "error" 
    });
  }

  if (!parsed.metric_specs) {
    errors.push({ field: "metric_specs", message: "Missing required field: metric_specs", severity: "error" });
  } else if (!Array.isArray(parsed.metric_specs)) {
    errors.push({ field: "metric_specs", message: "metric_specs must be an array", severity: "error" });
  } else if (parsed.metric_specs.length === 0) {
    errors.push({ field: "metric_specs", message: "metric_specs array cannot be empty", severity: "error" });
  } else {
    // Validate each metric spec
    parsed.metric_specs.forEach((spec, index) => {
      if (!spec.name) {
        errors.push({ 
          field: `metric_specs[${index}].name`, 
          message: `Metric spec at index ${index} is missing required field: name`, 
          severity: "error" 
        });
      } else {
        // Check if metric is valid for the category
        const categoryMetrics = METRICS_BY_CATEGORY[parsed.metric_category];
        if (categoryMetrics && !categoryMetrics.includes(spec.name)) {
          warnings.push({
            field: `metric_specs[${index}].name`,
            message: `Metric "${spec.name}" may not be valid for category "${parsed.metric_category}"`,
            severity: "warning"
          });
        }
      }

      // Validate calc_type if present
      if (spec.calc_type && !["mean", "max", "min", "sum", "count", "percentile"].includes(spec.calc_type)) {
        errors.push({
          field: `metric_specs[${index}].calc_type`,
          message: `Invalid calc_type: "${spec.calc_type}"`,
          severity: "error"
        });
      }

      // Validate percentile if calc_type is percentile
      if (spec.calc_type === "percentile" && (spec.percentile === undefined || spec.percentile < 0 || spec.percentile > 100)) {
        errors.push({
          field: `metric_specs[${index}].percentile`,
          message: "percentile must be between 0 and 100 when calc_type is 'percentile'",
          severity: "error"
        });
      }
    });
  }

  // Validate optional fields
  if (parsed.cycle && !VALID_CYCLES.includes(parsed.cycle as any)) {
    warnings.push({
      field: "cycle",
      message: `Unknown cycle value: "${parsed.cycle}". Valid cycles: ${VALID_CYCLES.join(", ")}`,
      severity: "warning"
    });
  }

  // Validate time range format
  if (parsed.from) {
    if (!isValidTimeRange(parsed.from)) {
      warnings.push({
        field: "from",
        message: `Time range "${parsed.from}" may not be in expected format (e.g., "-30m", "-1h", "-24h", or ISO timestamp)`,
        severity: "warning"
      });
    }
  }

  if (parsed.until) {
    if (!isValidTimeRange(parsed.until)) {
      warnings.push({
        field: "until",
        message: `Time range "${parsed.until}" may not be in expected format`,
        severity: "warning"
      });
    }
  }

  // Validate object_ids if present
  if (parsed.object_ids) {
    if (!Array.isArray(parsed.object_ids)) {
      errors.push({ field: "object_ids", message: "object_ids must be an array", severity: "error" });
    } else {
      parsed.object_ids.forEach((id, index) => {
        if (typeof id !== "number" || !Number.isInteger(id) || id < 0) {
          errors.push({
            field: `object_ids[${index}]`,
            message: `Invalid object_id at index ${index}: must be a positive integer`,
            severity: "error"
          });
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    parsedResponse: errors.length === 0 ? parsed : undefined,
  };
}

/**
 * Check if a time range string is valid
 */
function isValidTimeRange(value: string): boolean {
  // Relative time formats: -30m, -1h, -24h, -7d
  const relativePattern = /^-\d+[smhd]$/;
  if (relativePattern.test(value)) return true;

  // Special values
  if (value === "0" || value === "now") return true;

  // ISO timestamp
  const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
  if (isoPattern.test(value)) return true;

  // Unix timestamp (milliseconds)
  if (/^\d{13}$/.test(value)) return true;

  return false;
}

/**
 * Get validation status color
 */
export function getValidationStatusColor(result: ValidationResult): string {
  if (!result.isValid) return "text-red-400 bg-red-500/20 border-red-500/30";
  if (result.warnings.length > 0) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
  return "text-green-400 bg-green-500/20 border-green-500/30";
}

/**
 * Get validation status label
 */
export function getValidationStatusLabel(result: ValidationResult): string {
  if (!result.isValid) return "Invalid";
  if (result.warnings.length > 0) return "Valid (warnings)";
  return "Valid";
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const messages: string[] = [];
  
  result.errors.forEach(err => {
    messages.push(`❌ ${err.field}: ${err.message}`);
  });
  
  result.warnings.forEach(warn => {
    messages.push(`⚠️ ${warn.field}: ${warn.message}`);
  });
  
  return messages.join("\n");
}
