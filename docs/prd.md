# Product Requirements Document (PRD)

## YouTube Chatbot 2.0: Multimodal Video Intelligence Platform

---

### 1. Executive Summary & Vision

Long-form video content on platforms like YouTube represents the largest repository of educational, technical, and analytical knowledge in existence. However, video remains an inherently sequential and time-inefficient medium. Finding specific arguments, cross-referencing claims, extracting summaries, or verifying quotes within multi-hour lectures, podcasts, and tutorials demands manual scrubbing and note-taking.

YouTube Chatbot 2.0 bridges this gap by transforming passive video watching into an active, conversational research experience. By integrating staged hybrid retrieval (dense vector embeddings combined with lexical BM25 matching), precise timestamp citation anchoring, real-time video synchronization, and live web augmentation, the platform allows users to interrogate video transcripts with academic rigor and zero hallucination tolerance.

---

### 2. Problem Statement

1. **Information Density vs. Time Investment**: Professionals and students spend hours watching tutorials or conferences when only a fraction of the content pertains to their specific queries.
2. **Hallucinations in Video Summarizers**: Standard LLM video summarizers frequently fabricate context, hallucinate timestamps, or cite concepts absent from the speaker's transcript.
3. **Loss of Source Verification**: Existing solutions output static markdown without linking statements back to the exact video frame where the speaker made the claim.
4. **Isolated Video Scope**: Videos often reference breaking news, external libraries, or ongoing events that require external context outside the transcript boundaries.
5. **Lack of Local Persistence**: Web-based conversational tools discard history on page refresh, forcing users to re-index videos and lose curated insights.

---

### 3. User Personas

#### Persona A: Academic Researcher & Student
- **Profile**: Undergraduate and graduate students, academic researchers, and online learners.
- **Pain Points**: Needs to cite lectures accurately, locate specific explanations of mathematical equations or historical events, and extract structured review quizzes.
- **Core Needs**: Exact timestamp citations, transcript filtering, and automated chapter takeaways.

#### Persona B: Software Engineer & Technical Architect
- **Profile**: Developers watching keynotes, technical walkthroughs, developer tutorials, and system design lectures.
- **Pain Points**: Needs specific code snippets, setup instructions, or architectural rationale without watching an entire 45-minute conference session.
- **Core Needs**: Fast keyword search, code extraction, web search fallback for deprecations or updated library syntax.

#### Persona C: Market Analyst & Content Curator
- **Profile**: Financial analysts, industry researchers, and content creators analyzing earnings calls, product launches, and expert interviews.
- **Pain Points**: Needs rapid synthesis of executive statements, sentiment trends, and verified quotes.
- **Core Needs**: Multi-session management, executive summaries, and evaluation HUD to ensure faithfulness.

---

### 4. Product Objectives & Success Metrics

| Metric Category | Metric | Target | Measurement Method |
|---|---|---|---|
| Retrieval Accuracy | Faithfulness (Ragas) | >= 0.90 | Automated RAG Triad evaluation pipeline |
| Retrieval Accuracy | Context Precision | >= 0.85 | Ground truth benchmark test suite |
| Latency | Initial Ingestion (1-hr video) | < 6.0 seconds | Pipeline execution timer |
| Latency | First Token Latency (RAG Query) | < 800 ms | Server-Sent Events (SSE) stream benchmark |
| User Experience | Citation Seeking Accuracy | 100% | Exact timestamp second mapping |
| System Reliability | API Availability | 99.9% uptime | Health endpoint monitoring |

---

### 5. Functional Feature Specifications

#### 5.1 Video Ingestion & Transcript Extraction
- **URL & ID Resolution**: Accepts standard YouTube URLs (`youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/embed/...`, `youtube.com/shorts/...`) or raw 11-character video IDs.
- **Transcript Extraction**: Fetches timestamped subtitles using official and automatically generated captions across English locales (`en`, `en-US`, `en-GB`, and automatic fallback).
- **Metadata Grounding**: Retrieves title, author, view count, publication date, and thumbnail via oEmbed without requiring an authenticated YouTube Data API key.
- **Timestamp Preservation**: Every transcript chunk preserves its native start time (`start`), duration, and calculated end time.

