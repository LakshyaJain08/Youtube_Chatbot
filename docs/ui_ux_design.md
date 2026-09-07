# UI/UX Design System & Experience Specification

## YouTube Chatbot 2.0: Interface Architecture & Visual Guidelines

---

### 1. Design Philosophy & Principles

The user interface of YouTube Chatbot is engineered specifically for deep research, video interrogation, and long-session multimodal analysis. Rather than adopting generic chatbot layouts or loud consumer aesthetics, the interface follows an **academic, authoritative, and minimalist design philosophy**.

Core tenets:
1. **The 60-30-10 Color Rule**:
   - **60% Dominant Base**: Obsidian dark space (`#09090b`, `#121214`, `#18181b`) minimizing eye fatigue during multi-hour research sessions.
   - **30% Content & Typography**: Crisp White (`#ffffff`) headers and muted Slate (`#9ca3af`, `#d1d5db`) body copy ensuring high contrast and optimal legibility.
   - **10% Brand Accent**: YouTube Red (`#ff0033`, `#e6002e`) used intentionally for primary calls-to-action, active grounding tags, and timestamp badges.
   - **Functional Accent**: Soft Emerald (`#10b981`) reserved strictly for positive system states (e.g., "Ready", "Optimal Faithfulness", healthy network connection).
2. **Elimination of Decorative Iconography (Zero Emojis)**:
   - The platform strictly avoids informal emojis. All interface anchors, status indicators, and operational buttons use sharp, standardized SVG vector icons from the Lucide library.
3. **Workspace Density & Synchronized Ergonomics**:
   - In active mode, the interface eliminates unnecessary scrolling by employing a side-by-side split layout: video media and grounding data on the left, conversational interrogation on the right.
   - Resizing proportions are user-controllable via an interactive draggable splitter and persist automatically across page reloads.

---

### 2. Design Tokens & Color Palette

```
┌────────────────────────────────────────────────────────┐
│                   COLOR TOKENS                        │
├───────────────────┬──────────────┬─────────────────────┤
│ Token Variable    │ Value        │ Semantic Role       │
├───────────────────┼──────────────┼─────────────────────┤
│ --bg-obsidian     │ #09090b      │ Primary App Canvas  │
│ --bg-surface      │ #121214      │ Panel & Column Base │
│ --bg-card         │ #18181b      │ Elevated Cards      │
│ --bg-card-hover   │ #202024      │ Card Hover State    │
│ --border-subtle   │ rgba(255,..) │ 1px Structure Line  │
│ --text-primary    │ #ffffff      │ Headings & Emphases │
│ --text-secondary  │ #e5e7eb      │ Primary Body Copy   │
│ --text-dim        │ #9ca3af      │ Captions & Meta     │
│ --yt-red          │ #ff0033      │ Primary Brand & CTA │
│ --yt-red-subtle   │ rgba(255,..) │ Badge Fill & Glow   │
│ --emerald         │ #10b981      │ Status & Readiness  │
└───────────────────┴──────────────┴─────────────────────┘
```

#### Elevation & Surfaces
- **Level 0 (Canvas)**: `#09090b` (Deep Obsidian background)
- **Level 1 (Panels)**: `#121214` (Workspace media and chat columns)
- **Level 2 (Cards & Modules)**: `#18181b` (Border: `1px solid rgba(255, 255, 255, 0.08)`)
- **Level 3 (Modals & Overlays)**: `#27272a` (Box shadow: `0 20px 45px rgba(0, 0, 0, 0.8)`)

---

### 3. Typography Architecture

The typography system pairs modern geometric sans-serif typefaces for user interface elements with a fixed-width monospace font for code and temporal timestamps.

- **Primary Typeface**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`
  - Body Copy: `400 Regular` / `14px` (Line height: `1.5`)
  - Subheaders: `600 Semi-Bold` / `16px`
  - Main Headers: `700 Bold` / `24px` to `32px`
- **Monospace Typeface**: `JetBrains Mono`, `Consolas`, `monospace`
  - Used strictly for timestamp citations (e.g. `[04:22]`), token metrics, and extracted transcript codes.

---

### 4. Layout & Information Architecture

The application transitions dynamically between two primary interface states:
1. **Landing & Ingestion View** (Initial state before video ingestion)
2. **Active Analysis Workspace** (Synchronized split-screen state once a video is loaded)

#### 4.1 Landing View Topology

```
┌──────────────────────────────────────────────────────────────────┐
│ Top Navigation Bar (Logo, GitHub link, Session Drawer Trigger)   │
├──────────────────────────────────────────────────────────────────┤
│ Hero Section: Title, Value Proposition & Badge Indicators        │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ URL Ingestion Bar: Input field, Paste trigger, Submit button │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ Feature Showcase: "What YouTube Chatbot Can Do" (2x4 Grid)       │
│ ┌──────────────────────────────┬───────────────────────────────┐ │
│ │ [Red] Precision Citations    │ [Red] Semantic & Lexical RAG  │ │
│ ├──────────────────────────────┼───────────────────────────────┤ │
│ │ [Red] Transcript Search      │ [Red] RAG Triad Benchmarks    │ │
│ ├──────────────────────────────┼───────────────────────────────┤ │
│ │ [White] Executive Summaries  │ [White] Synchronized Player   │ │
│ ├──────────────────────────────┼───────────────────────────────┤ │
│ │ [White] Web Augmentation     │ [White] Multi-Session History │ │
│ └──────────────────────────────┴───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Feature Grid Symmetry**:
The 8 showcase feature cards are organized into a strict symmetrical 4-and-4 grouping:
- **Rows 1 and 2 (Top Half)**: 4 Red logo cards representing core AI, retrieval, and grounding engine features (`Precision Citations`, `Semantic & Lexical RAG`, `Transcript Search`, `Benchmarking & Metrics`).
- **Rows 3 and 4 (Bottom Half)**: 4 White logo cards representing workspace usability and session productivity features (`Executive Summaries`, `Synchronized Player`, `Web Augmentation`, `Multi-Chat History`).

