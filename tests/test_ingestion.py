"""
Unit tests for Ingestion and Transformation components.
"""

import pytest
from src.utils.common import extract_video_id, format_seconds_to_timestamp, parse_timestamp_to_seconds
from src.utils.exceptions import InvalidYouTubeURLError
from src.components.data_transformation import DataTransformation
from src.components.data_validation import DataValidation


def test_extract_video_id_standard():
    assert extract_video_id("https://www.youtube.com/watch?v=Gfr50f6ZBvo") == "Gfr50f6ZBvo"
    assert extract_video_id("https://youtu.be/Gfr50f6ZBvo") == "Gfr50f6ZBvo"
    assert extract_video_id("https://www.youtube.com/shorts/Gfr50f6ZBvo") == "Gfr50f6ZBvo"
    assert extract_video_id("https://www.youtube.com/embed/Gfr50f6ZBvo") == "Gfr50f6ZBvo"
    assert extract_video_id("Gfr50f6ZBvo") == "Gfr50f6ZBvo"
    assert extract_video_id("https://youtu.be/Gfr50f6ZBvo?t=120") == "Gfr50f6ZBvo"


def test_extract_video_id_invalid():
    with pytest.raises(InvalidYouTubeURLError):
        extract_video_id("invalid_url_without_id")
    with pytest.raises(InvalidYouTubeURLError):
        extract_video_id("")


def test_timestamp_converters():
    assert format_seconds_to_timestamp(45) == "00:45"
    assert format_seconds_to_timestamp(125) == "02:05"
    assert format_seconds_to_timestamp(3665) == "01:01:05"

    assert parse_timestamp_to_seconds("02:05") == 125.0
    assert parse_timestamp_to_seconds("01:01:05") == 3665.0
    assert parse_timestamp_to_seconds("[02:05]") == 125.0


def test_data_transformation_chunking():
    transformer = DataTransformation(processed_data_dir="outputs/test_processed")
    mock_payload = {
        "video_id": "test1234567",
        "metadata": {"title": "Test Video", "author": "Test Author"},
        "segments": [
            {"text": "Hello world and welcome to this AI lecture.", "start": 0.0, "duration": 4.0},
            {"text": "Today we discuss transformer attention mechanisms.", "start": 4.5, "duration": 5.0},
            {"text": "Self-attention computes dynamic weights over all tokens.", "start": 10.0, "duration": 6.0},
        ],
        "full_text": "Hello world and welcome to this AI lecture. Today we discuss transformer attention mechanisms. Self-attention computes dynamic weights over all tokens."
    }

    chunks = transformer.transform(mock_payload)
    assert len(chunks) >= 1
    first_chunk = chunks[0]
    assert first_chunk.metadata["video_id"] == "test1234567"
    assert "start_seconds" in first_chunk.metadata
    assert "end_seconds" in first_chunk.metadata
    assert "timestamp_str" in first_chunk.metadata
    assert "Timestamp" in first_chunk.page_content
