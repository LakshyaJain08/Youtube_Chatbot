"""
Augmentation Component for YouTube Chatbot.
Constructs optimized, grounded prompt templates with strict citation constraints and token budgeting.
"""

from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate

from src.utils.logger import get_logger
from src.config.configuration import get_config

logger = get_logger("components.augmentation")


SYSTEM_PROMPT_TEMPLATE = """You are an expert, precise YouTube Chatbot analyzing a YouTube video.
Your goal is to provide helpful, concise, and factually grounded answers using ONLY the provided transcript segments.

CRITICAL GROUNDING RULES:
1. Ground your answer in the provided transcript context. Connect related technical concepts, terminology, and synonyms discussed in the video (for example, Machine Learning / ML encompasses Large Language Models, neural networks, AI architectures, weights, fine-tuning, training, embeddings, Ollama, and generative AI models). Synthesize what the speaker explains regarding the user's inquiry and ground every key point with relevant timestamp citations.
2. MULTILINGUAL & CROSS-LINGUAL UNDERSTANDING: The video transcript may be in English, Hindi, Hinglish (Hindi transcribed in Devanagari or Latin script), or other languages. You MUST understand transcripts in any language, cross-lingually analyze them, and formulate your detailed response in the language of the user's question (e.g., answer in clear English if the user asks in English).
3. Only if the video genuinely does not discuss or relate to the topic, state clearly: "Based on the video transcript, this topic is not discussed in the provided context." Do NOT reject questions due to acronyms, language differences, or conceptual synonyms (e.g. treating "ML" as unknown when the video covers LLMs, models, or AI).
4. CITATION RULE: Whenever you state a key fact, point, or quote, you MUST cite the relevant timestamp using the format `[MM:SS]` (e.g. `[04:15]` or `[01:23:45]`). This allows users to click and jump to that exact moment in the video.
5. Keep the tone professional, objective, clear, and well-structured (use bullet points and bold highlights for readability).
6. NO EMOJIS: Do NOT include any emojis or decorative emoji symbols anywhere in your response. Maintain a clean, professional, and corporate/academic tone.

---
TRANSCRIPT CONTEXT:
{context}
---

CONVERSATION HISTORY:
{history}

USER QUESTION: {question}

DETAILED GROUNDED RESPONSE:"""


SUMMARY_PROMPT_TEMPLATE = """You are an expert AI summarizer analyzing the following YouTube video transcript.
Video Title: {title}
Creator: {author}

TRANSCRIPT CONTEXT:
{context}

Provide a structured, professional summary of the video containing:
1. **Executive Summary**: A concise 2-3 sentence overview of the video's core theme.
2. **Key Takeaways & Highlights**: 4-6 bullet points of the most valuable insights with relevant timestamp citations `[MM:SS]`.
3. **Main Chapters / Topics Discussed**: Chronological breakdown of major topics with timestamps.
4. **Memorable Quote or Final Thought**: An impactful statement from the speaker if available.

CRITICAL FORMATTING RULE: Do NOT use any emojis or decorative emoji symbols anywhere in the summary. Keep the tone polished and professional.

SUMMARY:"""


QUIZ_PROMPT_TEMPLATE = """You are an interactive learning assistant. Based ONLY on the video transcript below, create a 3-question interactive quiz to test comprehension.

TRANSCRIPT CONTEXT:
{context}

For each question:
- State the question clearly
- Provide 4 multiple-choice options (A, B, C, D)
- Indicate the Correct Answer and provide a brief explanation with the exact timestamp citation `[MM:SS]`.

CRITICAL FORMATTING RULE: Do NOT use any emojis. Maintain a clean, professional educational format.

QUIZ:"""


WEB_SEARCH_PROMPT_TEMPLATE = """You are an expert, helpful AI assistant answering a user's question with live DuckDuckGo web search results.
Context: The user asked this question about a video, but the requested topic was not in the video transcript. You are now providing a comprehensive, tailored answer using external web knowledge.

USER QUESTION:
{question}

WEB SEARCH RESULTS:
{web_results}

CONVERSATION HISTORY:
{history}

INSTRUCTIONS:
1. Provide a comprehensive, accurate, and direct answer to the user's question synthesized from the web search results.
2. Structure your response clearly using bullet points, bold key terms, and concise paragraphs.
3. Explicitly state that this answer was retrieved from live web search.
4. If sources or URLs are present in the search results, cite them clearly.
5. Do NOT use emojis or decorative icons in your response. Keep the tone professional, objective, and clean.

ANSWER:"""


class PromptAugmenter:
    """Builds optimized prompts and handles context formatting."""

    def __init__(self):
        self.config = get_config()
        self.qa_prompt = PromptTemplate(
            template=SYSTEM_PROMPT_TEMPLATE,
            input_variables=["context", "history", "question"]
        )
        self.summary_prompt = PromptTemplate(
            template=SUMMARY_PROMPT_TEMPLATE,
            input_variables=["title", "author", "context"]
        )
        self.quiz_prompt = PromptTemplate(
            template=QUIZ_PROMPT_TEMPLATE,
            input_variables=["context"]
        )
        self.web_search_prompt = PromptTemplate(
            template=WEB_SEARCH_PROMPT_TEMPLATE,
            input_variables=["question", "web_results", "history"]
        )

    def format_context_documents(self, documents: List[Document]) -> str:
        """
        Formats retrieved documents into a clean, token-efficient context string
        with timestamp annotations.
        """
        if not documents:
            return "No transcript context available."

        formatted_blocks = []
        for i, doc in enumerate(documents, start=1):
            ts_str = doc.metadata.get("timestamp_str", f"[{doc.metadata.get('start_timestamp', '00:00')}]")
            content = doc.page_content.strip()
            # Clean redundancy if page_content already starts with Timestamp
            if not content.startswith("Timestamp"):
                formatted_blocks.append(f"Segment {i} ({ts_str}):\n{content}")
            else:
                formatted_blocks.append(f"Segment {i} - {content}")

        return "\n\n".join(formatted_blocks)

    def format_history(self, history: Optional[List[Dict[str, str]]] = None) -> str:
        """Formats multi-turn conversation history."""
        if not history:
            return "No previous conversation."

        recent = history[-4:]
        lines = []
        for turn in recent:
            role = turn.get("role", "user").capitalize()
            content = turn.get("content", "").strip()
            if content:
                lines.append(f"{role}: {content}")

        return "\n".join(lines) if lines else "No previous conversation."

    def build_qa_prompt(
        self,
        question: str,
        documents: List[Document],
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Constructs final augmented QA prompt for the LLM."""
        context_str = self.format_context_documents(documents)
        history_str = self.format_history(history)
        return self.qa_prompt.format(
            context=context_str,
            history=history_str,
            question=question
        )

    def build_summary_prompt(self, documents: List[Document], metadata: Dict[str, Any]) -> str:
        """Constructs prompt for generating video summary."""
        context_str = self.format_context_documents(documents)
        return self.summary_prompt.format(
            title=metadata.get("title", "YouTube Video"),
            author=metadata.get("author", "Creator"),
            context=context_str
        )

    def build_quiz_prompt(self, documents: List[Document]) -> str:
        """Constructs prompt for generating interactive quiz."""
        context_str = self.format_context_documents(documents)
        return self.quiz_prompt.format(context=context_str)

    def build_web_search_prompt(
        self,
        question: str,
        web_results: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Constructs prompt for answering with DuckDuckGo web search results."""
        history_str = self.format_history(history)
        return self.web_search_prompt.format(
            question=question,
            web_results=web_results,
            history=history_str
        )
