"""
FastAPI Server for YouTube Chatbot.
Provides REST and Streaming (SSE) endpoints with CORS and static file serving.
"""

import os
import json
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
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

# Initialize FastAPI App
app = FastAPI(
    title=config.app.name,
    version=config.app.version,
    description="Production-Grade YouTube AI Copilot with Staged Hybrid Retrieval, Citations & Ragas Evaluation.",
)

# Enable CORS for browser extensions and local frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Pipelines
ingestion_pipeline = IngestionPipeline()
rag_pipeline = RAGPipeline()
evaluation_pipeline = EvaluationPipeline()

# Static directory setup
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/health")
async def health_check():
    """Returns application health and configuration status."""
    has_gemini_key = bool(
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or config.model.gemini_api_key
    )
    return {
        "status": "healthy",
        "app_name": config.app.name,
        "version": config.app.version,
        "llm_model": config.model.llm_model,
        "embedding_model": config.model.embedding_model,
        "gemini_api_configured": has_gemini_key,
        "cached_retrievers_count": len(rag_pipeline._retriever_cache),
    }


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
