/**
 * Demo Data - Datasets
 * 
 * Mock dataset catalog and quality metrics for demo/development purposes.
 * Only used when DEMO_MODE is enabled in config.ts
 */

export interface DemoDataset {
  id: string;
  name: string;
  type: "Instruction" | "Code" | "Preference" | "Conversation";
  format: "JSONL" | "Parquet" | "CSV" | "JSON";
  samples: number;
  size: string;
  quality: number;
  status: "validated" | "processing" | "pending";
  lastModified: string;
}

export const DEMO_DATASETS: DemoDataset[] = [
  {
    id: "custom-instruct-v1",
    name: "Custom Instruct Dataset v1",
    type: "Instruction",
    format: "JSONL",
    samples: 125000,
    size: "2.4 GB",
    quality: 94.2,
    status: "validated",
    lastModified: "2024-12-19",
  },
  {
    id: "dolly-15k",
    name: "Databricks Dolly 15k",
    type: "Instruction",
    format: "JSONL",
    samples: 15011,
    size: "48 MB",
    quality: 89.5,
    status: "validated",
    lastModified: "2024-12-15",
  },
  {
    id: "code-alpaca",
    name: "Code Alpaca 20k",
    type: "Code",
    format: "JSONL",
    samples: 20022,
    size: "156 MB",
    quality: 91.8,
    status: "validated",
    lastModified: "2024-12-10",
  },
  {
    id: "preference-v1",
    name: "DPO Preference Dataset",
    type: "Preference",
    format: "Parquet",
    samples: 45000,
    size: "890 MB",
    quality: 87.3,
    status: "processing",
    lastModified: "2024-12-20",
  },
];

export interface DemoQualityMetrics {
  totalSamples: number;
  validatedSamples: number;
  duplicateRate: number;
  avgTokenLength: number;
  languageDistribution: { lang: string; percent: number }[];
}

export const DEMO_QUALITY_METRICS: DemoQualityMetrics = {
  totalSamples: 205033,
  validatedSamples: 192856,
  duplicateRate: 2.3,
  avgTokenLength: 847,
  languageDistribution: [
    { lang: "English", percent: 78 },
    { lang: "Code", percent: 15 },
    { lang: "Other", percent: 7 },
  ],
};

export const DEMO_PREPROCESSING_STAGES = [
  { id: 1, name: "Text Normalization", status: "active" as const },
  { id: 2, name: "Deduplication", status: "active" as const },
  { id: 3, name: "Quality Filtering", status: "running" as const },
  { id: 4, name: "Tokenization", status: "pending" as const },
];
