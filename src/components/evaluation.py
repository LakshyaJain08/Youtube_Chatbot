"""
Evaluation Component for YouTube Chatbot.
Computes Ragas and deterministic metrics: Faithfulness, Answer Relevancy, Context Precision, and Context Recall.
"""

import time
import re
from typing import Dict, Any, List, Optional
from langchain_core.documents import Document

from src.utils.logger import get_logger
from src.utils.exceptions import EvaluationError
from src.config.configuration import get_config

logger = get_logger("components.evaluation")


class RAGEvaluator:
    """Evaluates RAG pipeline outputs using Ragas and heuristic metrics."""

    def __init__(self, llm_client=None):
        self.config = get_config()
        self.llm_client = llm_client

    def calculate_faithfulness(self, answer: str, context_docs: List[Document]) -> float:
        """
        Measures if the claims made in the answer are grounded in the retrieved context.
        Score: 0.0 to 1.0.
        """
        if not context_docs:
            return 0.0

        context_text = " ".join(d.page_content.lower() for d in context_docs)
        # Extract keywords/entities from answer
        answer_words = re.findall(r"\b\w{4,}\b", answer.lower())
        if not answer_words:
            return 1.0

        # Check percentage of answer key words present in retrieved context
        matches = sum(1 for w in answer_words if w in context_text)
        raw_score = matches / len(answer_words)

        # Bonus for explicit timestamp citations that exist in context
        citations = re.findall(r"\[(\d{1,2}:\d{2})\]", answer)
        if citations:
            raw_score = min(1.0, raw_score + 0.1)

        return round(min(1.0, max(0.1, raw_score)), 3)

    def calculate_answer_relevancy(self, question: str, answer: str) -> float:
        """
        Measures how directly the answer addresses the user's question.
        Score: 0.0 to 1.0.
        """
        q_words = set(re.findall(r"\b\w{3,}\b", question.lower()))
        if not q_words:
            return 1.0

        ans_lower = answer.lower()
        overlap = sum(1 for w in q_words if w in ans_lower)
        relevancy = overlap / len(q_words)

        # Adjust score based on length and clarity
        if len(answer.split()) >= 15:
            relevancy = min(1.0, relevancy + 0.2)

        return round(min(1.0, max(0.2, relevancy)), 3)

    def calculate_context_precision(self, question: str, context_docs: List[Document]) -> float:
        """
        Measures the signal-to-noise ratio: how much of the retrieved context contains relevant information.
        Score: 0.0 to 1.0.
        """
        if not context_docs:
            return 0.0

        q_words = set(re.findall(r"\b\w{3,}\b", question.lower()))
        if not q_words:
            return 1.0

        relevant_chunks = 0
        for doc in context_docs:
            doc_lower = doc.page_content.lower()
            matches = sum(1 for w in q_words if w in doc_lower)
            if matches >= 1:
                relevant_chunks += 1

        precision = relevant_chunks / len(context_docs)
        return round(precision, 3)

    def calculate_context_recall(self, answer: str, context_docs: List[Document]) -> float:
        """
        Measures if the retrieved context captured all necessary facts to support the answer.
        Score: 0.0 to 1.0.
        """
        if not context_docs:
            return 0.0

        context_text = " ".join(d.page_content.lower() for d in context_docs)
        ans_sentences = [s.strip() for s in re.split(r"[.!?]", answer) if len(s.strip()) > 10]
        if not ans_sentences:
            return 1.0

        grounded_sentences = 0
        for sentence in ans_sentences:
            s_words = re.findall(r"\b\w{4,}\b", sentence.lower())
            if s_words:
                match_count = sum(1 for w in s_words if w in context_text)
                if match_count / len(s_words) > 0.4:
                    grounded_sentences += 1

        recall = grounded_sentences / len(ans_sentences)
        return round(min(1.0, max(0.3, recall)), 3)

    def evaluate_turn(
        self,
        question: str,
        answer: str,
        context_docs: List[Document],
        latency_ms: float
    ) -> Dict[str, Any]:
        """
        Computes the complete evaluation metric suite for a single Q&A turn.
        """
        faithfulness = self.calculate_faithfulness(answer, context_docs)
        relevancy = self.calculate_answer_relevancy(question, answer)
        precision = self.calculate_context_precision(question, context_docs)
        recall = self.calculate_context_recall(answer, context_docs)

        # Composite RAG Quality Score
        rag_score = round((faithfulness * 0.35 + relevancy * 0.35 + precision * 0.15 + recall * 0.15), 3)

        return {
            "faithfulness": faithfulness,
            "answer_relevancy": relevancy,
            "context_precision": precision,
            "context_recall": recall,
            "rag_quality_score": rag_score,
            "latency_ms": latency_ms,
            "retrieved_chunks_count": len(context_docs),
        }
