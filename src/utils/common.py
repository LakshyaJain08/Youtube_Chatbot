"""
Common utility functions for YouTube Chatbot.
"""

import os
import re
import json
from pathlib import Path
from typing import Optional, Dict, Any, Union
from urllib.parse import urlparse, parse_qs
from src.utils.logger import get_logger
from src.utils.exceptions import InvalidYouTubeURLError

logger = get_logger("utils.common")


def extract_video_id(url_or_id: str) -> str:
    """
    Extract standard 11-character YouTube video ID from any valid YouTube URL or raw ID.
    Supports:
      - Raw ID: 'Gfr50f6ZBvo'
      - Standard: 'https://www.youtube.com/watch?v=Gfr50f6ZBvo'
      - Short link: 'https://youtu.be/Gfr50f6ZBvo'
      - Shorts: 'https://www.youtube.com/shorts/Gfr50f6ZBvo'
      - Embed: 'https://www.youtube.com/embed/Gfr50f6ZBvo'
      - Live: 'https://www.youtube.com/live/Gfr50f6ZBvo'
      - Mobile: 'https://m.youtube.com/watch?v=Gfr50f6ZBvo'
      - With timestamps: 'https://youtu.be/Gfr50f6ZBvo?t=120'
    """
    if not url_or_id or not isinstance(url_or_id, str):
        raise InvalidYouTubeURLError("Input YouTube URL/ID cannot be empty.")

    clean_input = url_or_id.strip()

    # If already a valid 11-char video ID (alphanumeric + _ -)
    if re.fullmatch(r"^[a-zA-Z0-9_-]{11}$", clean_input):
        return clean_input

    # Parse using regex patterns for YouTube URLs
    patterns = [
        r"(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})",
        r"(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})",
        r"(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})",
        r"(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})",
        r"(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})",
        r"(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})",
    ]

    for pattern in patterns:
        match = re.search(pattern, clean_input)
        if match:
            return match.group(1)

    # Fallback to urllib parsing
    try:
        parsed = urlparse(clean_input)
        if "youtube.com" in parsed.netloc:
            query_params = parse_qs(parsed.query)
            if "v" in query_params and query_params["v"]:
                vid = query_params["v"][0]
                if re.fullmatch(r"^[a-zA-Z0-9_-]{11}$", vid):
                    return vid
        elif "youtu.be" in parsed.netloc:
            path_parts = parsed.path.strip("/").split("/")
            if path_parts and re.fullmatch(r"^[a-zA-Z0-9_-]{11}$", path_parts[0]):
                return path_parts[0]
    except Exception as e:
        logger.warning(f"Error during fallback urlparse on '{clean_input}': {e}")

    raise InvalidYouTubeURLError(f"Could not extract a valid 11-character YouTube video ID from: '{clean_input}'")


def format_seconds_to_timestamp(seconds: Union[int, float]) -> str:
    """Converts seconds into MM:SS or HH:MM:SS format."""
    total_sec = max(0, int(seconds))
    hours = total_sec // 3600
    minutes = (total_sec % 3600) // 60
    secs = total_sec % 60

    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def parse_timestamp_to_seconds(timestamp_str: str) -> float:
    """Parses MM:SS or HH:MM:SS or raw seconds string into float seconds."""
    if not timestamp_str:
        return 0.0

    clean_str = timestamp_str.strip("[]() ")

    # Check if purely float/int
    try:
        return float(clean_str)
    except ValueError:
        pass

    parts = clean_str.split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
    except Exception:
        pass

    return 0.0


def save_json(file_path: Union[str, Path], data: Any) -> None:
    """Saves data to a JSON file, creating parent directories if needed."""
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_json(file_path: Union[str, Path]) -> Optional[Any]:
    """Loads JSON data from file if exists, else returns None."""
    path = Path(file_path)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
