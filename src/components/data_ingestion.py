"""
Data Ingestion Component for YouTube Chatbot.
Handles YouTube URL parsing, metadata extraction, and transcript retrieval with multi-language fallback.
"""

from typing import Dict, Any, List, Optional
from pathlib import Path
import requests
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, CouldNotRetrieveTranscript

from src.utils.logger import get_logger
from src.utils.exceptions import InvalidYouTubeURLError, TranscriptNotFoundError, VideoMetadataFetchError
from src.utils.common import extract_video_id, save_json, format_seconds_to_timestamp
from src.config.configuration import get_config

logger = get_logger("components.data_ingestion")


class DataIngestion:
    """Ingests YouTube video metadata and transcripts."""

    def __init__(self, raw_data_dir: Optional[str] = None):
        self.config = get_config()
        self.raw_data_dir = Path(raw_data_dir or self.config.ingestion.raw_data_dir)
        self.raw_data_dir.mkdir(parents=True, exist_ok=True)
        self.api = YouTubeTranscriptApi()

    def fetch_metadata(self, video_id: str) -> Dict[str, Any]:
        """Fetches video title, author, thumbnail, and embed details via YouTube oEmbed API."""
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        try:
            response = requests.get(oembed_url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return {
                    "video_id": video_id,
                    "title": data.get("title", f"YouTube Video ({video_id})"),
                    "author": data.get("author_name", "Unknown Creator"),
                    "author_url": data.get("author_url", ""),
                    "thumbnail_url": data.get("thumbnail_url", f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"),
                    "provider": data.get("provider_name", "YouTube"),
                }
            else:
                logger.warning(f"oEmbed API returned status {response.status_code} for {video_id}. Using fallback metadata.")
        except Exception as e:
            logger.warning(f"Failed to fetch oEmbed metadata for {video_id}: {e}")

        # Fallback metadata
        return {
            "video_id": video_id,
            "title": f"YouTube Video ({video_id})",
            "author": "YouTube Creator",
            "author_url": f"https://www.youtube.com/watch?v={video_id}",
            "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "provider": "YouTube",
        }

    def fetch_transcript(self, video_id: str, languages: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Fetches transcript segments for the video.
        Attempts requested languages, manual transcripts, auto-generated transcripts, or translation fallback.
        """
        target_languages = languages or self.config.ingestion.default_languages
        clean_langs = [l for l in target_languages if l != "auto"]
        if not clean_langs:
            clean_langs = ["en", "en-US", "en-GB"]

        try:
            # First attempt: direct fetch with preferred languages
            fetched = self.api.fetch(video_id, languages=clean_langs)
            return fetched.to_raw_data()
        except (NoTranscriptFound, TranscriptsDisabled, CouldNotRetrieveTranscript) as direct_err:
            logger.info(f"Direct fetch for {clean_langs} failed: {direct_err}. Trying transcript list fallback...")

        try:
            # Second attempt: list all transcripts and select the best available
            transcript_list = self.api.list(video_id)
            
            # 1. Try finding any manual transcript
            for t in transcript_list:
                if not t.is_generated:
                    logger.info(f"Using manual transcript in language: {t.language_code}")
                    return t.fetch().to_raw_data()

            # 2. Try finding any auto-generated English transcript
            for t in transcript_list:
                if t.language_code.startswith("en"):
                    logger.info(f"Using generated English transcript: {t.language_code}")
                    return t.fetch().to_raw_data()

            # 3. Try finding any transcript and translate to English if possible
            for t in transcript_list:
                if t.is_translatable:
                    logger.info(f"Translating {t.language_code} transcript to English")
                    return t.translate("en").fetch().to_raw_data()

            # 4. Fallback: take the very first available transcript
            first_t = next(iter(transcript_list), None)
            if first_t:
                logger.info(f"Using first available transcript: {first_t.language_code}")
                return first_t.fetch().to_raw_data()

        except Exception as list_err:
            logger.error(f"Transcript listing failed for {video_id}: {list_err}")

        raise TranscriptNotFoundError(
            f"No transcript or captions found for video ID: {video_id}. "
            "Please check if captions/subtitles are enabled on this video."
        )

    def ingest(self, url_or_id: str, languages: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Main entrypoint: parses input URL/ID, fetches metadata & transcript, and caches raw data.
        Returns complete ingested document payload.
        """
        video_id = extract_video_id(url_or_id)
        logger.info(f"Starting ingestion for video_id: {video_id}")

        # Fetch metadata and transcript
        metadata = self.fetch_metadata(video_id)
        segments = self.fetch_transcript(video_id, languages)

        # Compute full transcript text and duration
        full_text = " ".join(seg.get("text", "").strip() for seg in segments if seg.get("text"))
        
        last_seg = segments[-1] if segments else {}
        total_duration_sec = (last_seg.get("start", 0) + last_seg.get("duration", 0)) if segments else 0
        metadata["duration_seconds"] = round(total_duration_sec, 2)
        metadata["duration_str"] = format_seconds_to_timestamp(total_duration_sec)
        metadata["total_segments"] = len(segments)
        metadata["total_words"] = len(full_text.split())

        ingestion_payload = {
            "video_id": video_id,
            "metadata": metadata,
            "segments": segments,
            "full_text": full_text,
        }

        # Cache raw data to disk
        raw_file_path = self.raw_data_dir / f"{video_id}.json"
        save_json(raw_file_path, ingestion_payload)
        logger.info(f"Successfully ingested {len(segments)} segments for video {video_id} ({metadata['title']})")

        return ingestion_payload
