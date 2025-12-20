# Training Data Generator & Agent Pipeline Integration

- [x] Add Training Data Generator component to Data module
- [x] Create trainingData tRPC router with playbook/generate/export endpoints
- [x] Implement ExtraHop Metrics API derivation logic
- [x] Add playbook definitions for network triage scenarios
- [x] Create ValidationPanel component for training data quality
- [ ] Integrate agent pipeline tools (capinfos, tshark, yara, etc.)

# vLLM Integration

- [x] Configure vLLM endpoint settings (environment variables)
- [x] Create backend API route for vLLM inference
- [x] Update Interaction module frontend to use live API
- [x] Add response support with reasoning_content
- [x] Implement thinking mode for chain-of-thought reasoning
- [ ] Write vitest tests for vLLM integration (pending vLLM server connection)

# RAG System for Training Data & Documentation

- [x] Research Nemotron-3-Nano-30B documentation and user guides
- [x] Create RAG backend with document indexing (TF-IDF)
- [x] Implement similarity search for document retrieval
- [x] Build document upload and management API
- [x] Create Knowledge Base interface in Command Center
- [x] Pre-load Nemotron documentation into RAG
- [x] Integrate RAG context into inference requests

# Holoscan 3.9 Integration

- [x] Research Holoscan 3.9 SDK features and capabilities
- [x] Create Holoscan page with pipeline management interface
- [x] Add sensor/camera input visualization
- [x] Add pipeline graph visualization
- [x] Add Holoscan to sidebar navigation
- [x] Test Holoscan tab integration
