import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";

// Playbook definitions based on ExtraHop Metrics API
const PLAYBOOKS = [
  {
    id: "slow_database",
    name: "Slow Database Investigation",
    category: "db_server",
    description: "Diagnose database latency issues - network vs server",
    metrics: ["tprocess", "rtt", "error", "req", "rsp"],
    objectType: "device",
    queryTemplates: [
      "The {db_name} database is slow. Is it the network or the server?",
      "Why is the {db_name} DB dragging?",
      "Check database latency for {db_name}",
      "Investigate slow queries on {db_name}",
      "What's causing high response times on {db_name}?",
    ],
  },
  {
    id: "http_errors",
    name: "Web Application Error Hunt",
    category: "http_server",
    description: "Identify source of HTTP errors and failing URIs",
    metrics: ["rsp", "error", "rsp_error", "req", "status_code"],
    objectType: "device",
    queryTemplates: [
      "We're seeing a spike in 500 errors on {app_name}. Which URIs are failing?",
      "What's causing HTTP errors on {app_name}?",
      "Show me error rates for {app_name} by URI",
      "Investigate 4xx/5xx errors on the {app_name} server",
      "Which endpoints are returning errors on {app_name}?",
    ],
  },
  {
    id: "ssl_audit",
    name: "Security Hygiene Audit",
    category: "ssl_server",
    description: "Detect weak encryption or expired certificates",
    metrics: ["expired_cert", "weak_cipher", "self_signed", "session", "version"],
    objectType: "device",
    queryTemplates: [
      "Audit our internal servers for expired SSL certificates",
      "Check for weak ciphers across the environment",
      "Find self-signed certificates in production",
      "Show TLS/SSL security issues",
      "Which servers have certificate problems?",
    ],
  },
  {
    id: "network_congestion",
    name: "Network Congestion Analysis",
    category: "tcp",
    description: "Identify packet loss or capacity issues",
    metrics: ["retx_out", "retx_in", "zwnd_out", "zwnd_in", "rto", "nagle"],
    objectType: "device",
    queryTemplates: [
      "Check for network congestion indicators across the data center",
      "Show TCP retransmissions for {device_name}",
      "Are there zero window conditions affecting {device_name}?",
      "Investigate packet loss on the network",
      "What's causing TCP performance issues?",
    ],
  },
  {
    id: "threat_detection",
    name: "Threat Intelligence Analysis",
    category: "ssl_server",
    description: "Detect connections to known threat indicators",
    metrics: ["threat_connected", "threat_bytes_out", "threat_bytes_in", "req_threat_host", "req_threat_uri"],
    objectType: "device",
    queryTemplates: [
      "Show connections to known threat indicators",
      "Are any devices communicating with malicious IPs?",
      "Check for threat intelligence hits",
      "Investigate suspicious outbound connections",
      "Which hosts have threat indicator matches?",
    ],
  },
  {
    id: "dns_analysis",
    name: "DNS Performance Analysis",
    category: "dns_server",
    description: "Analyze DNS query patterns and errors",
    metrics: ["req", "rsp", "rsp_code", "record_type", "tprocess"],
    objectType: "device",
    queryTemplates: [
      "Show DNS query failures and their causes",
      "What's the DNS response time for {dns_server}?",
      "Check for NXDOMAIN responses",
      "Analyze DNS traffic patterns",
      "Which DNS queries are failing?",
    ],
  },
  {
    id: "voip_quality",
    name: "VoIP Quality Analysis",
    category: "sip",
    description: "Monitor SIP/VoIP call quality metrics",
    metrics: ["req", "rsp", "error", "session", "rtt"],
    objectType: "device",
    queryTemplates: [
      "Check VoIP call quality metrics",
      "Show SIP errors and failures",
      "What's affecting call quality?",
      "Investigate VoIP latency issues",
      "Are there SIP registration problems?",
    ],
  },
  {
    id: "ldap_auth",
    name: "LDAP Authentication Analysis",
    category: "ldap_server",
    description: "Monitor LDAP authentication performance",
    metrics: ["req", "rsp", "error", "tprocess", "bind"],
    objectType: "device",
    queryTemplates: [
      "Check LDAP authentication performance",
      "Show LDAP bind failures",
      "What's causing slow LDAP responses?",
      "Investigate authentication delays",
      "Are there LDAP server issues?",
    ],
  },
  {
    id: "dhcp_health",
    name: "DHCP Health Check",
    category: "dhcp_server",
    description: "Monitor DHCP lease and assignment health",
    metrics: ["req", "rsp", "error", "ack", "nak"],
    objectType: "device",
    queryTemplates: [
      "Check DHCP server health",
      "Show DHCP lease failures",
      "Are devices getting IP addresses?",
      "Investigate DHCP NAK responses",
      "What's the DHCP response time?",
    ],
  },
  {
    id: "storage_ops",
    name: "Storage Operations Analysis",
    category: "nas",
    description: "Monitor NFS/CIFS storage performance",
    metrics: ["req", "rsp", "error", "tprocess", "bytes_in", "bytes_out"],
    objectType: "device",
    queryTemplates: [
      "Check storage server performance",
      "Show NFS/CIFS latency",
      "What's causing slow file operations?",
      "Investigate storage throughput",
      "Are there storage access errors?",
    ],
  },
  {
    id: "site_tcp_overview",
    name: "Site TCP Overview",
    category: "tcp",
    description: "Site-wide TCP performance metrics",
    metrics: ["conn", "bytes_in", "bytes_out", "retx_pkts", "rtt"],
    objectType: "capture",
    queryTemplates: [
      "Show site-wide TCP statistics",
      "What's the overall network throughput?",
      "Check total connections across the site",
      "Show bandwidth utilization",
      "What's the aggregate TCP performance?",
    ],
  },
];

