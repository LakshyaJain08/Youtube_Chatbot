# Software Requirements Specification (SRS)

## YouTube Chatbot 2.0: System & Technical Requirements

---

### 1. Document Purpose & Scope

This document specifies the complete functional and non-functional requirements for the YouTube Chatbot platform. It serves as the formal baseline for development, testing, validation, and system verification across backend pipelines, API services, and client interfaces.

---

### 2. Functional Requirements (FR)

#### FR-1: URL Ingestion and Subtitle Extraction
- **FR-1.1**: The system must accept YouTube URLs in all valid formats, including:
  - Standard watch URL: `https://www.youtube.com/watch?v={id}`
  - Shortened URL: `https://youtu.be/{id}`
  - Embed URL: `https://www.youtube.com/embed/{id}`
  - Shorts URL: `https://www.youtube.com/shorts/{id}`
  - Raw 11-character video alphanumeric identifier: `{id}`
- **FR-1.2**: The system must extract official subtitles when available and fall back to automatically generated captions.
- **FR-1.3**: The ingestion pipeline must support language priority: English (`en`), American English (`en-US`), British English (`en-GB`), and universal automatic fallback.
- **FR-1.4**: If captions are disabled or unavailable for a video, the system must return a structured `HTTP 404 TranscriptNotFoundError` with an actionable explanation.
- **FR-1.5**: The system must retrieve video title, channel name, publication date, view count, and high-resolution thumbnail via YouTube oEmbed without requiring Google Cloud Console OAuth credentials.
- **FR-1.6**: Each extracted transcript segment must preserve exact time parameters: `start` (seconds) and `duration` (seconds).

#### FR-2: Timestamp-Preserving Text Transformation
- **FR-2.1**: The transformation engine must chunk raw transcripts into discrete semantic windows targetting 800 characters with a 150-character sliding overlap.
- **FR-2.2**: The chunker must not split mid-sentence. It must use sentence boundary regex detection (`[.!?]\s+`) to ensure grammatical continuity.
- **FR-2.3**: Every chunk object must retain the minimum start timestamp and maximum end timestamp among all transcript sentences encompassed within that chunk.

#### FR-3: Multi-Index Vector and Lexical Storage
- **FR-3.1**: The indexing component must generate dense embeddings for each chunk using local SentenceTransformers (`all-MiniLM-L6-v2`) or Google Cloud embeddings (`text-embedding-004`).
- **FR-3.2**: The system must construct an in-memory FAISS vector index (IndexFlatL2 or IndexFlatIP) for semantic similarity searches.
- **FR-3.3**: The system must build an auxiliary Rank-BM25 index across tokenized chunk texts to support sparse lexical keyword search.
- **FR-3.4**: Both indices and associated metadata must be serialized to disk at `models/{video_id}/` to eliminate re-indexing latency on subsequent visits.

#### FR-4: Staged Hybrid Retrieval (RAG)
- **FR-4.1 (Stage 1 - Metadata Pre-filtering)**: Queries must be strictly scoped to the active `video_id`. Chunks outside the active video ID must never contaminate the candidate pool.
- **FR-4.2 (Stage 2 - Hybrid Search)**: The retrieval component must query both the dense FAISS index and the BM25 index concurrently.
- **FR-4.3 (Reciprocal Rank Fusion)**: Candidate ranks from dense and sparse retrieval must be fused via Reciprocal Rank Fusion (RRF) using the formula:
  $$RRF\_Score(d) = \alpha \cdot \frac{1}{60 + Rank_{dense}(d)} + (1 - \alpha) \cdot \frac{1}{60 + Rank_{bm25}(d)}$$
  where $\alpha = 0.65$.
- **FR-4.4 (Stage 3 - Contextual Compression)**: The system must deduplicate overlapping chunks and return the top 4 candidates exceeding a cosine similarity threshold of 0.30.

#### FR-5: Generation, Anti-Hallucination & Citations
- **FR-5.1**: The system must utilize Google Gemini 2.5 Flash as the primary LLM, with automatic fallback to Gemini 1.5 Flash if rate limits or 5xx errors occur.
- **FR-5.2**: Generation temperature must be fixed at `0.2` to prioritize factual grounding over creative divergence.
- **FR-5.3**: The prompt template must enforce strict adherence to provided transcript context. If a user asks a question not addressed in the video, the LLM must explicitly state that the video does not contain that information, unless web search is toggled on.
- **FR-5.4**: The system must format every factual claim with an inline timestamp citation badge adhering to the syntax `[MM:SS]` or `[HH:MM:SS]`.
- **FR-5.5**: The system must provide both a standard JSON endpoint (`/api/chat`) and a Server-Sent Events streaming endpoint (`/api/chat/stream`) delivering tokens in real time.

