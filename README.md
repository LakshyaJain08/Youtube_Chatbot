# YouTube Chatbot 2.0
> **Production-Grade LLM Video Chatbot with Staged Hybrid RAG, Gemini 2.5 Flash, Timestamp Citations & Browser Extension.**

---

## Highlights & Key Features

1. **Staged Hybrid Filtering & Low Latency**:
   - **Stage 1 (Metadata Pre-filtering)**: Automatically pre-filters chunks strictly by `video_id` and optional timestamp ranges, eliminating context window pollution.
   - **Stage 2 (Hybrid Search)**: Dense Vector Search (FAISS) fused with Sparse Lexical Search (BM25) via **Reciprocal Rank Fusion (RRF)** ($0.65 \times \text{Dense} + 0.35 \text{BM25}$).
   - **Stage 3 (Contextual Compression)**: Trims noise and optimizes prompt token count for ultra-low latency ($<300\text{ms}$ retrieval) and minimal API costs.
2. **Interactive Video Player & Clickable Citations**:
   - Synchronized YouTube video player.
   - Every answer claim is cited with timestamp badges (e.g. `[04:15]`). Clicking any timestamp seeks the video player to that exact second immediately.
3. **Evaluation Suite (Ragas & Metrics)**:
   - Automated evaluation for **Faithfulness**, **Answer Relevancy**, **Context Precision**, and **Context Recall**.
4. **Manifest V3 Browser Extension**:
   - Chat directly with any YouTube video inside Chrome, Brave, or Edge.
5. **Production Architecture**:
   - Modular architecture adhering to the End-to-End ML project standard (`src/components/`, `src/pipelines/`, `src/utils/`, `src/config/`, `app/`, `extension/`, `tests/`).
6. **Containerization & Observability**:
   - Multi-stage Docker build with automated testing and non-root security.
   - Runtime health checks (`/api/health`), system telemetry (`/api/monitoring`), and Prometheus metric exposition (`/metrics`).

---

## Repository Structure

```
├── app/
│   ├── api.py                       # FastAPI server (REST & SSE Streaming)
│   ├── schemas.py                   # Pydantic request/response models
│   └── static/                      # Modern glassmorphic Web UI
│       ├── index.html
│       ├── style.css
│       └── app.js
├── docs/                            # Professional engineering documentation
│   ├── prd.md                       # Product Requirements Document
│   ├── development_plan.md          # Development Plan
│   ├── requirements.md              # Software Requirements Specification
│   ├── ui_ux_design.md              # UI/UX Design System
│   └── architecture.md              # System Architecture Specification
├── src/
│   ├── components/
│   │   ├── data_ingestion.py        # Subtitle extraction & oEmbed metadata
│   │   ├── data_validation.py       # Input & schema validators
│   │   ├── data_transformation.py   # Timestamp-preserving chunking
│   │   ├── indexing.py              # FAISS + BM25 indexing & disk cache
│   │   ├── retrieval.py             # Staged Hybrid Retrieval + Query rewriting
│   │   ├── augmentation.py          # Grounded prompt templates
│   │   ├── generator.py             # Gemini LLM generation & citations
│   │   └── evaluation.py            # Ragas & quality evaluation metrics
│   ├── pipelines/
│   │   ├── ingestion_pipeline.py    # Ingest -> Validate -> Transform -> Index
│   │   ├── rag_pipeline.py          # Hybrid Retrieve -> Augment -> Generate
│   │   └── evaluation_pipeline.py   # Benchmark evaluation runner
│   ├── utils/
│   │   ├── common.py                # URL parser & timestamp converters
│   │   ├── logger.py                # Structured logging
│   │   └── exceptions.py            # Custom exception hierarchy
│   └── config/
│       ├── config.yaml              # Hyperparameters & model configs
│       ├── configuration.py         # Config manager
│       └── schema.yaml              # Data schemas
├── extension/                       # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html / popup.css / popup.js
│   ├── content.js
│   ├── background.js
│   └── icons/
├── tests/                           # Pytest automated test suite
├── notebooks/                       # Exploratory & experimentation notebooks
├── data/                            # Cached transcripts & chunks
├── models/                          # Serialized FAISS vector stores
├── outputs/                         # Benchmark reports & evaluation logs
├── Dockerfile                       # Multi-stage production container
├── docker-compose.yml               # Container orchestration specification
├── requirements.txt
├── .dockerignore
├── .env.example
└── setup.py
```

---

## Quickstart Guide

### 1. Installation

```bash
# Clone the repository and navigate into the folder
cd "Youtube Chatbot"

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file from `.env.example`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run the Application

```bash
# Start FastAPI web server
python -m uvicorn app.api:app --host 127.0.0.1 --port 8000 --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser.

---

## Docker Deployment & Orchestration

### Using Docker Compose (Recommended)

Run the containerized service with automated health checks and resource limits:

```bash
# Start service in detached mode
docker compose up -d --build

# Verify container status and health
docker compose ps

# Follow application logs
docker compose logs -f
```

### Manual Docker Build

```bash
# Build multi-stage image (validates test suite before building runtime)
docker build -t youtube-chatbot:latest .

# Run container with volume persistence
docker run -d -p 8000:8000 \
  -e GEMINI_API_KEY=your_key_here \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/logs:/app/logs \
  --name youtube-chatbot \
  youtube-chatbot:latest
```

---

## Observability, Health & Telemetry

The application provides three built-in endpoints for monitoring:

1. **Liveness & Readiness Probe**: `GET /api/health`
   - Validates service health, uptime, memory consumption (RSS in MB), cached index count, and total requests.
2. **Monitoring Dashboard**: `GET /api/monitoring`
   - Returns system platform info, CPU and memory utilization, endpoint request distribution, and AI engine status.
3. **Prometheus Metrics**: `GET /metrics`
   - Plain-text Prometheus format exposing gauges and counters (`app_uptime_seconds`, `app_memory_rss_bytes`, `app_requests_total`, `app_errors_total`, `app_cached_retrievers`).

---

## Installing the Browser Extension

1. Open Chrome/Brave/Edge and navigate to `chrome://extensions/`
2. Toggle on **Developer mode** (top right).
3. Click **Load unpacked** (top left).
4. Select the `extension/` folder in this project directory.
5. Open any YouTube video, click the extension icon, and chat directly with the video.

---

## Running Automated Tests

```bash
pytest tests/ -v
```