// Negative example templates (queries the agent cannot fulfill)
const NEGATIVE_TEMPLATES = [
  {
    query: "Show me the CPU temperature of the database server",
    reasoning: "The ExtraHop API provides wire data metrics (L2-L7). It does not monitor physical hardware stats like CPU temperature. I cannot fulfill this request.",
  },
  {
    query: "What's the disk space on the web server?",
    reasoning: "ExtraHop monitors network traffic, not host-level metrics like disk space. This requires a different monitoring tool.",
  },
  {
    query: "Show me the 'Happiness Score' of the web server",
    reasoning: "There is no metric named 'Happiness Score'. The closest valid metrics for web server performance are rsp_code (Errors) or tprocess (Latency).",
  },
  {
    query: "Check the memory usage on the application server",
    reasoning: "Memory usage is a host-level metric not available through wire data analysis. ExtraHop can show application-layer metrics like response times and error rates.",
  },
  {
    query: "Show me the process list on the server",
    reasoning: "Process information requires host-level access. ExtraHop provides network-based visibility into application behavior, not OS-level details.",
  },
];

// Time range options
const TIME_RANGES = ["-5m", "-15m", "-30m", "-1h", "-6h", "-24h"];

// Variable substitutions
const VARIABLES = {
  db_name: ["inventory-db", "user-db", "orders-db", "analytics-db", "auth-db"],
  app_name: ["payment-gateway", "api-server", "web-frontend", "auth-service", "checkout"],
  device_name: ["dc1-server-01", "prod-web-01", "db-primary", "app-server-03", "cache-01"],
  dns_server: ["dns-primary", "dns-secondary", "ad-dc01", "resolver-01"],
};

// Generate reasoning content based on derivation rules
function generateReasoning(playbook: typeof PLAYBOOKS[0], metrics: string[]): string {
  const lines = [
    `Analyzing the query to determine the appropriate ExtraHop API call.`,
    ``,
    `**Step 1: Identify Target**`,
    `The query relates to ${playbook.name.toLowerCase()}, targeting ${playbook.objectType === "device" ? "a specific device" : "site-wide metrics"}.`,
    ``,
    `**Step 2: Derive Category**`,
    `Based on the protocol/service type, the metric_category is "${playbook.category}".`,
    ``,
    `**Step 3: Select Metrics**`,
    `Relevant metrics for this analysis: ${metrics.map(m => `"${m}"`).join(", ")}.`,
    ``,
    `**Step 4: Construct API Call**`,
    `Using object_type="${playbook.objectType}" with the derived category and metrics.`,
  ];
  return lines.join("\n");
}

