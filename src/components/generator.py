"""
Generator Component for YouTube Chatbot.
Interfaces with Google Gemini LLMs with automatic multi-model failover
(gemini-flash-latest / gemini-flash-lite-latest / gemini-3.5-flash-lite / gemini-2.5-flash),
handles structured citation extraction, guardrailing, and streaming responses.
"""

import os
import re
import time
from typing import Dict, Any, List, Optional, AsyncIterator, Iterator
from google import genai
from google.genai import types

from src.utils.logger import get_logger
from src.utils.exceptions import LLMGenerationError
from src.utils.common import parse_timestamp_to_seconds, strip_emojis
from src.config.configuration import get_config

logger = get_logger("components.generator")


class ResponseGenerator:
    """Handles LLM generation, streaming, citation extraction, guardrailing, and auto-model fallback."""

    CANDIDATE_MODELS = [
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
    ]

    def __init__(self, api_key: Optional[str] = None):
        self.config = get_config()
        self.api_key = (
            api_key
            or self.config.model.gemini_api_key
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
        )
        self.client: Optional[genai.Client] = None
        self._init_client()

    def _init_client(self):
        """Initializes Google GenAI client."""
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            logger.warning("No valid GEMINI_API_KEY detected. Generator will use mock/offline responses if needed.")
            self.client = None
            return

        try:
            self.client = genai.Client(api_key=self.api_key)
            logger.info("Google GenAI client initialized successfully with model fallback chain.")
        except Exception as e:
            logger.error(f"Failed to initialize Google GenAI client: {e}")
            self.client = None

    def extract_citations(self, text: str) -> List[Dict[str, Any]]:
        """
        Finds all timestamp occurrences like `[04:20]` or `[01:15:30]` in text
        and extracts structured citation objects with click-to-seek seconds.
        """
        citations = []
        pattern = r"\[(\d{1,2}:\d{2}(?::\d{2})?)\]"
        matches = re.finditer(pattern, text)
        seen_timestamps = set()

        for match in matches:
            ts_str = match.group(1)
            if ts_str not in seen_timestamps:
                seen_timestamps.add(ts_str)
                seconds = parse_timestamp_to_seconds(ts_str)
                citations.append({
                    "timestamp": ts_str,
                    "seconds": seconds,
                    "label": f"Jump to {ts_str}",
                    "formatted_citation": f"[{ts_str}]"
                })

        return citations

    def apply_guardrails(self, answer_text: str, context_chunks: List[Any]) -> Dict[str, Any]:
        """
        Guardrail check:
        1. Checks if response admits unknown or not found in transcript.
        2. Calculates grounding confidence score based on citation density and keywords.
        """
        lower_ans = answer_text.lower()
        is_grounded = True
        confidence_score = 0.95

        not_found_indicators = [
            "not discussed",
            "not mentioned",
            "cannot be determined",
            "not in the transcript",
            "does not mention",
            "no mention",
            "i don't know",
            "not present in the video",
        ]

        for indicator in not_found_indicators:
            if indicator in lower_ans:
                is_grounded = False
                confidence_score = 0.4
                break

        citations = self.extract_citations(answer_text)
        if not citations and is_grounded:
            confidence_score = 0.85
        elif citations and is_grounded:
            confidence_score = min(0.99, 0.90 + len(citations) * 0.02)

        return {
            "is_grounded": is_grounded,
            "confidence_score": round(confidence_score, 2),
            "citations_count": len(citations),
        }

    def generate_text(self, prompt: str, max_tokens: int = 2500, temperature: float = 0.2) -> str:
        """Synchronous text generation with seamless multi-model fallback."""
        if self.client is None:
            return (
                "Here is an answer based on the video transcript [00:45]. "
                "The speaker discusses the core topic thoroughly and details key findings at [02:15]."
            )

        last_error = None
        for model_name in self.CANDIDATE_MODELS:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                    )
                )
                if response and response.text:
                    return strip_emojis(response.text.strip())
            except Exception as e:
                logger.warning(f"Model '{model_name}' invocation error ({e}), trying next candidate model...")
                last_error = e

        logger.error(f"All Gemini models in fallback chain failed: {last_error}")
        raise LLMGenerationError(f"Gemini generation failed: {last_error}")

    def generate_response(self, prompt: str, context_docs: List[Any]) -> Dict[str, Any]:
        """
        Executes generation, applies guardrails, extracts citations, and tracks latency.
        """
        start_time = time.time()
        answer = self.generate_text(prompt)
        elapsed_ms = (time.time() - start_time) * 1000

        citations = self.extract_citations(answer)
        guardrail_result = self.apply_guardrails(answer, context_docs)

        return {
            "answer": answer,
            "citations": citations,
            "confidence_score": guardrail_result["confidence_score"],
            "is_grounded": guardrail_result["is_grounded"],
            "latency_ms": round(elapsed_ms, 2),
        }

    async def generate_stream(self, prompt: str) -> AsyncIterator[str]:
        """Asynchronous streaming generator for SSE."""
        if self.client is None:
            mock_tokens = [
                "Here ", "is ", "the ", "answer ", "based ", "on ", "the ", "video ", "transcript ", "[00:45].\n\n",
                "The ", "speaker ", "highlights ", "the ", "key ", "points ", "at ", "[02:30]."
            ]
            for token in mock_tokens:
                yield token
            return

        for model_name in self.CANDIDATE_MODELS:
            try:
                response_stream = self.client.models.generate_content_stream(
                    model=model_name,
                    contents=prompt,
                )
                for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception as e:
                logger.warning(f"Streaming error on model '{model_name}' ({e}), trying next model...")

        yield "\n[Error: Unable to stream from Gemini models]"
