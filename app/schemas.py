"""
FastAPI Request and Response Schemas.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    url: str = Field(..., description="YouTube video URL or 11-character video ID")
    force_reindex: bool = Field(False, description="Whether to rebuild index if already cached")
    languages: Optional[List[str]] = Field(None, description="Preferred language codes (e.g. ['en'])")


class IngestResponse(BaseModel):
    video_id: str
    metadata: Dict[str, Any]
    total_chunks: int
    summary: str
    summary_citations: List[Dict[str, Any]] = []
    suggested_questions: List[str] = []
    is_ready: bool = True


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    video_id: str = Field(..., description="YouTube video ID")
    question: str = Field(..., description="User question")
    conversation_history: List[ChatMessage] = Field(default_factory=list, description="Prior conversation turns")
    top_k: Optional[int] = Field(4, description="Number of chunks to retrieve")
    stream: bool = Field(False, description="Whether to stream response tokens")
    enable_web_search: bool = Field(False, description="Whether the web search toggle is turned ON")
    force_web_search: bool = Field(False, description="Whether the user explicitly requested web search for this query")


class Citation(BaseModel):
    timestamp: str
    seconds: float
    label: str
    formatted_citation: str


class RetrievedChunk(BaseModel):
    chunk_id: str
    start_seconds: float
    end_seconds: float
    start_timestamp: str
    end_timestamp: str
    timestamp_str: str
    content: str


class EvaluationMetrics(BaseModel):
    faithfulness: float
    answer_relevancy: float
    context_precision: float
    context_recall: float
    rag_quality_score: float
    latency_ms: float
    retrieved_chunks_count: int


class ChatResponse(BaseModel):
    video_id: str
    question: str
    answer: str
    citations: List[Citation] = []
    confidence_score: float
    is_grounded: bool
    retrieved_chunks: List[RetrievedChunk] = []
    latency_ms: float
    evaluation_metrics: EvaluationMetrics
    web_search_used: bool = False


class EvaluateRequest(BaseModel):
    video_id: str
    questions: Optional[List[str]] = None


class TranscriptResponse(BaseModel):
    video_id: str
    metadata: Dict[str, Any]
    total_segments: int
    segments: List[Dict[str, Any]]
