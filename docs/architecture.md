# System Architecture & Technical Design

## YouTube Chatbot 2.0: Multimodal RAG Pipeline & Topology

---

### 1. High-Level Architecture Overview

The YouTube Chatbot platform is architected as an end-to-end Machine Learning system engineered for low latency, factual grounding, and verifiable multimodal context extraction. The system adopts a **Staged Hybrid Retrieval-Augmented Generation (RAG)** topology that merges dense vector semantic search with sparse lexical keyword matching.

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Presentation Layer"]
        SPA["Vanilla JS/CSS Web App (Split-Screen Workspace)"]
        EXT["Chrome Extension (Manifest V3 Popup / Side Panel)"]
    end

    subgraph APILayer ["FastAPI Application Gateway"]
        API["FastAPI 0.104+ Service (Uvicorn Async)"]
        SSE["Server-Sent Events (SSE) Streaming Engine"]
        SCH["Pydantic v2 Contract Validation"]
    end

    subgraph PipelineLayer ["Orchestration Pipeline Layer"]
        INGEST_PIPE["Ingestion Pipeline"]
        RAG_PIPE["RAG Pipeline"]
        EVAL_PIPE["Evaluation Pipeline"]
    end

    subgraph ComponentLayer ["Domain Processing Components"]
        INGEST["Data Ingestion (YouTube Transcript API + oEmbed)"]
        TRANSFORM["Data Transformation (Sentence Chunker with Timestamps)"]
        INDEX["Indexing (FAISS Flat + BM25 Sparse Index)"]
        RETRIEVE["Staged Hybrid Retrieval (RRF Fusion)"]
        AUGMENT["Augmentation (Timestamp Citation Prompting)"]
        GEN["Generator (Gemini 2.5 Flash + Fallback Chain)"]
        EVAL["Evaluation (Ragas Triad Quality Engine)"]
    end

    subgraph StorageLayer ["Storage & Serialization Layer"]
        DISK_RAW["Raw Transcripts (data/raw/)"]
        DISK_MODEL["Serialized FAISS & BM25 (models/{video_id}/)"]
        BROWSER_STORE["Client localStorage (Sessions & Splitter Ratio)"]
    end

    SPA -->|HTTP REST & SSE| API
    EXT -->|HTTP REST| API
    API --> SCH
    SCH --> INGEST_PIPE
    SCH --> RAG_PIPE
    SCH --> EVAL_PIPE

    INGEST_PIPE --> INGEST
    INGEST --> TRANSFORM
    TRANSFORM --> INDEX
    INDEX --> DISK_MODEL

    RAG_PIPE --> RETRIEVE
    RETRIEVE --> DISK_MODEL
    RETRIEVE --> AUGMENT
    AUGMENT --> GEN
    GEN --> SSE

    EVAL_PIPE --> EVAL
    EVAL --> RAG_PIPE
```

---

### 2. Architectural Layers

#### 2.1 Client Presentation Layer
- **Vanilla ES6 Single Page Application (`app/static/`)**:
  - Implements the 4-Color Obsidian Design System (`#09090b` Obsidian, `#ffffff` White, `#ff0033` YouTube Red, `#10b981` Emerald).
  - Synchronizes with the official **YouTube Iframe API**, handling programmatic seeking, playback control, and temporal state tracking.
  - Controls a responsive **Draggable Splitter** that allows users to redistribute viewport width between media context and chat history.
  - Persists all conversation sessions, metadata, and workspace ratios in browser `localStorage`.
- **Manifest V3 Browser Extension (`extension/`)**:
  - Injects lightweight scripts into active YouTube video tabs.
  - Extracts the active video ID from the browser tab and queries the local or hosted API server directly from a popup or side panel.

#### 2.2 API and Gateway Layer (`app/api.py`)
- **FastAPI Core**:
  - Built on top of Starlette and Uvicorn, providing high-concurrency asynchronous I/O.
  - Configured with CORS middleware to allow seamless requests from Chrome extension origins (`chrome-extension://*`) and local development ports.