// Generate API call JSON
function generateApiCall(playbook: typeof PLAYBOOKS[0], metrics: string[], timeRange: string): object {
  return {
    metric_category: playbook.category,
    object_type: playbook.objectType,
    metric_specs: metrics.map(name => ({ name })),
    object_ids: [0],
    cycle: "auto",
    from: timeRange,
    until: "0",
  };
}

// Substitute variables in template
function substituteVariables(template: string): string {
  let result = template;
  for (const [key, values] of Object.entries(VARIABLES)) {
    const pattern = new RegExp(`\\{${key}\\}`, "g");
    if (pattern.test(result)) {
      const randomValue = values[Math.floor(Math.random() * values.length)];
      result = result.replace(pattern, randomValue);
    }
  }
  return result;
}

// Generate a single training example
function generateExample(playbook: typeof PLAYBOOKS[0], index: number): {
  id: string;
  playbook: string;
  category: string;
  messages: { role: "user" | "assistant"; content: string; reasoning_content?: string }[];
  metadata: { timeRange: string; metrics: string[]; objectType: string; generatedAt: string };
} {
  const template = playbook.queryTemplates[Math.floor(Math.random() * playbook.queryTemplates.length)];
  const query = substituteVariables(template);
  const timeRange = TIME_RANGES[Math.floor(Math.random() * TIME_RANGES.length)];
  
  // Select 2-4 random metrics from the playbook
  const numMetrics = Math.min(2 + Math.floor(Math.random() * 3), playbook.metrics.length);
  const shuffled = [...playbook.metrics].sort(() => Math.random() - 0.5);
  const selectedMetrics = shuffled.slice(0, numMetrics);
  
  const reasoning = generateReasoning(playbook, selectedMetrics);
  const apiCall = generateApiCall(playbook, selectedMetrics, timeRange);
  
  return {
    id: `${playbook.id}-${index.toString().padStart(4, "0")}`,
    playbook: playbook.id,
    category: playbook.category,
    messages: [
      { role: "user", content: query },
      {
        role: "assistant",
        reasoning_content: reasoning,
        content: JSON.stringify(apiCall),
      },
    ],
    metadata: {
      timeRange,
      metrics: selectedMetrics,
      objectType: playbook.objectType,
      generatedAt: new Date().toISOString(),
    },
  };
}

// Generate negative example
function generateNegativeExample(index: number): ReturnType<typeof generateExample> {
  const template = NEGATIVE_TEMPLATES[Math.floor(Math.random() * NEGATIVE_TEMPLATES.length)];
  
  return {
    id: `negative-${index.toString().padStart(4, "0")}`,
    playbook: "negative",
    category: "none",
    messages: [
      { role: "user", content: template.query },
      {
        role: "assistant",
        reasoning_content: template.reasoning,
        content: JSON.stringify({ error: "Cannot fulfill request", reason: template.reasoning }),
      },
    ],
    metadata: {
      timeRange: "N/A",
      metrics: [],
      objectType: "none",
      generatedAt: new Date().toISOString(),
    },
  };
}

