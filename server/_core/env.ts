/**
 * Environment Variable Configuration with Strict Validation
 * 
 * Uses zod to validate required environment variables at startup.
 * Fails fast with clear error messages if critical vars are missing.
 */

import { z } from "zod";

// Schema for required environment variables
const envSchema = z.object({
  // Database - REQUIRED in production
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").refine(
    (url) => url.startsWith("mysql://") || url.startsWith("mysql2://"),
    "DATABASE_URL must be a MySQL connection string (mysql://...)"
  ),
  
  // Authentication - REQUIRED in production
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  
  // Host identification - defaults to beta
  LOCAL_HOST: z.enum(["alpha", "beta"]).default("beta"),
  
  // App configuration
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  VITE_APP_ID: z.string().optional().default(""),
  
  // OAuth (optional in dev)
  OAUTH_SERVER_URL: z.string().optional().default(""),
  OWNER_OPEN_ID: z.string().optional().default(""),
  
  // Forge API (optional)
  BUILT_IN_FORGE_API_URL: z.string().optional().default(""),
  BUILT_IN_FORGE_API_KEY: z.string().optional().default(""),
  
  // SSH Configuration for remote DGX host
  DGX_SSH_HOST: z.string().optional().default(""),
  DGX_SSH_PORT: z.string().optional().default("22"),
  DGX_SSH_USERNAME: z.string().optional().default(""),
  DGX_SSH_PASSWORD: z.string().optional().default(""),
  DGX_SSH_PRIVATE_KEY: z.string().optional().default(""),
  
  // External APIs (optional)
  NGC_API_KEY: z.string().optional().default(""),
  HUGGINGFACE_TOKEN: z.string().optional().default(""),
  VLLM_API_URL: z.string().optional().default("http://localhost:8001/v1"),
  VLLM_API_KEY: z.string().optional().default(""),
  
  // WebRTC TURN server (optional)
  TURN_SERVER_URL: z.string().optional().default(""),
  TURN_SERVER_USERNAME: z.string().optional().default(""),
  TURN_SERVER_CREDENTIAL: z.string().optional().default(""),
  
  // Demo mode
  VITE_DEMO_MODE: z.string().optional().default("false"),
});

// Validate environment variables
function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";
  
  // In development, allow missing DATABASE_URL and JWT_SECRET
  if (!isProduction) {
    // Set defaults for development
    if (!process.env.DATABASE_URL) {
      console.warn("[ENV] DATABASE_URL not set, using development default");
      process.env.DATABASE_URL = "mysql://root:root@localhost:3306/nemo_dev";
    }
    if (!process.env.JWT_SECRET) {
      console.warn("[ENV] JWT_SECRET not set, using development default (NOT SECURE)");
      process.env.JWT_SECRET = "dev-secret-not-for-production-use-only";
    }
  }
  
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error("❌ Environment validation failed:");
    const zodError = result.error;
    for (const issue of zodError.issues) {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    }
    
    if (isProduction) {
      console.error("\n🛑 Cannot start in production mode with invalid environment.");
      console.error("   Please set all required environment variables.");
      process.exit(1);
    } else {
      console.warn("\n⚠️  Running in development mode with incomplete environment.");
    }
  }
  
  return result.data || envSchema.parse(process.env);
}

const validatedEnv = validateEnv();

// Export validated environment
export const ENV = {
  appId: validatedEnv.VITE_APP_ID || "",
  cookieSecret: validatedEnv.JWT_SECRET,
  databaseUrl: validatedEnv.DATABASE_URL,
  oAuthServerUrl: validatedEnv.OAUTH_SERVER_URL || "",
  ownerOpenId: validatedEnv.OWNER_OPEN_ID || "",
  isProduction: validatedEnv.NODE_ENV === "production",
  forgeApiUrl: validatedEnv.BUILT_IN_FORGE_API_URL || "",
  forgeApiKey: validatedEnv.BUILT_IN_FORGE_API_KEY || "",
  localHost: validatedEnv.LOCAL_HOST,
  demoMode: validatedEnv.VITE_DEMO_MODE === "true",
  
  // SSH config
  ssh: {
    host: validatedEnv.DGX_SSH_HOST || "",
    port: parseInt(validatedEnv.DGX_SSH_PORT || "22", 10),
    username: validatedEnv.DGX_SSH_USERNAME || "",
    password: validatedEnv.DGX_SSH_PASSWORD || "",
    privateKey: validatedEnv.DGX_SSH_PRIVATE_KEY || "",
  },
  
  // External APIs
  ngcApiKey: validatedEnv.NGC_API_KEY || "",
  huggingfaceToken: validatedEnv.HUGGINGFACE_TOKEN || "",
  vllmApiUrl: validatedEnv.VLLM_API_URL || "http://localhost:8001/v1",
  vllmApiKey: validatedEnv.VLLM_API_KEY || "",
  
  // WebRTC
  turn: {
    url: validatedEnv.TURN_SERVER_URL || "",
    username: validatedEnv.TURN_SERVER_USERNAME || "",
    credential: validatedEnv.TURN_SERVER_CREDENTIAL || "",
  },
};

// Log configuration summary (without secrets)
if (validatedEnv.NODE_ENV !== "test") {
  console.log("[ENV] Configuration loaded:");
  console.log(`   - NODE_ENV: ${validatedEnv.NODE_ENV}`);
  console.log(`   - LOCAL_HOST: ${validatedEnv.LOCAL_HOST}`);
  console.log(`   - DATABASE_URL: ${validatedEnv.DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`   - SSH configured: ${validatedEnv.DGX_SSH_HOST ? "yes" : "no"}`);
  console.log(`   - Demo mode: ${validatedEnv.VITE_DEMO_MODE}`);
}
