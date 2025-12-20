import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { recordInferenceRequest } from "./db";

// vLLM Configuration
interface VLLMConfig {
  apiUrl: string;
  apiKey?: string;
  model: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  enableReasoning: boolean;
}

// Default configuration - will be overridden by environment variables
const getConfig = (): VLLMConfig => ({
  apiUrl: process.env.VLLM_API_URL || "http://192.168.50.139:8000/v1",
  apiKey: process.env.VLLM_API_KEY || "",
  model: process.env.VLLM_MODEL || "/models/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8",
  defaultTemperature: 1.0,
  defaultMaxTokens: 2048,
  enableReasoning: true,
});

// Message schema matching OpenAI format
const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

// Chat completion request schema
const chatCompletionRequestSchema = z.object({
  messages: z.array(messageSchema),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(32768).optional(),
  topP: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional().default(false),
  enableThinking: z.boolean().optional().default(true),
  reasoningBudget: z.number().min(0).max(1024).optional(),
  stopSequences: z.array(z.string()).optional(),
});

// Response types
interface ChatCompletionChoice {
  index: number;
  message: {
    role: "assistant";
    content: string;
    reasoning_content?: string;
  };
  finish_reason: "stop" | "length" | "tool_calls" | null;
}

interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
  };
}

// Parse reasoning content from response
function parseReasoningContent(content: string): { reasoning: string; answer: string } {
  // Nemotron uses <think>...</think> tags for reasoning
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  
  if (thinkMatch) {
    const reasoning = thinkMatch[1].trim();
    const answer = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    return { reasoning, answer };
  }
  
  // Alternative format: reasoning before final answer marker
  const answerMarker = content.indexOf("**Final Answer:**");
  if (answerMarker !== -1) {
    return {
      reasoning: content.slice(0, answerMarker).trim(),
      answer: content.slice(answerMarker).trim(),
    };
  }
  
  return { reasoning: "", answer: content };
}

// Make request to vLLM server
async function callVLLM(
  config: VLLMConfig,
  messages: Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    enableThinking?: boolean;
    reasoningBudget?: number;
    stopSequences?: string[];
  }
): Promise<ChatCompletionResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  
  // Build request body
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? config.defaultTemperature,
    max_tokens: options.maxTokens ?? config.defaultMaxTokens,
    top_p: options.topP ?? 1.0,
  };
  
  if (options.stopSequences && options.stopSequences.length > 0) {
    body.stop = options.stopSequences;
  }
  
  // Add reasoning budget if specified (Nemotron-specific)
  if (options.reasoningBudget !== undefined) {
    body.reasoning_budget = options.reasoningBudget;
  }
  
  try {
    const response = await fetch(`${config.apiUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`vLLM API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as ChatCompletionResponse;
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to call vLLM: ${error.message}`);
    }
    throw error;
  }
}

// Simulated response for when vLLM is not available
function getSimulatedResponse(
  messages: Array<{ role: string; content: string }>,
  enableThinking: boolean
): ChatCompletionResponse {
  const lastMessage = messages[messages.length - 1];
  const query = lastMessage?.content || "";
  
  let content: string;
  let reasoningContent: string | undefined;
  
  if (enableThinking) {
    reasoningContent = `<think>
Analyzing the user's query: "${query.slice(0, 100)}..."

Step 1: Identify the intent
The user is asking about ${query.includes("API") ? "API usage" : query.includes("train") ? "training" : "general information"}.

Step 2: Gather relevant context
Based on the available documentation and training data...

Step 3: Formulate response
I should provide a clear, helpful answer based on the Nemotron-3-Nano documentation.
</think>`;
    
    content = `${reasoningContent}

I understand you're asking about "${query.slice(0, 50)}...". 

**Note:** This is a simulated response. The vLLM server is not currently connected. To enable live inference:

1. Pull the recommended NVIDIA vLLM container with DGX Spark support:
   \`\`\`bash
   docker pull nvcr.io/nvidia/vllm:25.11
   \`\`\`

2. Start vLLM server on your DGX Spark:
   \`\`\`bash
   docker run --gpus all -p 8001:8000 \\
     -v /path/to/models:/models \\
     nvcr.io/nvidia/vllm:25.11 \\
     --model /models/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8 \\
     --host 0.0.0.0
   \`\`\`

3. Expose via ngrok and configure VLLM_API_URL in Settings → Secrets

**Recommended Container:** nvcr.io/nvidia/vllm:25.11
- Native DGX Spark/Blackwell GB10 support
- CUDA 13.0 compatibility
- NVFP4 4-bit and FP8 precision

Once connected, I'll provide real responses from your Nemotron-3-Nano model!`;
  } else {
    content = `This is a simulated response. Configure VLLM_API_URL to connect to your DGX Spark vLLM server for live inference.`;
  }
  
  const { reasoning, answer } = parseReasoningContent(content);
  
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "simulated-nemotron-3-nano",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: answer,
        reasoning_content: reasoning || undefined,
      },
      finish_reason: "stop",
    }],
    usage: {
      prompt_tokens: query.length / 4,
      completion_tokens: content.length / 4,
      total_tokens: (query.length + content.length) / 4,
      reasoning_tokens: reasoning ? reasoning.length / 4 : 0,
    },
  };
}

