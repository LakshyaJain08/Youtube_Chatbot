"""
FastAPI Server for YouTube Chatbot.
Provides REST and Streaming (SSE) endpoints with CORS and static file serving.
"""

import os
import json
import time
import platform
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from src.utils.logger import get_logger
from src.utils.exceptions import YouTubeChatbotException, TranscriptNotFoundError, InvalidYouTubeURLError
from src.utils.common import load_json, extract_video_id
from src.pipelines.ingestion_pipeline import IngestionPipeline
from src.pipelines.rag_pipeline import RAGPipeline
from src.pipelines.evaluation_pipeline import EvaluationPipeline
from src.config.configuration import get_config
from app.schemas import (
    IngestRequest,
    IngestResponse,
    ChatRequest,
    ChatResponse,
    EvaluateRequest,
    TranscriptResponse,
)

logger = get_logger("app.api")
config = get_config()

# Initialize Telemetry Tracking
_SERVER_START_TIME = time.time()
_METRICS = {
    "total_requests": 0,
    "total_errors": 0,
    "endpoint_hits": {},
}


def get_process_metrics():
    """Calculates process uptime, memory RSS, and CPU utilization."""
    uptime = round(time.time() - _SERVER_START_TIME, 2)
    memory_mb = None
    cpu_pct = None
    try:
        import psutil
        proc = psutil.Process(os.getpid())
        memory_mb = round(proc.memory_info().rss / (1024 * 1024), 2)
        cpu_pct = proc.cpu_percent(interval=None)
    except Exception:
        pass
    return {
        "uptime_seconds": uptime,
        "memory_rss_mb": memory_mb,
        "cpu_percent": cpu_pct,
    }


# Initialize FastAPI App
app = FastAPI(
    title=config.app.name,
    version=config.app.version,
    description="Production-Grade YouTube Chatbot with Staged Hybrid Retrieval, Citations & Ragas Evaluation.",
)

# Enable CORS for browser extensions and local frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def telemetry_middleware(request: Request, call_next):
    """Tracks request counts and error rates for container monitoring."""
    _METRICS["total_requests"] += 1
    path = request.url.path
    _METRICS["endpoint_hits"][path] = _METRICS["endpoint_hits"].get(path, 0) + 1
    try:
        response = await call_next(request)
        if response.status_code >= 500:
            _METRICS["total_errors"] += 1
        return response
    except Exception:
        _METRICS["total_errors"] += 1
        raise


# Initialize Pipelines
ingestion_pipeline = IngestionPipeline()
rag_pipeline = RAGPipeline()
evaluation_pipeline = EvaluationPipeline()

# Static directory setup
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/health")
async def health_check():
    """Returns application health, uptime, and memory status for Docker and orchestrator probes."""
    has_gemini_key = bool(
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or config.model.gemini_api_key
    )
    metrics = get_process_metrics()
    return {
        "status": "healthy",
        "app_name": config.app.name,
        "version": config.app.version,
        "uptime_seconds": metrics["uptime_seconds"],
        "memory_rss_mb": metrics["memory_rss_mb"],
        "llm_model": config.model.llm_model,
        "embedding_model": config.model.embedding_model,
        "gemini_api_configured": has_gemini_key,
        "cached_retrievers_count": len(rag_pipeline._retriever_cache),
        "total_requests": _METRICS["total_requests"],
    }


@app.get("/api/monitoring")
async def monitoring_dashboard():
    """Comprehensive telemetry dashboard for container and system observability."""
    metrics = get_process_metrics()
    has_gemini_key = bool(
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or config.model.gemini_api_key
    )
    models_dir = Path("models")
    disk_models_count = len(list(models_dir.glob("*"))) if models_dir.exists() else 0
    return {
        "status": "healthy",
        "service": {
            "name": config.app.name,
            "version": config.app.version,
            "environment": "development" if config.app.debug else "production",
            "python_version": platform.python_version(),
            "platform": platform.platform(),
        },
        "telemetry": {
            "uptime_seconds": metrics["uptime_seconds"],
            "memory_rss_mb": metrics["memory_rss_mb"],
            "cpu_percent": metrics["cpu_percent"],
        },
        "traffic": {
            "total_requests": _METRICS["total_requests"],
            "total_errors": _METRICS["total_errors"],
            "endpoint_breakdown": _METRICS["endpoint_hits"],
        },
        "ai_engine": {
            "llm_model": config.model.llm_model,
            "fallback_llm_model": config.model.fallback_llm_model,
            "embedding_model": config.model.embedding_model,
            "gemini_api_configured": has_gemini_key,
            "cached_retrievers_in_memory": len(rag_pipeline._retriever_cache),
            "persisted_video_models_on_disk": disk_models_count,
        },
    }


