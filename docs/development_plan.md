# Engineering Development Plan

## YouTube Chatbot 2.0: Modular RAG & Multimodal Platform

---

### 1. Architectural Principles & Engineering Standards

The development of YouTube Chatbot follows the production-grade Machine Learning Systems engineering standard. The codebase is organized into discrete layers: configuration management, utility functions, processing components, end-to-end orchestration pipelines, API service endpoints, and user interfaces.

Key architectural tenets:
- **Separation of Concerns**: Business logic, data ingestion, vector indexing, and generation logic exist in isolated modules within `src/components/`. Pipelines within `src/pipelines/` compose these components without containing low-level implementation details.
- **Configuration as Code**: Hyperparameters, model identifiers, retrieval weights, and paths are centrally declared in `src/config/config.yaml` and validated via Pydantic/dataclasses in `src/config/configuration.py`.
- **Fail-Safe Graceful Degradation**: If secondary services (e.g., DuckDuckGo search or primary LLM models) face rate limits or network issues, the system falls back seamlessly to offline transcripts and secondary fallback models (`gemini-1.5-flash`).
- **Emoji-Free Codebase**: All logging, docstrings, UI elements, and API messages adhere strictly to clean, academic, and professional communication standards without decorative iconography.

---

### 2. Technology Stack

| Layer | Technology | Purpose & Selection Rationale |
|---|---|---|
| Backend Framework | FastAPI 0.104+ / Uvicorn | Async I/O, OpenAPI documentation, native Server-Sent Events (SSE) streaming support |
| LLM Provider | Google Gemini 2.5 Flash | High context window, 2025/2026 instruction tuning, ultra-low latency, fallback to Gemini 1.5 Flash |
| Dense Embeddings | `all-MiniLM-L6-v2` / `text-embedding-004` | 384-dim local SentenceTransformers for zero-cost offline embedding + Google Cloud embedding support |
| Vector Storage | FAISS (CPU) | High-throughput in-memory similarity search with serialization to local disk |
| Lexical Retrieval | Rank-BM25 | Keyword and exact phrase scoring to counterbalance vector semantic drift |
| Transcript Extraction | YouTube Transcript API | Reliable subtitle extraction with multi-language fallback and timestamp preservation |
| Web Search Agent | DuckDuckGo Search (ddg) | Zero-API-key web grounding for external queries |
| Evaluation Suite | Ragas & Scikit-Learn | Automated scoring of Faithfulness, Relevancy, Precision, and Recall |
| Frontend UI | Vanilla HTML5 / Vanilla CSS3 / Modern ES6 | Zero-dependency, lightweight, high-performance UI avoiding bloated JS build pipelines |
| Iconography | Lucide Icons (Vanilla script) | Consistent, scalable vector icons without emoji pollution |
| Browser Extension | Chrome Extension Manifest V3 | Secure service-worker architecture compatible with Chrome, Brave, and Edge |
| Testing & Validation | Pytest / Pytest-Asyncio | Automated testing covering ingestion, transformation, retrieval, and API contracts |

---

### 3. Phased Implementation Roadmap

```
Phase 1: Ingestion & Validation
        │
Phase 2: Indexing & Staged Retrieval
        │
Phase 3: Generation & Citations
        │
Phase 4: FastAPI Server & SSE Streaming
        │
Phase 5: Split-Screen Web UI & 4-Color System
        │
Phase 6: Manifest V3 Browser Extension
        │
Phase 7: Ragas Triad Evaluation Suite
        │
Phase 8: Hardening & Automated Testing
```

#### Phase 1: Data Ingestion and Validation
- **Objective**: Extract transcripts and metadata from YouTube URLs while preserving temporal boundaries.
- **Deliverables**:
  - `src/utils/common.py`: Robust regex URL parser extracting 11-character video IDs across all known YouTube URL formats.
  - `src/components/data_ingestion.py`: Subtitle scraper querying official subtitles first, falling back to auto-generated subtitles across English language codes.
  - `src/components/data_validation.py`: Schema validation ensuring transcripts meet length constraints and contain valid non-empty text.
  - `src/components/data_transformation.py`: Sentence-aware sliding chunker that groups text into ~800 character windows with 150 character overlap while maintaining accurate start and end timestamps.

#### Phase 2: Indexing and Staged Hybrid Retrieval
- **Objective**: Implement multi-stage retrieval combining semantic vector search and sparse keyword matching.
- **Deliverables**:
  - `src/components/indexing.py`: Builds local FAISS indices and BM25 token indices per video. Serializes indices to `models/{video_id}/` for instant warm reload.
  - `src/components/retrieval.py`:
    - *Stage 1*: Metadata pre-filter scoping queries to active video context.
    - *Stage 2*: Reciprocal Rank Fusion (RRF) combining dense search ($0.65$ weight) and BM25 scoring ($0.35$ weight).
    - *Stage 3*: Contextual deduplication and relevance thresholding ($>0.30$ similarity score).

#### Phase 3: Augmentation, Generation, and Citations
- **Objective**: Ground LLM synthesis in retrieved chunks and enforce timestamp citations.
- **Deliverables**:
  - `src/components/augmentation.py`: Structured prompt builder wrapping retrieved chunks with exact timestamps `[MM:SS]` and strict anti-hallucination instructions.
  - `src/components/generator.py`: Google GenAI integration supporting synchronous responses and token-by-token streaming via Python generators. Automatic fallback to `gemini-1.5-flash` on quota exhaustion.
  - Citation parser guaranteeing all answer claims reference valid timestamp intervals.