export const vllmRouter = router({
  // Get current configuration (without sensitive data)
  getConfig: publicProcedure.query(() => {
    const config = getConfig();
    return {
      apiUrl: config.apiUrl,
      model: config.model,
      defaultTemperature: config.defaultTemperature,
      defaultMaxTokens: config.defaultMaxTokens,
      enableReasoning: config.enableReasoning,
      isConfigured: !!config.apiUrl && config.apiUrl.includes("localhost:8001"),
    };
  }),

  // Check vLLM server health
  healthCheck: publicProcedure.query(async () => {
    const config = getConfig();
    
    try {
      const response = await fetch(`${config.apiUrl}/models`, {
        method: "GET",
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });
      
      if (response.ok) {
        const data = await response.json() as { data: Array<{ id: string }> };
        return {
          status: "connected",
          models: data.data?.map((m: { id: string }) => m.id) || [],
          endpoint: config.apiUrl,
        };
      }
      
      return {
        status: "error",
        message: `Server returned ${response.status}`,
        endpoint: config.apiUrl,
      };
    } catch (error) {
      return {
        status: "disconnected",
        message: error instanceof Error ? error.message : "Connection failed",
        endpoint: config.apiUrl,
      };
    }
  }),

  // Chat completion (non-streaming)
  chatCompletion: publicProcedure
    .input(chatCompletionRequestSchema)
    .mutation(async ({ input }) => {
      const config = getConfig();
      const startTime = Date.now();
      
      // Check if vLLM is configured and available
      try {
        const healthResponse = await fetch(`${config.apiUrl}/models`, {
          method: "GET",
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        
        if (healthResponse.ok) {
          // Call actual vLLM server
          const response = await callVLLM(config, input.messages, {
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            topP: input.topP,
            enableThinking: input.enableThinking,
            reasoningBudget: input.reasoningBudget,
            stopSequences: input.stopSequences,
          });
          
          // Parse reasoning content if present
          const content = response.choices[0]?.message?.content || "";
          const { reasoning, answer } = parseReasoningContent(content);
          
          // Log inference request to database
          const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
          recordInferenceRequest({
            model: config.model,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            latencyMs: Date.now() - startTime,
            success: 1,
          });
          
          return {
            ...response,
            choices: response.choices.map(choice => ({
              ...choice,
              message: {
                ...choice.message,
                content: answer,
                reasoning_content: reasoning || undefined,
              },
            })),
            simulated: false,
          };
        }
      } catch {
        // Fall through to simulated response
      }
      
      // Return simulated response
      return {
        ...getSimulatedResponse(input.messages, input.enableThinking ?? true),
        simulated: true,
      };
    }),

  // RAG-augmented chat completion
  ragChatCompletion: publicProcedure
    .input(z.object({
      messages: z.array(messageSchema),
      ragContext: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(1).max(32768).optional(),
      enableThinking: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const config = getConfig();
      
      // Build system message with RAG context
      const systemMessage = input.ragContext
        ? {
            role: "system" as const,
            content: `You are a helpful AI assistant for the NeMo Command Center. Use the following context to answer questions accurately:

${input.ragContext}

When answering:
1. Reference the provided context when relevant
2. If the context doesn't contain the answer, say so
3. Be precise and technical when discussing APIs or configurations
4. For ExtraHop Metrics API queries, provide the exact JSON structure needed`,
          }
        : {
            role: "system" as const,
            content: `You are a helpful AI assistant for the NeMo Command Center, specialized in:
- NVIDIA Nemotron-3-Nano-30B model deployment and usage
- ExtraHop Metrics API integration
- Network analysis and troubleshooting
- vLLM inference server configuration`,
          };
      
      const messagesWithContext = [systemMessage, ...input.messages];
      
      try {
        const healthResponse = await fetch(`${config.apiUrl}/models`, {
          method: "GET",
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        
        if (healthResponse.ok) {
          const response = await callVLLM(config, messagesWithContext, {
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            enableThinking: input.enableThinking,
          });
          
          const content = response.choices[0]?.message?.content || "";
          const { reasoning, answer } = parseReasoningContent(content);
          
          return {
            ...response,
            choices: response.choices.map(choice => ({
              ...choice,
              message: {
                ...choice.message,
                content: answer,
                reasoning_content: reasoning || undefined,
              },
            })),
            simulated: false,
            ragEnabled: !!input.ragContext,
          };
        }
      } catch {
        // Fall through to simulated response
      }
      
      return {
        ...getSimulatedResponse(messagesWithContext, input.enableThinking ?? true),
        simulated: true,
        ragEnabled: !!input.ragContext,
      };
    }),

  // Get available models from vLLM server
  listModels: publicProcedure.query(async () => {
    const config = getConfig();
    
    try {
      const response = await fetch(`${config.apiUrl}/models`, {
        method: "GET",
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json() as { data: Array<{ id: string; owned_by: string }> };
        return {
          models: data.data || [],
          connected: true,
        };
      }
      
      return { models: [], connected: false };
    } catch {
      return { models: [], connected: false };
    }
  }),

  // Test connection with a simple prompt
  testConnection: publicProcedure
    .input(z.object({
      prompt: z.string().default("Hello, please respond with 'Connection successful!'"),
    }))
    .mutation(async ({ input }) => {
      const config = getConfig();
      const startTime = Date.now();
      
      try {
        const response = await callVLLM(config, [
          { role: "user", content: input.prompt }
        ], {
          maxTokens: 50,
          temperature: 0.1,
        });
        
        const latency = Date.now() - startTime;
        
        return {
          success: true,
          response: response.choices[0]?.message?.content || "",
          latency,
          model: response.model,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Connection failed",
          latency: Date.now() - startTime,
        };
      }
    }),
});
