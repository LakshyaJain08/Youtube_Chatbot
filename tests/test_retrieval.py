"""
Unit tests for Staged Hybrid Retrieval and Metadata Pre-Filtering.
"""

import pytest
from langchain_core.documents import Document
from src.components.indexing import IndexingManager
from src.components.retrieval import StagedHybridRetriever, QueryPreprocessor


def test_query_preprocessor_time_intent():
    preprocessor = QueryPreprocessor()

    res1 = preprocessor.extract_time_intent("What happened in the first 5 minutes?")
    assert res1 == (0.0, 300.0)

    res2 = preprocessor.extract_time_intent("What was discussed from 02:30 to 05:00?")
    assert res2 == (150.0, 300.0)

    res3 = preprocessor.extract_time_intent("Tell me about topic at 04:15")
    assert res3 is not None
    assert res3[0] <= 255.0 and res3[1] >= 255.0

    res4 = preprocessor.extract_time_intent("General question with no timestamp")
    assert res4 is None


def test_staged_hybrid_retrieval():
    indexing = IndexingManager(models_dir="outputs/test_models")
    video_id = "test_hybrid_vid"

    sample_docs = [
        Document(
            page_content="Timestamp [00:00 - 01:00]: Introduction to deep neural networks and gradient descent.",
            metadata={"video_id": video_id, "chunk_id": f"{video_id}_chunk_0", "start_seconds": 0.0, "end_seconds": 60.0, "timestamp_str": "[00:00 - 01:00]"}
        ),
        Document(
            page_content="Timestamp [01:00 - 02:30]: AlphaFold 2 and protein 3D structure prediction breakthroughs.",
            metadata={"video_id": video_id, "chunk_id": f"{video_id}_chunk_1", "start_seconds": 60.0, "end_seconds": 150.0, "timestamp_str": "[01:00 - 02:30]"}
        ),
        Document(
            page_content="Timestamp [02:30 - 04:00]: AGI safety, alignment, and future computing hardware architectures.",
            metadata={"video_id": video_id, "chunk_id": f"{video_id}_chunk_2", "start_seconds": 150.0, "end_seconds": 240.0, "timestamp_str": "[02:30 - 04:00]"}
        ),
    ]

    vector_store, bm25_index, docs = indexing.build_indexes(video_id, sample_docs)
    retriever = StagedHybridRetriever(
        vector_store=vector_store,
        bm25_index=bm25_index,
        documents=docs,
        video_id=video_id,
        hybrid_alpha=0.65
    )

    # Test keyword query retrieval
    results = retriever.retrieve(query="What is AlphaFold and protein structure?", top_k=2)
    assert len(results) > 0
    # At least one retrieved chunk must be the AlphaFold chunk
    assert any("alphafold" in d.page_content.lower() or "protein" in d.page_content.lower() for d in results)

    # Test time-filtered retrieval
    time_results = retriever.retrieve(query="What was said in the first 1 minute?", top_k=1)
    assert len(time_results) == 1
    assert time_results[0].metadata["start_seconds"] <= 60.0
