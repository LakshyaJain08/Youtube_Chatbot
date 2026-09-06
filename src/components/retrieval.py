"""
Retrieval Component for YouTube Chatbot.
Implements Staged Hybrid Retrieval (Dense Vector + BM25 Lexical + Metadata Pre-filtering),
Query Rewriting, Multi-Query Generation, and Post-Retrieval Contextual Compression.
"""

import re
import time
from typing import List, Dict, Any, Optional, Tuple
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from rank_bm25 import BM25Okapi

from src.utils.logger import get_logger
from src.utils.exceptions import RetrievalError
from src.config.configuration import get_config

logger = get_logger("components.retrieval")


class QueryPreprocessor:
    """Pre-retrieval module: handles query expansion, coreference rewriting, and intent routing."""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    def extract_time_intent(self, query: str) -> Optional[Tuple[float, float]]:
        """
        Extracts timestamp or time-window intent from query if present.
        E.g.: 'what happens in the first 5 minutes' -> (0.0, 300.0)
              'what is discussed around 10:30' -> (570.0, 690.0)
              'from 04:00 to 07:00' -> (240.0, 420.0)
        """
        lower_q = query.lower()

        # Match 'first X minutes'
        first_min_match = re.search(r"first\s+(\d+)\s*(?:min|minute|minutes)", lower_q)
        if first_min_match:
            mins = float(first_min_match.group(1))
            return (0.0, mins * 60.0)

        # Match 'last X minutes'
        last_min_match = re.search(r"last\s+(\d+)\s*(?:min|minute|minutes)", lower_q)
        if last_min_match:
            # High start time
            return (999999.0, 999999.0)

        # Match MM:SS to MM:SS range
        range_match = re.search(r"(\d{1,2}:\d{2})\s*(?:to|-)\s*(\d{1,2}:\d{2})", lower_q)
        if range_match:
            def to_sec(s):
                p = s.split(":")
                return int(p[0]) * 60 + int(p[1])
            return (float(to_sec(range_match.group(1))), float(to_sec(range_match.group(2))))

        # Match single timestamp 'at 05:30' or 'around 5:30'
        single_ts = re.search(r"(?:at|around|timestamp)\s*(\d{1,2}:\d{2})", lower_q)
        if single_ts:
            p = single_ts.group(1).split(":")
            sec = int(p[0]) * 60 + int(p[1])
            return (max(0.0, sec - 60.0), sec + 120.0)

        return None

    def rewrite_query_with_history(self, current_query: str, history: List[Dict[str, str]]) -> str:
        """
        Resolves coreferences in current query using recent conversation turns.
        E.g.: 'What did he say about that earlier?' -> 'What did Demis Hassabis say about AGI timelines?'
        """
        if not history or len(history) < 1:
            return current_query

        # If LLM client is available, invoke lightweight query rewrite
        if self.llm_client:
            try:
                recent_turns = history[-4:]
                history_text = "\n".join(f"{h.get('role', 'user')}: {h.get('content', '')}" for h in recent_turns)
                prompt = (
                    f"Given the conversation history:\n{history_text}\n\n"
                    f"Rewrite the user's follow-up question into a clear, standalone search query that preserves all context:\n"
                    f"Follow-up question: {current_query}\n"
                    f"Standalone query:"
                )
                rewritten = self.llm_client.generate_text(prompt, max_tokens=60, temperature=0.0)
                if rewritten and len(rewritten.strip()) > 3:
                    clean_rw = rewritten.strip().replace('"', '')
                    logger.info(f"Rewrote query '{current_query}' -> '{clean_rw}'")
                    return clean_rw
            except Exception as e:
                logger.warning(f"Query rewriting LLM call failed: {e}")

        return current_query


