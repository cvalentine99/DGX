import { describe, it, expect } from 'vitest';

describe('vLLM Endpoint Validation via ngrok', () => {
  const VLLM_API_URL = process.env.VLLM_API_URL;

  it('should have VLLM_API_URL configured with ngrok URL', () => {
    expect(VLLM_API_URL).toBeDefined();
    expect(VLLM_API_URL).toContain('ngrok');
    console.log('vLLM API URL:', VLLM_API_URL);
  });

  it('should connect to vLLM server via ngrok and list models', async () => {
    if (!VLLM_API_URL) {
      throw new Error('VLLM_API_URL not configured');
    }

    const response = await fetch(`${VLLM_API_URL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    console.log('Response status:', response.status);
    
    // vLLM should respond with 200 OK
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    console.log('vLLM Models Response:', JSON.stringify(data, null, 2));
    
    // Check that we have models available
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    
    // Log available models
    console.log('Available models:', data.data.map((m: any) => m.id));
  });
});
