# Training Data Generator Test Results

## Test Date: 2025-12-20

## Generation Results
- **Total Examples Generated**: 100
- **Positive Examples**: 90 (valid API queries)
- **Negative Examples**: 10 (queries agent should refuse)
- **Playbooks Covered**: 11

## Distribution by Playbook
- slow_database: 9
- ssl_audit: 9
- dhcp_health: 9
- voip_quality: 9
- network_congestion: 9
- storage_ops: 9
- http_errors: 9
- ldap_auth: 9
- dns_analysis: 9
- threat_detection: 9
- negative: 10

## Example Preview: slow_database-0003

### User Query
"Check database latency for inventory-db"

### Reasoning (Chain-of-Thought)
```
Analyzing the query to determine the appropriate ExtraHop API call.

**Step 1: Identify Target**
The query relates to slow database investigation, targeting a specific device.

**Step 2: Derive Category**
Based on the protocol/service type, the metric_category is "db_server".

**Step 3: Select Metrics**
Relevant metrics for this analysis: "req", "rtt".

**Step 4: Construct API Call**
Using object_type="device" with the derived category and metrics.
```

### Response (API Call JSON)
```json
{
  "metric_category": "db_server",
  "object_type": "device",
  "metric_specs": [
    { "name": "req" },
    { "name": "rtt" }
  ],
  "object_ids": [0],
  "cycle": "auto",
  "from": "-6h",
  "until": "0"
}
```

### Metadata
- Category: db_server
- Time Range: -6h
- Object Type: device

## Status
✅ Training Data Generator working correctly
✅ Backend tRPC routes functional
✅ Playbook definitions loaded
✅ Example preview with reasoning_content working
