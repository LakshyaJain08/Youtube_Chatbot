"""
Custom exceptions for the YouTube Chatbot application.
"""

class YouTubeChatbotException(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __str__(self):
        if self.details:
            return f"{self.message} | Details: {self.details}"
        return self.message


class InvalidYouTubeURLError(YouTubeChatbotException):
    """Raised when a provided YouTube URL or ID cannot be parsed or is invalid."""
    pass


class TranscriptNotFoundError(YouTubeChatbotException):
    """Raised when no subtitles/transcripts are available for a video."""
    pass


class VideoMetadataFetchError(YouTubeChatbotException):
    """Raised when video metadata cannot be fetched."""
    pass


class DataTransformationError(YouTubeChatbotException):
    """Raised during text chunking or data preprocessing failures."""
    pass


class IndexingError(YouTubeChatbotException):
    """Raised when vector store or BM25 index creation fails."""
    pass


class RetrievalError(YouTubeChatbotException):
    """Raised during retrieval or filtering failures."""
    pass


class LLMGenerationError(YouTubeChatbotException):
    """Raised when Gemini API generation fails."""
    pass


class EvaluationError(YouTubeChatbotException):
    """Raised during Ragas / evaluation metrics calculation."""
    pass
