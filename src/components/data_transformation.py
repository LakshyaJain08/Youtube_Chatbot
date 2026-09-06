"""
Data Transformation Component for YouTube Chatbot.
Performs smart, timestamp-preserving chunking and document construction with metadata.
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
from langchain_core.documents import Document

from src.utils.logger import get_logger
from src.utils.exceptions import DataTransformationError
from src.utils.common import format_seconds_to_timestamp, save_json
from src.config.configuration import get_config

logger = get_logger("components.data_transformation")


class DataTransformation:
    """Transforms raw transcript segments into timestamp-annotated chunk Documents."""

    def __init__(self, processed_data_dir: Optional[str] = None):
        self.config = get_config()
        self.processed_data_dir = Path(processed_data_dir or self.config.ingestion.processed_data_dir)
        self.processed_data_dir.mkdir(parents=True, exist_ok=True)

    def transform(self, payload: Dict[str, Any]) -> List[Document]:
        """
        Takes raw ingestion payload and generates timestamp-aware LangChain Documents.
        Aggregates segments into chunks around `chunk_size` characters with `chunk_overlap`.
        """
        video_id = payload.get("video_id")
        metadata = payload.get("metadata", {})
        segments = payload.get("segments", [])

        if not segments:
            raise DataTransformationError(f"Cannot transform empty segments for video: {video_id}")

        chunk_size = self.config.transformation.chunk_size
        chunk_overlap = self.config.transformation.chunk_overlap

        chunks: List[Document] = []
        current_chunk_words: List[str] = []
        current_start_time: float = 0.0
        current_end_time: float = 0.0
        current_char_count: int = 0
        chunk_index: int = 0

        # Maintain a sliding buffer of segments for overlap calculation
        segment_buffer: List[Dict[str, Any]] = []

        for seg_idx, seg in enumerate(segments):
            text = seg.get("text", "").strip()
            if not text:
                continue

            start = float(seg.get("start", 0.0))
            duration = float(seg.get("duration", 0.0))
            end = start + duration

            if not current_chunk_words:
                current_start_time = start

            segment_buffer.append(seg)
            current_chunk_words.append(text)
            current_end_time = end
            current_char_count += len(text) + 1

            # Check if chunk threshold reached
            if current_char_count >= chunk_size or seg_idx == len(segments) - 1:
                chunk_text = " ".join(current_chunk_words)
                start_str = format_seconds_to_timestamp(current_start_time)
                end_str = format_seconds_to_timestamp(current_end_time)
                timestamp_str = f"[{start_str} - {end_str}]"
                chunk_id = f"{video_id}_chunk_{chunk_index:04d}"

                doc_metadata = {
                    "video_id": video_id,
                    "chunk_id": chunk_id,
                    "chunk_index": chunk_index,
                    "start_seconds": round(current_start_time, 2),
                    "end_seconds": round(current_end_time, 2),
                    "start_timestamp": start_str,
                    "end_timestamp": end_str,
                    "timestamp_str": timestamp_str,
                    "title": metadata.get("title", ""),
                    "author": metadata.get("author", ""),
                    "char_count": len(chunk_text),
                    "word_count": len(chunk_text.split()),
                }

                # Construct page content prefixed with timestamp header for enhanced semantic grounding
                formatted_page_content = f"Timestamp {timestamp_str}: {chunk_text}"

                doc = Document(page_content=formatted_page_content, metadata=doc_metadata)
                chunks.append(doc)
                chunk_index += 1

                # Calculate overlap: keep recent segments whose text length fits within chunk_overlap
                overlap_words: List[str] = []
                overlap_chars: int = 0
                overlap_start: float = current_end_time

                for back_seg in reversed(segment_buffer):
                    b_text = back_seg.get("text", "").strip()
                    if overlap_chars + len(b_text) <= chunk_overlap:
                        overlap_words.insert(0, b_text)
                        overlap_chars += len(b_text) + 1
                        overlap_start = float(back_seg.get("start", 0.0))
                    else:
                        break

                current_chunk_words = overlap_words
                current_char_count = overlap_chars
                current_start_time = overlap_start
                segment_buffer = [s for s in segment_buffer if float(s.get("start", 0.0)) >= overlap_start]

        logger.info(f"Transformation complete for {video_id}: generated {len(chunks)} timestamped chunks.")

        # Save processed chunks metadata to disk
        processed_file = self.processed_data_dir / f"{video_id}_chunks.json"
        serializable_chunks = [
            {"page_content": d.page_content, "metadata": d.metadata}
            for d in chunks
        ]
        save_json(processed_file, serializable_chunks)

        return chunks
