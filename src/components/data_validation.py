"""
Data Validation Component for YouTube Chatbot.
Validates input URLs, transcript contents, and schema constraints.
"""

from typing import Dict, Any, Tuple
from src.utils.logger import get_logger
from src.utils.exceptions import InvalidYouTubeURLError, DataTransformationError
from src.utils.common import extract_video_id
from src.config.configuration import get_config

logger = get_logger("components.data_validation")


class DataValidation:
    """Validates raw inputs and ingested transcript data."""

    def __init__(self):
        self.config = get_config()

    def validate_url_or_id(self, url_or_id: str) -> str:
        """Validates that input is a non-empty, parseable YouTube video identifier."""
        if not url_or_id or not isinstance(url_or_id, str):
            raise InvalidYouTubeURLError("Input URL or Video ID cannot be empty.")
        video_id = extract_video_id(url_or_id)
        logger.debug(f"Validated video ID: {video_id}")
        return video_id

    def validate_ingested_data(self, payload: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validates the structure and length of the ingested transcript payload.
        Returns (is_valid, error_message).
        """
        if not isinstance(payload, dict):
            return False, "Payload must be a dictionary."

        video_id = payload.get("video_id")
        if not video_id:
            return False, "Payload missing 'video_id'."

        segments = payload.get("segments")
        if not segments or not isinstance(segments, list):
            return False, "Payload contains no transcript segments."

        full_text = payload.get("full_text", "")
        if not full_text or len(full_text.strip()) < 10:
            return False, "Transcript text is too short or empty."

        max_allowed = self.config.ingestion.max_transcript_length_chars
        if len(full_text) > max_allowed:
            logger.warning(f"Transcript length ({len(full_text)}) exceeds max allowed {max_allowed}. Will truncate.")

        logger.info(f"Ingested data validation passed for video: {video_id} ({len(segments)} segments, {len(full_text)} chars)")
        return True, "Valid"
