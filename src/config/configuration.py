"""
Configuration manager for YouTube Chatbot.
Loads settings from YAML and environment variables.
"""

import os
from pathlib import Path
from typing import List, Optional, Any, Dict
import yaml
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load .env if present
load_dotenv()


class AppConfig(BaseModel):
    name: str = "Youtube Chatbot"
    version: str = "2.0.0"
    host: str = "127.0.0.1"
    port: int = 8000
    debug: bool = True


class ModelConfig(BaseModel):
    llm_model: str = "gemini-2.5-flash"
    fallback_llm_model: str = "gemini-1.5-flash"
    embedding_model: str = "models/text-embedding-004"
    temperature: float = 0.2
    max_output_tokens: int = 1500
    top_p: float = 0.95
    gemini_api_key: Optional[str] = None


class IngestionConfig(BaseModel):
    default_languages: List[str] = ["en", "en-US", "en-GB", "auto"]
    max_transcript_length_chars: int = 500000
    raw_data_dir: str = "data/raw"
    processed_data_dir: str = "data/processed"


class TransformationConfig(BaseModel):
    chunk_size: int = 800
    chunk_overlap: int = 150
    split_by_sentences: bool = True


class IndexingConfig(BaseModel):
    vector_store_type: str = "faiss"
    models_dir: str = "models"
    cache_indexes: bool = True


class RetrievalConfig(BaseModel):
    enable_metadata_prefilter: bool = True
    enable_hybrid_search: bool = True
    hybrid_alpha: float = 0.65
    top_k_candidates: int = 10
    top_k_final: int = 4
    enable_query_rewrite: bool = True
    enable_multi_query: bool = False
    enable_context_compression: bool = True
    similarity_threshold: float = 0.3


class EvaluationConfig(BaseModel):
    metrics: List[str] = ["faithfulness", "answer_relevancy", "context_precision", "context_recall", "latency_ms"]
    benchmark_output_dir: str = "outputs"


class SystemConfig(BaseModel):
    app: AppConfig = Field(default_factory=AppConfig)
    model: ModelConfig = Field(default_factory=ModelConfig)
    ingestion: IngestionConfig = Field(default_factory=IngestionConfig)
    transformation: TransformationConfig = Field(default_factory=TransformationConfig)
    indexing: IndexingConfig = Field(default_factory=IndexingConfig)
    retrieval: RetrievalConfig = Field(default_factory=RetrievalConfig)
    evaluation: EvaluationConfig = Field(default_factory=EvaluationConfig)


class ConfigurationManager:
    """Singleton configuration manager."""
    _instance = None
    _config: Optional[SystemConfig] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConfigurationManager, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        # Locate config.yaml relative to this file
        current_dir = Path(__file__).resolve().parent
        config_path = current_dir / "config.yaml"
        
        raw_dict: Dict[str, Any] = {}
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                raw_dict = yaml.safe_load(f) or {}

        # Load environment overrides
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if "model" not in raw_dict:
            raw_dict["model"] = {}
        if api_key:
            raw_dict["model"]["gemini_api_key"] = api_key

        self._config = SystemConfig(**raw_dict)

    def get_config(self) -> SystemConfig:
        if self._config is None:
            self._load_config()
        return self._config


def get_config() -> SystemConfig:
    return ConfigurationManager().get_config()