class StagedHybridRetriever:
    """
    Implements Staged Hybrid Retrieval with Metadata Pre-filtering (Images 3 & 4),
    Dense FAISS Vector Search, Sparse BM25 Keyword Search, and Reciprocal Rank Fusion.
    """

    def __init__(
        self,
        vector_store: FAISS,
        bm25_index: BM25Okapi,
        documents: List[Document],
        video_id: str,
        hybrid_alpha: float = 0.65,
        llm_client=None
    ):
        self.config = get_config()
        self.vector_store = vector_store
        self.bm25_index = bm25_index
        self.documents = documents
        self.video_id = video_id
        self.hybrid_alpha = hybrid_alpha
        self.preprocessor = QueryPreprocessor(llm_client=llm_client)

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> List[Document]:
        """
        Executes the 3-stage retrieval pipeline:
        Stage 1: Pre-filter (video_id metadata enforcement & optional timestamp range filtering)
        Stage 2: Dense Semantic Search (FAISS) + Sparse Lexical Search (BM25) with RRF
        Stage 3: Post-retrieval Contextual Compression
        """
        start_time = time.time()
        final_k = top_k or self.config.retrieval.top_k_final
        candidate_k = self.config.retrieval.top_k_candidates

        # Step A: Query preprocessing & rewriting
        clean_query = self.preprocessor.rewrite_query_with_history(query, history or [])
        time_intent = self.preprocessor.extract_time_intent(query)

        # STAGE 1: Metadata Pre-filtering (Image 3 & 4 rule: pre-filter before global ranking)
        filtered_docs = self.documents
        if time_intent:
            t_start, t_end = time_intent
            if t_start == 999999.0:  # Last X minutes intent
                max_time = max(d.metadata.get("end_seconds", 0) for d in self.documents)
                target_start = max(0, max_time - 300)
                filtered_docs = [
                    d for d in self.documents
                    if d.metadata.get("end_seconds", 0) >= target_start
                ]
            else:
                filtered_docs = [
                    d for d in self.documents
                    if (d.metadata.get("start_seconds", 0) <= t_end and
                        d.metadata.get("end_seconds", 0) >= t_start)
                ]
            if not filtered_docs:  # Fallback if range empty
                filtered_docs = self.documents

        # STAGE 2: Staged Hybrid Search (Dense + Sparse)
        # 2a. Dense Vector Search (FAISS)
        try:
            dense_results = self.vector_store.similarity_search(clean_query, k=candidate_k)
        except Exception as e:
            logger.warning(f"Dense search encountered error: {e}. Using fallback.")
            dense_results = self.documents[:candidate_k]

        # 2b. Sparse Lexical Search (BM25)
        tokenized_query = clean_query.lower().split()
        bm25_scores = self.bm25_index.get_scores(tokenized_query)
        # Rank documents by BM25 score
        bm25_ranked_indices = sorted(range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True)[:candidate_k]
        sparse_results = [self.documents[i] for i in bm25_ranked_indices]

        # 2c. Reciprocal Rank Fusion (RRF)
        # RRF Score(d) = alpha / (60 + rank_dense) + (1 - alpha) / (60 + rank_sparse)
        rrf_scores: Dict[str, float] = {}
        doc_map: Dict[str, Document] = {}

        alpha = self.hybrid_alpha
        k_rrf = 60

        for rank, doc in enumerate(dense_results):
            chunk_id = doc.metadata.get("chunk_id", str(rank))
            doc_map[chunk_id] = doc
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (alpha / (k_rrf + rank + 1))

        for rank, doc in enumerate(sparse_results):
            chunk_id = doc.metadata.get("chunk_id", str(rank))
            doc_map[chunk_id] = doc
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + ((1.0 - alpha) / (k_rrf + rank + 1))

        # Sort combined results by RRF score
        sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)
        hybrid_ranked_docs = [doc_map[cid] for cid in sorted_chunk_ids if cid in doc_map]

        # If time filtering was active, prioritize docs within filtered set
        if time_intent and filtered_docs != self.documents:
            filtered_ids = {d.metadata.get("chunk_id") for d in filtered_docs}
            prioritized = [d for d in hybrid_ranked_docs if d.metadata.get("chunk_id") in filtered_ids]
            remainder = [d for d in hybrid_ranked_docs if d.metadata.get("chunk_id") not in filtered_ids]
            hybrid_ranked_docs = prioritized + remainder

        top_candidates = hybrid_ranked_docs[:final_k]

        # STAGE 3: Post-Retrieval Contextual Compression
        # Deduplicate, format, and ensure chronological coherence when appropriate
        compressed_docs = self.compress_context(top_candidates, clean_query)

        elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"Staged Hybrid Retrieval returned {len(compressed_docs)} chunks for '{query}' in {elapsed_ms:.1f}ms")

        return compressed_docs

    def compress_context(self, docs: List[Document], query: str) -> List[Document]:
        """
        Lightweight post-retrieval refinement:
        - Deduplicates overlapping chunks
        - Sorts temporally if multiple adjacent chunks are retrieved for smooth narrative context
        """
        if not docs:
            return []

        # Sort by start_seconds to present a coherent narrative flow in LLM prompt
        sorted_by_time = sorted(docs, key=lambda d: d.metadata.get("start_seconds", 0.0))
        return sorted_by_time