#### 4.2 Active Split-Screen Workspace Topology

```
┌───────────────────────────────────────────────────────────────────────┐
│ Global App Header: Video Title, Session Dropdown, New Chat Button     │
├─────────────────────────────────────┬───┬─────────────────────────────┤
│ LEFT COLUMN: Media & Grounding Hub  │ S │ RIGHT COLUMN: Chat Thread   │
│ ┌─────────────────────────────────┐ │ P │ ┌─────────────────────────┐ │
│ │ URL Re-ingestion / Switcher Bar │ │ L │ │ Assistant Welcome &     │ │
│ ├─────────────────────────────────┤ │ I │ │ Executive Summary Card  │ │
│ │ 16:9 YouTube Iframe Video Player│ │ T │ ├─────────────────────────┤ │
│ ├─────────────────────────────────┤ │ T │ │ Conversation Messages   │ │
│ │ Metadata (Speaker, Chunks, Word)│ │ E │ │ - User query bubbles    │ │
│ ├─────────────────────────────────┤ │ R │ │ - Assistant response    │ │
│ │ Grounding Hub Navigation Tabs:  │ │   │ │   with [MM:SS] badges   │ │
│ │ [Summary] [Transcript] [HUD]    │ │   │ ├─────────────────────────┤ │
│ │ - Active Tab Content Panel      │ │   │ │ Suggested Prompts Pills │ │
│ │ - Live Transcript Filter Input  │ │   │ ├─────────────────────────┤ │
│ │ - Timestamped Segment Rows      │ │   │ │ Prompt Input & Actions: │ │
│ └─────────────────────────────────┘ │   │ │ [Web Search] [Send CTA] │ │
│                                     │   │ └─────────────────────────┘ │
└─────────────────────────────────────┴───┴─────────────────────────────┘
```

---

### 5. Interactive Components & Micro-Interactions

#### 5.1 Draggable Media Splitter
- **Visual Presentation**: A subtle vertical divider (`width: 6px`) positioned between the media column and the chat column.
- **Hover & Drag States**: Expands visually on hover with a central grip indicator. During active dragging, a global `user-select: none` overlay prevents text selection and iframe mouse interception.
- **Boundary Constraints**: Enforces a minimum width of 340px on both sides, ensuring neither column collapses into an unreadable state.
- **State Persistence**: The active column ratio is saved in `localStorage` under `yt_copilot_media_col_ratio_v2` and restored automatically during subsequent visits.

#### 5.2 Interactive Timestamp Citations
- **Visual Syntax**: Rendered as pill-shaped code badges (e.g., `[02:45]`) styled with `--yt-red-subtle` background and `--yt-red` text.
- **Click Behavior**: Clicking any timestamp badge parses the time into absolute seconds and calls `player.seekTo(targetSeconds, true)` on the YouTube Iframe API instance.
- **Visual Feedback**: The target citation flashes briefly with an accent border, and the video player immediately seeks and resumes playback.

#### 5.3 Live Transcript Filter
- **Real-Time Input Filtering**: Users can type terms (e.g. "transformer", "cost", "benchmark") into the transcript search bar.
- **Instant DOM Filtering**: The list of hundreds of transcript segments updates instantaneously (< 16ms, zero debouncing lag) hiding non-matching segments and highlighting matching substrings.
- **Click-to-Seek**: Clicking any transcript segment automatically seeks the video player to that segment's exact start time.

#### 5.4 RAG Triad Evaluation HUD Modal
- **Trigger**: Accessible via the "Evaluation HUD" button in the Grounding Hub or chat header.
- **Interface**: A focused modal presenting 4 key metric bars (Faithfulness, Answer Relevancy, Context Precision, Context Recall).
- **Color Thresholds**:
  - Score >= 0.85: Soft Emerald (`#10b981`) indicating production-grade confidence.
  - Score 0.70 - 0.84: Crisp Amber (`#f59e0b`) indicating moderate confidence.
  - Score < 0.70: YouTube Red (`#ff0033`) warning of potential context dilution.

---

### 6. Accessibility & Responsiveness

- **Color Contrast**: All text styles exceed the 4.5:1 ratio mandated by WCAG AA guidelines.
- **Keyboard Navigation**: All interactive elements (search inputs, citation badges, tab switches, and prompt pills) are focusable via `Tab` and activatable via `Enter` or `Space`.
- **Responsive Collapse**: On viewports narrower than 992px, the split layout smoothly reorganizes into a stacked tabbed interface where users can toggle between "Watch Video" and "Chat Conversation".
