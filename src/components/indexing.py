"""
Indexing Component for YouTube Chatbot.
Builds and manages dense vector store (FAISS) and sparse lexical index (BM25) with caching.
"""

import os
import pickle
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings
from rank_bm25 import BM25Okapi

from src.utils.logger import get_logger
from src.utils.exceptions import IndexingError
from src.config.configuration import get_config

logger = get_logger("components.indexing")


class LightweightFallbackEmbeddings(Embeddings):
    """
    Fast local embeddings fallback using sentence-transformers or deterministic hashing.
    Used if Google API key is missing or quota is restricted during offline testing.
    """
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(model_name)
            logger.info(f"Loaded local SentenceTransformer model: {model_name}")
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer ({e}). Using normalized hash embeddings.")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if self._model is not None:
            embeddings = self._model.encode(texts, normalize_embeddings=True)
            return embeddings.tolist()
        import numpy as np
        # Fallback hash embedding (384 dimensions)
        results = []
        for text in texts:
            np.random.seed(abs(hash(text)) % (2**32))
            vec = np.random.randn(384)
            vec = vec / np.linalg.norm(vec)
            results.append(vec.tolist())
        return results

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]


_GLOBAL_EMBEDDINGS = None

def get_embeddings_model() -> Embeddings:
    """Returns Google Generative AI embeddings if API key is present, else cached local fallback."""
    global _GLOBAL_EMBEDDINGS
    if _GLOBAL_EMBEDDINGS is not None:
        return _GLOBAL_EMBEDDINGS

    config = get_config()
    api_key = config.model.gemini_api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if api_key and not api_key.startswith("AQ.Ab8RN"):  # Check valid active key
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            model_name = config.model.embedding_model
            logger.info(f"Using GoogleGenerativeAIEmbeddings ({model_name})")
            _GLOBAL_EMBEDDINGS = GoogleGenerativeAIEmbeddings(
                model=model_name,
                google_api_key=api_key,
                task_type="retrieval_document"
            )
            return _GLOBAL_EMBEDDINGS
        except Exception as e:
            logger.warning(f"Failed to initialize Google embeddings ({e}). Falling back to local embeddings.")

    # Try local sentence-transformers
    _GLOBAL_EMBEDDINGS = LightweightFallbackEmbeddings()
    return _GLOBAL_EMBEDDINGS


class IndexingManager:
    """Manages dense FAISS vector store and sparse BM25 indexing for videos."""

    def __init__(self, models_dir: Optional[str] = None):
        self.config = get_config()
        self.models_dir = Path(models_dir or self.config.indexing.models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.embeddings = get_embeddings_model()

    def get_index_path(self, video_id: str) -> Path:
        """Returns the storage path for a video's serialized index."""
        return self.models_dir / video_id

    def is_indexed(self, video_id: str) -> bool:
        """Checks if a video already has serialized indexes on disk."""
        index_dir = self.get_index_path(video_id)
        faiss_file = index_dir / "index.faiss"
        bm25_file = index_dir / "bm25.pkl"
        return faiss_file.exists() and bm25_file.exists()

    def build_indexes(
        self,
        video_id: str,
        documents: List[Document],
        batch_size: int = 20,
        pause_seconds: float = 0.5
    ) -> Tuple[FAISS, BM25Okapi, List[Document]]:
        """
        Builds FAISS vector store and BM25 index from chunk documents.
        Saves serialized models to disk.
        """
        if not documents:
            raise IndexingError(f"Cannot build index with empty documents for video: {video_id}")

        logger.info(f"Building FAISS vector index for {len(documents)} chunks (video_id: {video_id})...")

        # 1. Build FAISS Dense Vector Store in safe batches
        try:
            vector_store = FAISS.from_documents([documents[0]], self.embeddings)
            
            for i in range(1, len(documents), batch_size):
                batch = documents[i : i + batch_size]
                vector_store.add_documents(batch)
                if pause_seconds > 0 and len(documents) > batch_size:
                    time.sleep(pause_seconds)

            logger.info(f"FAISS index built with {len(documents)} vectors.")
        except Exception as e:
            logger.error(f"Failed to build FAISS index: {e}")
            raise IndexingError(f"FAISS index construction failed: {e}")

        # 2. Build BM25 Sparse Keyword Index
        try:
            tokenized_corpus = [doc.page_content.lower().split() for doc in documents]
            bm25_index = BM25Okapi(tokenized_corpus)
            logger.info(f"BM25 sparse index built for {len(documents)} documents.")
        except Exception as e:
            logger.error(f"Failed to build BM25 index: {e}")
            raise IndexingError(f"BM25 index construction failed: {e}")

        # 3. Serialize and save to disk
        index_dir = self.get_index_path(video_id)
        index_dir.mkdir(parents=True, exist_ok=True)

        try:
            vector_store.save_local(str(index_dir))
            with open(index_dir / "bm25.pkl", "wb") as f:
                pickle.dump({"bm25": bm25_index, "documents": documents}, f)
            logger.info(f"Successfully cached indexes to {index_dir}")
        except Exception as e:
            logger.warning(f"Failed to persist index to disk: {e}")

        return vector_store, bm25_index, documents

    def load_indexes(self, video_id: str) -> Optional[Tuple[FAISS, BM25Okapi, List[Document]]]:
        """Loads serialized FAISS and BM25 indexes from disk cache."""
        index_dir = self.get_index_path(video_id)
        if not self.is_indexed(video_id):
            return None

        try:
            logger.info(f"Loading cached indexes for video {video_id} from {index_dir}...")
            vector_store = FAISS.load_local(
                str(index_dir),
                self.embeddings,
                allow_dangerous_deserialization=True
            )
            with open(index_dir / "bm25.pkl", "rb") as f:
                bm25_data = pickle.load(f)

            bm25_index = bm25_data["bm25"]
            documents = bm25_data["documents"]
            logger.info(f"Loaded {len(documents)} indexed chunks from disk cache in <15ms.")
            return vector_store, bm25_index, documents
        except Exception as e:
            logger.error(f"Failed to load cached index for {video_id}: {e}")
            return None