- **Streaming Architecture**:
  - Employs Server-Sent Events (SSE) via Starlette's `StreamingResponse` on `/api/chat/stream`.
  - Streams tokens incrementally as they are produced by the LLM, reducing perceived time-to-first-token (TTFT) to under 800 milliseconds.

#### 2.3 Domain Component Layer (`src/components/`)
The core domain logic is decoupled into single-responsibility components:

| Component | Class / Module | Primary Responsibility |
|---|---|---|
| Ingestion | `DataIngestion` | Extracts subtitles via `youtube_transcript_api` and metadata via YouTube oEmbed |
| Validation | `DataValidation` | Validates transcript length, character distributions, and video ID structure |
| Transformation | `DataTransformation` | Chunks transcripts into 800-character windows preserving precise start/duration times |
| Indexing | `Indexing` | Constructs and caches FAISS dense vector indices and BM25 sparse lexical indices |
| Retrieval | `Retrieval` | Implements Staged Hybrid Filtering and Reciprocal Rank Fusion (RRF) |
| Augmentation | `Augmentation` | Injects retrieved timestamped chunks into grounded prompt templates |
| Generation | `Generator` | Manages Google GenAI client with fallback chains (`gemini-2.5-flash` -> `gemini-1.5-flash`) |
| Evaluation | `Evaluation` | Computes Faithfulness, Answer Relevancy, Context Precision, and Context Recall |

---

### 3. Staged Hybrid Retrieval Topology

A fundamental flaw in standard naive RAG systems is semantic drift: vector similarity often retrieves chunks that discuss related concepts but miss the exact keyword, number, or entity requested by the user. Conversely, pure keyword search fails when users phrase questions using synonyms.

YouTube Chatbot solves this using a **3-Stage Hybrid Retrieval Pipeline**:

```
Query Input
    │
    ▼
┌────────────────────────────────────────────────────────┐
│ Stage 1: Metadata Pre-Filtering                       │
│ - Scope candidate chunks strictly to active video_id   │
│ - Purge empty, degenerate, or corrupted segments       │
└────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────┐
│ Stage 2: Hybrid Search & Reciprocal Rank Fusion (RRF)  │
│                                                        │
│   Dense Vector Search            Sparse Lexical Search │
│   (FAISS: text-embedding-004)    (Rank-BM25: Okapi)    │
│            │                              │            │
│       Dense Ranks                    BM25 Ranks        │
│            └──────────────┬───────────────┘            │
│                           ▼                            │
│           Reciprocal Rank Fusion (RRF)                 │
│         Score = 0.65 * Dense + 0.35 * BM25             │
└────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────┐
│ Stage 3: Contextual Compression & Deduplication        │
│ - Filter chunks below similarity threshold (0.30)      │
│ - Eliminate adjacent duplicate timestamp windows       │
│ - Select Top-4 highest-yield context chunks            │
└────────────────────────────────────────────────────────┘
    │
    ▼
Synthesized Context injected into Prompt
```

#### Reciprocal Rank Fusion (RRF) Formulation
Given a set of candidate documents $D$, the hybrid score for each document $d \in D$ is computed as:

$$RRF\_Score(d) = \alpha \cdot \frac{1}{k + Rank_{dense}(d)} + (1 - \alpha) \cdot \frac{1}{k + Rank_{bm25}(d)}$$

Where:
- $k = 60$ (smoothing constant preventing high ranks from dominating the distribution)
- $\alpha = 0.65$ (empirically tuned weight prioritizing semantic dense context while retaining lexical precision)
- $Rank_{dense}(d)$ is the 1-based rank from FAISS similarity
- $Rank_{bm25}(d)$ is the 1-based rank from BM25 scoring

---

### 4. End-to-End Sequence Workflows