#### 5.2 Staged Hybrid Retrieval Engine (RAG)
- **Stage 1 (Metadata Pre-filtering)**: Isolates chunks belonging strictly to the active `video_id` and filters out empty or degenerate segments.
- **Stage 2 (Hybrid Search)**: Fuses dense semantic embeddings (Google `text-embedding-004` or `SentenceTransformer: all-MiniLM-L6-v2`) and sparse lexical scoring (BM25) via Reciprocal Rank Fusion (RRF) with balanced weighting ($\alpha = 0.65$ dense, $0.35$ lexical).
- **Stage 3 (Contextual Compression & Deduplication)**: Removes redundant overlapping chunks to respect context token limits while maximizing grounding fidelity.

#### 5.3 Grounded Generation & Interactive Citations
- **Strict Grounding Guardrails**: Prompt engineering directs Gemini 2.5 Flash to synthesize answers solely from provided transcript chunks unless web search is explicitly activated.
- **Interactive Citation Syntax**: Quotes and statements are cited with standardized `[MM:SS]` badges.
- **Interactive Player Linking**: Clicking any citation badge triggers the embedded YouTube iframe player to seek immediately to that second.

#### 5.4 Synchronized Split-Screen Workspace
- **16:9 Responsive Video Player**: YouTube Iframe API player embedded side-by-side with conversational thread.
- **Draggable Resizing Splitter**: Users can adjust the column width ratio dynamically between video media and chat panel. Layout proportions persist across page reloads via `localStorage`.
- **Live Transcript Inspector**: Interactive transcript tab allowing real-time keyword filtering across all extracted segments with click-to-seek functionality.

#### 5.5 Web Augmentation Agent
- **DuckDuckGo Integration**: Toggable search agent allowing the LLM to retrieve fresh web context for queries requiring information beyond video transcript boundaries.
- **Source Differentiation**: Web search citations are distinctly demarcated from video timestamp citations.

#### 5.6 Automated RAG Triad Evaluation HUD
- **Real-Time Quality Dashboard**: Evaluates Faithfulness, Answer Relevancy, Context Precision, and Context Recall.
- **In-App Modal Display**: Visual score bars with color-coded confidence thresholds and diagnostic explanations.

#### 5.7 Persistent Multi-Session History
- **Client-Side Persistence**: Complete chat threads, video metadata, active tabs, and layout preferences persist in browser `localStorage`.
- **Session Switcher**: Sidebar drawer enabling effortless creation, switching, renaming, and deletion of video workspaces.

#### 5.8 Manifest V3 Chrome Extension
- **Direct YouTube Integration**: Browser extension injects side panel or popup overlay onto active YouTube tabs.
- **Single-Click Ingestion**: Detects current video ID automatically and connects to the local or hosted FastAPI backend.

---

### 6. User Experience & Design Philosophy

1. **4-Color Discipline**: The visual hierarchy strictly enforces an Obsidian base (`#09090b`), Crisp White typography (`#ffffff`), YouTube Red accents (`#ff0033`), and Soft Emerald functional indicators (`#10b981`).
2. **Zero Decorative Emojis**: Documentation and UI typography follow an academic, authoritative tone. System indicators utilize vector icons (Lucide) rather than informal emoji symbols.
3. **Sub-Second Feedback**: Ingestion, citation seeking, and streaming generation provide immediate visual loading skeletons and progress pulses.

---

### 7. Non-Functional Requirements

- **Performance**: P95 query response time must remain under 2.5 seconds on CPU-only local environments.
- **Scalability**: Vector indices are cached to disk as individual FAISS stores per video ID (`models/{video_id}/`), avoiding monolithic memory footprints.
- **Security & Privacy**: No user chat data or YouTube cookies are transmitted to third parties other than Google Gemini API for inference.
- **Cross-Browser Compatibility**: Web interface operates seamlessly on modern Chromium browsers, Firefox, and Safari.

---

### 8. Release Strategy & Roadmap

- **Phase 1 (Current - v2.0.0)**: Staged Hybrid RAG, Gemini 2.5 Flash integration, 4-color obsidian design system, draggable split-screen workspace, Ragas evaluation HUD, local storage persistence, Manifest V3 extension.
- **Phase 2 (v2.1.0)**: Multi-video querying (corpus-level RAG across entire playlists or channels), automated subtitle translation for non-English videos.
- **Phase 3 (v2.2.0)**: Audio-native transcription fallback via local Whisper models for videos with disabled subtitles.
- **Phase 4 (v3.0.0)**: Cloud sync option with end-to-end encryption, collaborative shared video research spaces, and PDF/Notion export integrations.