@app.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics():
    """Prometheus-compatible plain-text metrics endpoint for container monitoring."""
    metrics = get_process_metrics()
    mem_bytes = int((metrics["memory_rss_mb"] or 0) * 1024 * 1024)
    lines = [
        "# HELP app_uptime_seconds Application uptime in seconds",
        "# TYPE app_uptime_seconds gauge",
        f"app_uptime_seconds {metrics['uptime_seconds']}",
        "# HELP app_memory_rss_bytes Resident memory size in bytes",
        "# TYPE app_memory_rss_bytes gauge",
        f"app_memory_rss_bytes {mem_bytes}",
        "# HELP app_requests_total Total HTTP requests processed",
        "# TYPE app_requests_total counter",
        f"app_requests_total {_METRICS['total_requests']}",
        "# HELP app_errors_total Total HTTP 5xx errors",
        "# TYPE app_errors_total counter",
        f"app_errors_total {_METRICS['total_errors']}",
        "# HELP app_cached_retrievers In-memory FAISS cached retrievers",
        "# TYPE app_cached_retrievers gauge",
        f"app_cached_retrievers {len(rag_pipeline._retriever_cache)}",
    ]
    return "\n".join(lines) + "\n"


@app.post("/api/ingest", response_model=IngestResponse)
async def ingest_video(req: IngestRequest):
    """
    Ingests YouTube video metadata and transcript, creates FAISS + BM25 indexes,
    and returns metadata, video summary, and suggested prompts.
    """
    try:
        logger.info(f"API /ingest called with url: {req.url}")
        result = ingestion_pipeline.run(
            url_or_id=req.url,
            force_reindex=req.force_reindex,
        )
        return IngestResponse(
            video_id=result["video_id"],
            metadata=result["metadata"],
            total_chunks=result["total_chunks"],
            summary=result["summary"],
            summary_citations=result.get("summary_citations", []),
            suggested_questions=result.get("suggested_questions", []),
            is_ready=result["is_ready"],
        )
    except InvalidYouTubeURLError as e:
        logger.error(f"Invalid URL: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except TranscriptNotFoundError as e:
        logger.error(f"Transcript error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to ingest video: {str(e)}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat_query(req: ChatRequest):
    """
    Executes Staged Hybrid Retrieval RAG query.
    Returns grounded answer with clickable timestamp citations, retrieved chunks, and evaluation metrics.
    """
    try:
        history_dicts = [{"role": m.role, "content": m.content} for m in req.conversation_history]
        result = rag_pipeline.query(
            video_id=req.video_id,
            question=req.question,
            history=history_dicts,
            top_k=req.top_k,
            enable_web_search=req.enable_web_search,
            force_web_search=req.force_web_search,
        )
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.post("/api/chat/stream")
async def chat_query_stream(req: ChatRequest):
    """
    Streams response tokens in Server-Sent Events (SSE) format.
    """
    history_dicts = [{"role": m.role, "content": m.content} for m in req.conversation_history]

    async def event_generator():
        try:
            async for event in rag_pipeline.query_stream(
                video_id=req.video_id,
                question=req.question,
                history=history_dicts,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.error(f"Stream generation error: {e}")
            error_event = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/transcript/{video_id}")
async def get_transcript(video_id: str):
    """
    Retrieves the full timestamped transcript segments for a video.
    """
    clean_id = extract_video_id(video_id)
    raw_path = Path(config.ingestion.raw_data_dir) / f"{clean_id}.json"
    data = load_json(raw_path)

    if not data:
        raise HTTPException(status_code=404, detail=f"Transcript not found for video: {clean_id}. Ingest it first.")

    return {
        "video_id": clean_id,
        "metadata": data.get("metadata", {}),
        "total_segments": len(data.get("segments", [])),
        "segments": data.get("segments", []),
    }


@app.post("/api/evaluate")
async def evaluate_video(req: EvaluateRequest):
    """
    Runs automated Ragas benchmark evaluation suite on a video.
    """
    try:
        report = evaluation_pipeline.evaluate_video(
            video_id=req.video_id,
            test_questions=req.questions
        )
        return report
    except Exception as e:
        logger.error(f"Evaluation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


# Serve Web UI
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "YouTube Chatbot API is running. Frontend static files loading..."}

    @app.get("/style.css")
    async def serve_root_style():
        css_file = STATIC_DIR / "style.css"
        if css_file.exists():
            return FileResponse(str(css_file), media_type="text/css")
        raise HTTPException(status_code=404, detail="File not found")

    @app.get("/app.js")
    async def serve_root_js():
        js_file = STATIC_DIR / "app.js"
        if js_file.exists():
            return FileResponse(str(js_file), media_type="application/javascript")
        raise HTTPException(status_code=404, detail="File not found")
