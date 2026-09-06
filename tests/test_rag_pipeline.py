"""
Unit tests for Generator, Citations, Augmentation, and Ragas Evaluation.
"""

import pytest
from langchain_core.documents import Document
from src.components.generator import ResponseGenerator
from src.components.augmentation import PromptAugmenter
from src.components.evaluation import RAGEvaluator


def test_citation_extraction():
    generator = ResponseGenerator()
    sample_text = (
        "AlphaFold was introduced at [02:15] to solve protein folding. "
        "Later at [05:40], the speaker discusses its biological impact."
    )
    citations = generator.extract_citations(sample_text)
    assert len(citations) == 2
    assert citations[0]["timestamp"] == "02:15"
    assert citations[0]["seconds"] == 135.0
    assert citations[1]["timestamp"] == "05:40"
    assert citations[1]["seconds"] == 340.0


def test_guardrails_evaluation():
    generator = ResponseGenerator()

    # Grounded answer
    grounded_res = generator.apply_guardrails(
        "AlphaFold accelerates drug discovery as discussed at [03:20].", []
    )
    assert grounded_res["is_grounded"] is True
    assert grounded_res["confidence_score"] >= 0.85

    # Not found answer
    unknown_res = generator.apply_guardrails(
        "Based on the video transcript, this topic is not discussed.", []
    )
    assert unknown_res["is_grounded"] is False
    assert unknown_res["confidence_score"] <= 0.5


def test_rag_evaluation_metrics():
    evaluator = RAGEvaluator()
    docs = [
        Document(page_content="Timestamp [01:00]: Transformers rely on multi-head self-attention mechanisms to model long-range context."),
        Document(page_content="Timestamp [02:00]: DeepMind researchers applied scaling laws to train large models efficiently.")
    ]

    question = "How do transformers model long-range context?"
    answer = "Transformers rely on multi-head self-attention to model long-range context at [01:00]."

    metrics = evaluator.evaluate_turn(
        question=question,
        answer=answer,
        context_docs=docs,
        latency_ms=180.0
    )

    assert "faithfulness" in metrics
    assert "answer_relevancy" in metrics
    assert "context_precision" in metrics
    assert "context_recall" in metrics
    assert "rag_quality_score" in metrics
    assert metrics["faithfulness"] > 0.5
    assert metrics["rag_quality_score"] > 0.5