#### Phase 4: Application Server and Streaming Endpoints
- **Objective**: Expose pipeline capabilities via high-throughput REST and streaming interfaces.
- **Deliverables**:
  - `app/api.py`:
    - `POST /api/ingest`: Initiates ingestion and vector indexing; generates structured video summary and suggested questions.
    - `POST /api/chat`: Non-streaming conversation endpoint.
    - `POST /api/chat/stream`: SSE streaming endpoint providing real-time token delivery and retrieval metadata headers.
    - `POST /api/evaluate`: Triggers on-demand RAG Triad evaluation.
    - `GET /api/transcript/{video_id}`: Retrieves full timestamped transcript segments for client-side search.
    - `GET /api/health`: Exposes system status, active models, and cache size.
  - `app/schemas.py`: Pydantic request and response models enforcing rigorous type safety.

#### Phase 5: Web UI and 4-Color Obsidian Design System
- **Objective**: Build an authoritative, responsive frontend optimized for split-screen research.
- **Deliverables**:
  - `app/static/index.html`: Semantic HTML structure featuring hero showcase, split-screen workspace, video player, chat thread, transcript search, and evaluation modal.
  - `app/static/style.css`: Unified 4-color palette (Obsidian, White, YouTube Red, Soft Emerald). Interactive glassmorphic styling, responsive flexbox/grid layout, and zero emoji clutter.
  - `app/static/app.js`: State manager handling SSE stream decoding, `localStorage` persistence for multi-chat sessions and draggable splitter dimensions, YouTube Iframe API playback controls, and live keyword filtering.

#### Phase 6: Browser Extension (Manifest V3)
- **Objective**: Enable zero-friction video chatting directly on YouTube pages.
- **Deliverables**:
  - `extension/manifest.json`: Manifest V3 compliant configuration with host permissions for `youtube.com` and backend API origins.
  - `extension/content.js`: Injects a floating action trigger or side panel on YouTube video pages.
  - `extension/background.js`: Service worker handling extension lifecycle and context menus.
  - `extension/popup.html` & `popup.js`: Standalone popup interface mirroring the core chat capabilities.

#### Phase 7: Evaluation Framework and RAG Triad HUD
- **Objective**: Continuously benchmark and verify retrieval and generation fidelity.
- **Deliverables**:
  - `src/components/evaluation.py`: Computes Faithfulness (claim verification against retrieved context), Answer Relevancy (semantic similarity of answer to query), Context Precision (signal-to-noise ratio in retrieved context), and Context Recall.
  - `src/pipelines/evaluation_pipeline.py`: Orchestrates automated test queries and persists evaluation logs in `outputs/`.
  - Frontend evaluation HUD modal with progress bars and diagnostic metric cards.

#### Phase 8: Testing, Hardening, and CI/CD
- **Objective**: Ensure regression resistance and repeatable deployments.
- **Deliverables**:
  - Automated test suite in `tests/` covering API contracts, transcript ingestion, chunking algorithms, hybrid retrieval weighting, and RAG pipelines.
  - `Dockerfile`: Multi-stage, security-hardened container specification with non-root user execution.
  - Git hygiene: Continuous version control synchronization with clear commit semantics.

#### Phase 9: Interactive Demo Notebook & Performance Benchmarking
- **Objective**: Deliver a self-contained, reproducible Jupyter demonstration and evaluation suite.
- **Deliverables**:
  - `01_YouTube_Chatbot_System_Demo.ipynb`: 10-module end-to-end interactive notebook demonstrating subtitle extraction, dual indexing, hybrid RRF retrieval, live web search fallback, and quantitative RAG Triad benchmarking.
  - `notebooks/01_YouTube_Chatbot_System_Demo.ipynb`: Standalone copy organized in the `notebooks/` directory.
  - `run_demo_notebook.py`: Headless batch execution script utilizing the custom `youtube-chatbot-venv` kernel.
  - Visual Analytics Dashboard: Embedded Matplotlib and Seaborn figures (RAG Triad Radar, Archetype Performance, Latency Breakdown, Knowledge Density Timeline Map).

---

### 4. Quality Assurance and Testing Strategy

1. **Unit Testing**:
   - `tests/test_ingestion.py`: Verifies URL normalization, subtitle extraction error handling, and chunk boundary accuracy.
   - `tests/test_retrieval.py`: Tests dense FAISS lookup, BM25 scoring, and RRF rank combination logic.
2. **Integration Testing**:
   - `tests/test_rag_pipeline.py`: Runs end-to-end question-answering with mocked LLM generation to test retrieval-augmentation cohesion.
   - `tests/test_api.py`: Validates FastAPI route responses, status codes, input validation rejections, and health telemetry.
3. **Frontend DOM & Persistence Testing**:
   - Node.js scripts utilizing `jsdom` or headless automation verifying `localStorage` read/write cycles, splitter dragging boundaries, and card ordering symmetry.

---

### 5. Deployment and Operations

- **Local Execution**:
  ```bash
  python -m uvicorn app.api:app --host 127.0.0.1 --port 8000 --reload
  ```
- **Container Deployment**:
  ```bash
  docker build -t youtube-chatbot:2.0.0 .
  docker run -p 8000:8000 --env-file .env youtube-chatbot:2.0.0
  ```
- **Resource Profiling**:
  - Memory: ~450MB baseline RSS (FAISS + SentenceTransformers CPU).
  - CPU: Lightweight inference; indexing consumes brief CPU burst during chunk embedding.
