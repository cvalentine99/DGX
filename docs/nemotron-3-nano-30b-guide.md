# NVIDIA Nemotron-3-Nano-30B-A3B User Guide

## Model Overview

**Model Developer:** NVIDIA Corporation  
**Model Dates:** September 2025 - December 2025  
**License:** NVIDIA Open Model License Agreement (Commercial use ready)

### Description

Nemotron-3-Nano-30B-A3B-BF16 is a large language model (LLM) trained from scratch by NVIDIA, designed as a unified model for both reasoning and non-reasoning tasks. It responds to user queries and tasks by first generating a reasoning trace and then concluding with a final response.

### Architecture

- **Architecture Type:** Mamba2-Transformer Hybrid Mixture of Experts (MoE)
- **Network Architecture:** Nemotron Hybrid MoE
- **Total Parameters:** 30B
- **Active Parameters:** 3.5B per token
- **Layers:** 23 Mamba-2 + MoE layers, 6 Attention layers
- **Experts:** 128 experts + 1 shared expert per MoE layer, 6 experts activated per token

### Supported Languages

English, German, Spanish, French, Italian, and Japanese

### Context Length

- Default: 256K tokens
- Maximum: 1M tokens
- Recommended for most use cases: 128K tokens

---

## Reasoning Format

The model's reasoning capabilities can be configured through the `enable_thinking` flag in the chat template:

- **`enable_thinking=True`** (default): Model generates reasoning traces before final response
- **`enable_thinking=False`**: Model provides direct answers without reasoning traces

### Reasoning Budget Control

For API usage, you can control reasoning with the `reasoning_budget` parameter:

```python
response = client.chat.completions.create(
    model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
    messages=messages,
    reasoning_budget=32,  # Control reasoning depth
    max_tokens=512,
    temperature=1.0,
    top_p=1.0
)
```

---

## vLLM Deployment

### Requirements

- vLLM 0.12.0 or later (0.11.2 also supported)
- Docker with GPU support
- HuggingFace token for model download

### Pull Docker Image

```bash
# On x86_64 systems:
docker pull --platform linux/amd64 vllm/vllm-openai:v0.12.0
docker tag vllm/vllm-openai:v0.12.0 vllm/vllm-openai:deploy
```

### Run Docker Container

```bash
docker run -e HF_TOKEN="$HF_TOKEN" -e HF_HOME="$HF_HOME" \
  --ipc=host --gpus all \
  --entrypoint "/bin/bash" --rm -it vllm/vllm-openai:deploy
```

### Launch vLLM Server

```bash
# Supported dtypes: FP8, BF16
DTYPE="BF16"

if [ "$DTYPE" = "FP8" ]; then
    KV_CACHE_DTYPE="fp8"
    export VLLM_USE_FLASHINFER_MOE_FP8=1
    export VLLM_FLASHINFER_MOE_BACKEND=throughput
else
    KV_CACHE_DTYPE="auto"
fi

vllm serve nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-$DTYPE \
  --trust-remote-code \
  --async-scheduling \
  --kv-cache-dtype $KV_CACHE_DTYPE \
  --tensor-parallel-size 1 \
  --host 0.0.0.0 \
  --port 8000
```

---

## Configuration Parameters

### Server Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `host` | 127.0.0.1 | IP address of the server |
| `port` | 8000 | Port to listen on |
| `kv-cache-dtype` | auto | KV cache data type (use "fp8" for FP8 model) |
| `async-scheduling` | - | Enable async scheduling for best performance |

### Tunable Parameters

| Parameter | Description |
|-----------|-------------|
| `tensor-parallel-size` | Number of GPUs for inference |
| `max-num-seqs` | Maximum sequences per batch (default: 1024) |
| `max-model-len` | Maximum total tokens per request |
| `mamba-ssm-cache-dtype` | Mamba SSM cache dtype (float32 for accuracy, float16 for performance) |

---

## API Usage

### OpenAI-Compatible Endpoint

Once vLLM server is running, use the OpenAI-compatible API:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="not-needed"
)

# With reasoning enabled
response = client.chat.completions.create(
    model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
    messages=[
        {"role": "user", "content": "Solve: What is 15% of 240?"}
    ],
    temperature=1.0,
    top_p=1.0,
    max_tokens=1024
)

print(response.choices[0].message.content)
```

### Streaming Response

```python
stream = client.chat.completions.create(
    model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    stream=True,
    max_tokens=512
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

---

## Benchmark Performance (H200 GPU)

| Metric | Value |
|--------|-------|
| Output token throughput | 15,828 tok/s |
| Total token throughput | 31,656 tok/s |
| Median TTFT | 1,534 ms |
| Median TPOT | 61 ms |
| Median ITL | 52 ms |

---

## Reasoning Benchmark Results

| Task | Nemotron-3-Nano-30B-A3B |
|------|-------------------------|
| MMLU-Pro | 78.3 |
| AIME25 (no tools) | 89.1 |
| AIME25 (with tools) | 99.2 |
| GPQA (no tools) | 73.0 |
| GPQA (with tools) | 75.0 |
| LiveCodeBench | 68.3 |
| MiniF2F pass@1 | 50.0 |
| MiniF2F pass@32 | 79.9 |
| SWE-Bench (OpenHands) | 38.8 |
| TauBench V2 (Airline) | 48.0 |
| TauBench V2 (Retail) | 56.9 |

---

## Best Practices

### For Reasoning Tasks
- Use `temperature=1.0` and `top_p=1.0`
- Enable thinking mode for complex problems
- Allow sufficient `max_tokens` for reasoning traces

### For Tool Calling
- Use lower `temperature` and `top_p` values
- Disable thinking mode for faster responses

### For Production Deployment
- Use FP8 quantization for better throughput
- Set `max-num-seqs` to match expected concurrency
- Enable `async-scheduling` for best performance

---

## Sources

- [vLLM Recipes - Nemotron-3-Nano-30B-A3B](https://docs.vllm.ai/projects/recipes/en/latest/NVIDIA/Nemotron-3-Nano-30B-A3B.html)
- [HuggingFace Model Card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16)
- [NVIDIA Nemotron Developer Portal](https://developer.nvidia.com/nemotron)