export const trainingDataRouter = router({
  // Get available playbooks
  getPlaybooks: publicProcedure.query(() => {
    return PLAYBOOKS.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      templatesCount: p.queryTemplates.length,
      metricsCount: p.metrics.length,
    }));
  }),

  // Get stats
  getStats: publicProcedure.query(() => {
    const totalQueryTemplates = PLAYBOOKS.reduce((sum, p) => sum + p.queryTemplates.length, 0);
    const totalMetrics = new Set(PLAYBOOKS.flatMap(p => p.metrics)).size;
    const estimatedCombinations = totalQueryTemplates * Object.values(VARIABLES).reduce((p, v) => p * v.length, 1) * TIME_RANGES.length;
    
    return {
      playbooks: PLAYBOOKS.length,
      totalQueryTemplates,
      totalMetrics,
      estimatedCombinations,
    };
  }),

  // Generate training data
  generate: publicProcedure
    .input(z.object({
      count: z.number().min(10).max(1000),
      playbooks: z.array(z.string()).optional(),
      includeNegatives: z.boolean().default(true),
      negativeRatio: z.number().min(0).max(0.5).default(0.1),
    }))
    .mutation(({ input }) => {
      const { count, playbooks: selectedPlaybooks, includeNegatives, negativeRatio } = input;
      
      // Filter playbooks if specified
      const activePlaybooks = selectedPlaybooks?.length
        ? PLAYBOOKS.filter(p => selectedPlaybooks.includes(p.id))
        : PLAYBOOKS;
      
      if (activePlaybooks.length === 0) {
        throw new Error("No valid playbooks selected");
      }
      
      // Calculate positive and negative counts
      const negativeCount = includeNegatives ? Math.floor(count * negativeRatio) : 0;
      const positiveCount = count - negativeCount;
      
      // Generate positive examples
      const examples: ReturnType<typeof generateExample>[] = [];
      const examplesPerPlaybook = Math.ceil(positiveCount / activePlaybooks.length);
      
      let index = 0;
      for (const playbook of activePlaybooks) {
        for (let i = 0; i < examplesPerPlaybook && examples.length < positiveCount; i++) {
          examples.push(generateExample(playbook, index++));
        }
      }
      
      // Generate negative examples
      for (let i = 0; i < negativeCount; i++) {
        examples.push(generateNegativeExample(i));
      }
      
      // Shuffle examples
      examples.sort(() => Math.random() - 0.5);
      
      // Calculate stats
      const stats = {
        total: examples.length,
        positive: positiveCount,
        negative: negativeCount,
        byPlaybook: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
      };
      
      for (const ex of examples) {
        stats.byPlaybook[ex.playbook] = (stats.byPlaybook[ex.playbook] || 0) + 1;
        stats.byCategory[ex.category] = (stats.byCategory[ex.category] || 0) + 1;
      }
      
      return {
        examples,
        stats,
        format: "augmented_chatml",
        generatedAt: new Date().toISOString(),
      };
    }),

  // Export training data
  export: publicProcedure
    .input(z.object({
      examples: z.array(z.any()),
      format: z.enum(["jsonl", "json", "chatml"]),
    }))
    .mutation(({ input }) => {
      const { examples, format } = input;
      
      if (format === "jsonl") {
        return examples.map(ex => JSON.stringify({ messages: ex.messages })).join("\n");
      } else if (format === "chatml") {
        return examples.map(ex => ({
          messages: ex.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            ...(m.reasoning_content && { reasoning_content: m.reasoning_content }),
          })),
        }));
      } else {
        return { examples: examples.map(ex => ({ messages: ex.messages })) };
      }
    }),

  // Validate examples against schema
  validate: publicProcedure
    .input(z.object({
      examples: z.array(z.any()),
    }))
    .mutation(({ input }) => {
      const results = {
        total: input.examples.length,
        valid: 0,
        invalid: 0,
        errors: [] as { id: string; error: string }[],
      };
      
      for (const ex of input.examples) {
        try {
          // Check message structure
          if (!ex.messages || !Array.isArray(ex.messages) || ex.messages.length < 2) {
            throw new Error("Invalid message structure");
          }
          
          // Check user message
          if (ex.messages[0].role !== "user" || !ex.messages[0].content) {
            throw new Error("Invalid user message");
          }
          
          // Check assistant message
          if (ex.messages[1].role !== "assistant" || !ex.messages[1].content) {
            throw new Error("Invalid assistant message");
          }
          
          // Try to parse JSON content (if not a negative example)
          if (ex.playbook !== "negative") {
            const parsed = JSON.parse(ex.messages[1].content);
            if (!parsed.metric_category || !parsed.object_type || !parsed.metric_specs) {
              throw new Error("Missing required API fields");
            }
          }
          
          results.valid++;
        } catch (err) {
          results.invalid++;
          results.errors.push({
            id: ex.id,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
      
      return results;
    }),
});