#### FR-6: Synchronized Video Player and Navigation
- **FR-6.1**: The web UI must embed an interactive 16:9 YouTube Iframe player for the active video.
- **FR-6.2**: Clicking any timestamp citation badge in the chat conversation or executive summary must instantly seek the video player to that exact second and resume playback.

#### FR-7: Real-Time Transcript Search
- **FR-7.1**: The web UI must render a dedicated "Transcript" tab containing all timestamped lines of the video.
- **FR-7.2**: A live keyword filter input must filter matching transcript segments with zero perceived input lag (< 50ms).
- **FR-7.3**: Clicking any filtered transcript row must seek the YouTube player to that specific sentence.

#### FR-8: Live Web Search Augmentation
- **FR-8.1**: The user must have a toggle control in the chat interface to enable or disable web augmentation.
- **FR-8.2**: When enabled, the system must execute an asynchronous search via DuckDuckGo, fetch top snippet results, and append them to the LLM context under a distinct `[External Web Context]` header.
- **FR-8.3**: Citations originating from the web must be visibly differentiated from video timestamp citations.

#### FR-9: Automated Evaluation HUD (Ragas Triad)
- **FR-9.1**: The platform must provide an evaluation endpoint (`/api/evaluate`) and an on-screen HUD modal.
- **FR-9.2**: The evaluation suite must score:
  - **Faithfulness**: Proportion of answer claims grounded in retrieved context.
  - **Answer Relevancy**: Semantic congruence between question and answer.
  - **Context Precision**: Ratio of relevant chunks to total retrieved chunks.
  - **Context Recall**: Coverage of required ground truth claims.
  - **Latency**: Total pipeline execution time in milliseconds.

#### FR-10: Multi-Session and Workspace Persistence
- **FR-10.1**: All video sessions, including conversation threads, video metadata, active tabs, and suggested prompts, must persist in the browser's `localStorage`.
- **FR-10.2**: Users must be able to create new video sessions, switch between previous sessions, rename session titles, and delete sessions.
- **FR-10.3**: The width ratio of the draggable split-screen layout must persist in `localStorage` and restore automatically upon page reload.

#### FR-11: Manifest V3 Browser Extension
- **FR-11.1**: The extension must detect YouTube video URLs automatically when browsing `youtube.com`.
- **FR-11.2**: The extension popup and side panel must provide video ingestion and conversation controls linked to the local or cloud backend.

---

### 3. Non-Functional Requirements (NFR)

#### NFR-1: Performance & Latency
- **NFR-1.1**: Ingestion and indexing for a 60-minute video transcript must complete in under 6.0 seconds on standard consumer CPU hardware.
- **NFR-1.2**: First Token Latency (FTL) on the streaming chat endpoint must be less than 800 milliseconds.
- **NFR-1.3**: Complete response generation for a typical 200-word grounded answer must finish within 2.5 seconds.
- **NFR-1.4**: UI interactions (seeking video, switching tabs, filtering transcripts) must respond within 50 milliseconds.

#### NFR-2: Reliability & Fault Tolerance
- **NFR-2.1**: In the event of Gemini API timeouts, the backend must retry up to 2 times with exponential backoff before executing the fallback model.
- **NFR-2.2**: If disk cache for a vector index becomes corrupted, the system must delete the corrupted folder and re-index the video automatically.
- **NFR-2.3**: Unhandled exceptions must be intercepted by FastAPI global error handlers and returned as standardized JSON payloads with clear error codes.

#### NFR-3: Security & Privacy
- **NFR-3.1**: API keys (`GEMINI_API_KEY`) must only be stored in server-side environment variables or `.env` files and must never leak into client-side JavaScript bundles or API responses.
- **NFR-3.2**: CORS headers must be configurable via configuration files, permitting explicit local extension origins (`chrome-extension://*`) and frontend hosts.
- **NFR-3.3**: No user conversation data or telemetry is stored on external databases; all persistence remains strictly client-side within browser `localStorage`.

#### NFR-4: Usability & Accessibility
- **NFR-4.1**: Typography contrast across all text elements must achieve a minimum WCAG AA contrast ratio of 4.5:1 against the dark Obsidian background.
- **NFR-4.2**: The interface must adapt responsively to viewport widths from 768px (tablets) to 3840px (4K monitors).
- **NFR-4.3**: Interactive buttons and inputs must provide visible `:focus-visible` outlines for full keyboard accessibility.
