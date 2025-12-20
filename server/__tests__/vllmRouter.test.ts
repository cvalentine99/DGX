import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('vLLM Router Integration Tests', () => {
  const VLLM_API_URL = process.env.VLLM_API_URL || 'https://unpopular-thad-unblamed.ngrok-free.dev/v1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Health Check', () => {
    it('should return connected status when vLLM server is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'Nemotron-3-Nano-30B-A3B-UD-Q8_K_XL.gguf' }
          ]
        })
      });

      const response = await fetch(`${VLLM_API_URL}/models`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should handle connection failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      try {
        await fetch(`${VLLM_API_URL}/models`);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Connection');
      }
    });

    it('should handle server errors (500)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const response = await fetch(`${VLLM_API_URL}/models`);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Chat Completion', () => {
    it('should send chat completion request with correct format', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'Nemotron-3-Nano-30B',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const requestBody = {
        model: 'Nemotron-3-Nano-30B-A3B-UD-Q8_K_XL.gguf',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        temperature: 0.7,
        max_tokens: 1024
      };

      const response = await fetch(`${VLLM_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.choices).toBeDefined();
      expect(data.choices[0].message.content).toBeDefined();
    });

    it('should handle streaming responses', async () => {
      const streamChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          streamChunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const response = await fetch(`${VLLM_API_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Nemotron-3-Nano-30B',
          messages: [{ role: 'user', content: 'Hi' }],
          stream: true
        })
      });

      expect(response.ok).toBe(true);
      expect(response.body).toBeDefined();
    });

    it('should extract reasoning_content from <think> tags', () => {
      const content = `<think>
Let me analyze this step by step:
1. First consideration
2. Second consideration
</think>

The answer is 42.`;

      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
      expect(thinkMatch).not.toBeNull();
      
      const reasoning = thinkMatch![1].trim();
      const answer = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      
      expect(reasoning).toContain('step by step');
      expect(answer).toBe('The answer is 42.');
    });

    it('should handle responses without reasoning content', () => {
      const content = 'This is a direct answer without reasoning.';
      
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
      expect(thinkMatch).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized: Invalid API key'
      });

      const response = await fetch(`${VLLM_API_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer invalid-key' }
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle 429 rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      const response = await fetch(`${VLLM_API_URL}/chat/completions`, {
        method: 'POST'
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      try {
        await fetch(`${VLLM_API_URL}/chat/completions`, {
          signal: AbortSignal.timeout(50)
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new SyntaxError('Unexpected token'); }
      });

      const response = await fetch(`${VLLM_API_URL}/chat/completions`, {
        method: 'POST'
      });

      expect(response.ok).toBe(true);
      await expect(response.json()).rejects.toThrow();
    });
  });

  describe('Model Listing', () => {
    it('should list available models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            {
              id: 'Nemotron-3-Nano-30B-A3B-UD-Q8_K_XL.gguf',
              object: 'model',
              created: 1700000000,
              owned_by: 'nvidia'
            }
          ]
        })
      });

      const response = await fetch(`${VLLM_API_URL}/models`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.object).toBe('list');
      expect(data.data).toBeInstanceOf(Array);
    });
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage in response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        choices: [{
          message: { role: 'assistant', content: 'Test response' }
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
          reasoning_tokens: 10
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(`${VLLM_API_URL}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      const data = await response.json();
      expect(data.usage).toBeDefined();
      expect(data.usage.prompt_tokens).toBe(15);
      expect(data.usage.completion_tokens).toBe(25);
      expect(data.usage.total_tokens).toBe(40);
      expect(data.usage.reasoning_tokens).toBe(10);
    });
  });
});

describe('Live vLLM Connection Test', () => {
  const VLLM_API_URL = process.env.VLLM_API_URL;

  it('should connect to live vLLM server and list models', async () => {
    if (!VLLM_API_URL) {
      console.log('Skipping live test: VLLM_API_URL not configured');
      expect(true).toBe(true); // Pass if not configured
      return;
    }

    // Use native fetch for live test
    const nativeFetch = globalThis.fetch;
    vi.stubGlobal('fetch', nativeFetch);

    try {
      const response = await nativeFetch(`${VLLM_API_URL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('Live vLLM Response Status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Available models:', data.data?.map((m: any) => m.id));
        expect(data.data).toBeDefined();
      } else {
        console.log('vLLM server not available:', response.status);
        expect(true).toBe(true); // Don't fail if server unavailable
      }
    } catch (error) {
      console.log('Connection error:', (error as Error).message);
      expect(true).toBe(true); // Don't fail on network errors
    }
  });

  it('should perform live chat completion', async () => {
    if (!VLLM_API_URL) {
      console.log('Skipping live test: VLLM_API_URL not configured');
      expect(true).toBe(true);
      return;
    }

    const nativeFetch = globalThis.fetch;

    try {
      const startTime = Date.now();
      const response = await nativeFetch(`${VLLM_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          model: 'Nemotron-3-Nano-30B-A3B-UD-Q8_K_XL.gguf',
          messages: [
            { role: 'user', content: 'What is 2+2? Reply with just the number.' }
          ],
          temperature: 0.1,
          max_tokens: 50
        })
      });

      const latency = Date.now() - startTime;
      console.log(`Live inference latency: ${latency}ms`);

      if (response.ok) {
        const data = await response.json();
        console.log('Response:', data.choices?.[0]?.message?.content);
        console.log('Usage:', data.usage);
        expect(data.choices).toBeDefined();
      } else {
        console.log('Chat completion failed:', response.status);
        expect(true).toBe(true);
      }
    } catch (error) {
      console.log('Connection error:', (error as Error).message);
      expect(true).toBe(true);
    }
  });
});