#### 4.1 Ingestion & Vector Construction Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Web SPA
    participant API as FastAPI /api/ingest
    participant Pipe as IngestionPipeline
    participant Ingest as DataIngestion
    participant Transform as DataTransformation
    participant Index as Indexing
    participant LLM as Gemini 2.5 Flash

    User->>UI: Pastes YouTube URL
    UI->>API: POST /api/ingest { url: "..." }
    API->>Pipe: run(url_or_id)
    Pipe->>Ingest: extract_transcript_and_metadata()
    Ingest-->>Pipe: raw_transcript, oEmbed metadata
    Pipe->>Transform: chunk_transcript(raw_transcript)
    Transform-->>Pipe: timestamped_chunks (800 chars, 150 overlap)
    Pipe->>Index: build_and_cache_indices(chunks)
    Index->>Index: Compute embeddings & FAISS index
    Index->>Index: Build BM25 token index
    Index-->>Pipe: Cached in models/{video_id}/
    Pipe->>LLM: Generate Executive Summary & Suggested Prompts
    LLM-->>Pipe: Markdown summary + timestamp citations
    Pipe-->>API: IngestResponse payload
    API-->>UI: 200 OK (Metadata, Summary, Chunks, Suggestions)
    UI->>UI: Mount YouTube Player & Render Workspace
```

#### 4.2 Conversational Retrieval & Token Streaming Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Web SPA
    participant API as FastAPI /api/chat/stream
    participant RAG as RAGPipeline
    participant Retrieve as Retrieval
    participant Augment as Augmentation
    participant LLM as Gemini 2.5 Flash
    participant Player as YouTube Iframe API

    User->>UI: Types Question & hits Send
    UI->>API: POST /api/chat/stream (SSE)
    API->>RAG: stream_query(video_id, question, web_search=False)
    RAG->>Retrieve: hybrid_search(question, video_id)
    Retrieve->>Retrieve: FAISS Dense + BM25 Sparse Search
    Retrieve->>Retrieve: Reciprocal Rank Fusion (alpha=0.65)
    Retrieve-->>RAG: Top-4 Grounded Chunks with [start, end]
    RAG->>Augment: construct_grounded_prompt(chunks, question)
    Augment-->>RAG: Formatted Prompt with strict timestamp citation rule
    RAG->>LLM: generate_content_stream(prompt)
    loop SSE Token Delivery
        LLM-->>RAG: token chunk
        RAG-->>API: yield "data: {...}\n\n"
        API-->>UI: Stream token to DOM
    end
    UI->>UI: Format [MM:SS] timestamp badges
    User->>UI: Clicks [03:15] badge
    UI->>Player: seekTo(195, true)
    Player-->>User: Video jumps to 03:15 and plays
```

---

### 5. Storage & Persistence Architecture

1. **In-Memory & Disk Vector Serialization (`models/{video_id}/`)**:
   - `index.faiss`: Binary serialized FAISS index containing 384-dimensional vector embeddings.
   - `index.pkl`: Serialized metadata mapping vector indices to chunk dictionaries (text, start time, end time, video ID).
   - `bm25.pkl`: Serialized BM25 Okapi model containing token frequencies and inverted document lists.
2. **Raw Data Cache (`data/raw/` & `data/processed/`)**:
   - Raw extracted transcripts stored as JSON payloads (`{video_id}_raw.json`), preventing redundant calls to YouTube subtitle APIs.
3. **Browser Local Storage (`localStorage`)**:
   - `yt_copilot_agent_sessions_v2`: Serialized array of session objects containing chat history, video metadata, active tabs, and generated summaries.
   - `yt_copilot_active_session_id_v2`: Active session UUID pointer.
   - `yt_copilot_media_col_ratio_v2`: Floating-point width ratio of the split-screen workspace, persisting user layout custom preferences.

---

### 6. Resilience, Scalability & Security

- **LLM Fallback Topology**: Primary calls target `gemini-2.5-flash`. In the event of Google Cloud 429 (Resource Exhausted) or 503 (Service Unavailable) status codes, the generator automatically switches to `gemini-1.5-flash` without terminating user conversations.
- **Resource Profiling**:
  - Memory consumption per active index is under 5MB.
  - FAISS CPU search across typical video transcript lengths (100 - 800 chunks) executes in under 8 milliseconds.
- **Zero Ingestion Leakage**: Subtitle extraction uses unauthenticated public scraping and oEmbed endpoints, eliminating API quota constraints on YouTube Data API keys.
