"""
Ingestion Pipeline for YouTube Chatbot.
Orchestrates: Ingest -> Validate -> Transform -> Index.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
from langchain_core.documents import Document

from src.utils.logger import get_logger
from src.utils.common import save_json, load_json
from src.components.data_ingestion import DataIngestion
from src.components.data_validation import DataValidation
from src.components.data_transformation import DataTransformation
from src.components.indexing import IndexingManager
from src.components.augmentation import PromptAugmenter
from src.components.generator import ResponseGenerator
from src.config.configuration import get_config

logger = get_logger("pipelines.ingestion_pipeline")


class IngestionPipeline:
    """End-to-End Ingestion Pipeline."""

    def __init__(self):
        self.config = get_config()
        self.ingestion = DataIngestion()
        self.validation = DataValidation()
        self.transformation = DataTransformation()
        self.indexing = IndexingManager()
        self.augmenter = PromptAugmenter()
        self.generator = ResponseGenerator()

    def run(self, url_or_id: str, force_reindex: bool = False) -> Dict[str, Any]:
        """
        Executes complete ingestion flow:
        1. Parse and validate YouTube URL / video ID
        2. Fetch video metadata & transcript
        3. Validate ingested payload
        4. Chunk transcript preserving timestamps
        5. Build or load FAISS + BM25 indexes
        6. Generate executive summary and suggested questions
        """
        video_id = self.validation.validate_url_or_id(url_or_id)
        logger.info(f"--- Starting Ingestion Pipeline for: {video_id} ---")

        # Step 1 & 2: Ingestion & Metadata
        payload = self.ingestion.ingest(video_id)

        # Step 3: Validation
        is_valid, err_msg = self.validation.validate_ingested_data(payload)
        if not is_valid:
            raise ValueError(f"Data validation failed: {err_msg}")

        # Step 4: Transformation
        chunks = self.transformation.transform(payload)

        # Step 5: Indexing (Check disk cache unless force_reindex=True)
        if not force_reindex and self.indexing.is_indexed(video_id):
            logger.info(f"Video {video_id} already indexed on disk. Loading cached index...")
            vector_store, bm25_index, indexed_docs = self.indexing.load_indexes(video_id)
        else:
            logger.info(f"Building fresh indexes for {video_id}...")
            vector_store, bm25_index, indexed_docs = self.indexing.build_indexes(video_id, chunks)

        # Step 6: Generate Summary and Starter Questions with full video coverage
        summary_cache_file = Path(self.config.indexing.models_dir) / video_id / "summary.json"
        summary_text = None
        summary_citations = []

        if not force_reindex and summary_cache_file.exists():
            try:
                cached_data = load_json(summary_cache_file)
                if cached_data and cached_data.get("summary") and len(cached_data.get("summary", "").strip()) > 50:
                    logger.info(f"Loaded cached executive summary for video {video_id}")
                    summary_text = cached_data["summary"]
                    summary_citations = cached_data.get("summary_citations", [])
            except Exception as e:
                logger.warning(f"Could not load cached summary: {e}")

        if not summary_text:
            if len(chunks) <= 12:
                sample_chunks = chunks
            else:
                step = len(chunks) / 12.0
                indices = [int(i * step) for i in range(12)]
                sample_chunks = [chunks[i] for i in indices]

            summary_prompt = self.augmenter.build_summary_prompt(sample_chunks, payload["metadata"])
            
            try:
                summary_res = self.generator.generate_response(summary_prompt, sample_chunks)
                summary_text = summary_res["answer"]
                summary_citations = summary_res["citations"]
                # Cache generated summary to disk
                save_json(summary_cache_file, {
                    "video_id": video_id,
                    "summary": summary_text,
                    "summary_citations": summary_citations
                })
                logger.info(f"Generated and cached rich summary for video {video_id}")
            except Exception as e:
                logger.warning(f"Could not generate AI summary: {e}")
                summary_text = (
                    f"### {payload['metadata']['title']}\n\n"
                    f"Video by **{payload['metadata']['author']}** ({payload['metadata'].get('duration_str', '')}).\n\n"
                    f"Full transcript with {len(chunks)} timestamped segments is indexed and ready for interactive questions!"
                )
                summary_citations = []

        # Suggest smart starter questions based on title & duration
        suggested_questions = [
            "What is the main topic and core takeaway of this video?",
            "Can you provide a chronological breakdown of the key topics discussed?",
            "What were the most important arguments or insights shared by the speaker?",
            "Generate a 3-question quiz based on this video to test my understanding."
        ]

        logger.info(f"--- Ingestion Pipeline completed successfully for: {video_id} ---")

        return {
            "video_id": video_id,
            "metadata": payload["metadata"],
            "total_chunks": len(chunks),
            "summary": summary_text,
            "summary_citations": summary_citations,
            "suggested_questions": suggested_questions,
            "chunks": [
                {
                    "chunk_id": d.metadata.get("chunk_id"),
                    "start_seconds": d.metadata.get("start_seconds"),
                    "end_seconds": d.metadata.get("end_seconds"),
                    "timestamp_str": d.metadata.get("timestamp_str"),
                    "text": d.page_content,
                }
                for d in chunks
            ],
            "is_ready": True,
        }
