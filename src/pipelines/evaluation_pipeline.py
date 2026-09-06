"""
Evaluation Pipeline for YouTube Chatbot.
Runs batch test questions across videos, computes Ragas metrics and latency benchmarks,
and writes comprehensive evaluation reports to outputs/.
"""

import time
from typing import List, Dict, Any, Optional
from pathlib import Path

from src.utils.logger import get_logger
from src.utils.common import save_json
from src.pipelines.rag_pipeline import RAGPipeline
from src.config.configuration import get_config

logger = get_logger("pipelines.evaluation_pipeline")


class EvaluationPipeline:
    """Automated benchmark evaluation pipeline."""

    def __init__(self):
        self.config = get_config()
        self.rag_pipeline = RAGPipeline()
        self.output_dir = Path(self.config.evaluation.benchmark_output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def evaluate_video(
        self,
        video_id: str,
        test_questions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Runs evaluation across a list of test questions for a given video.
        """
        questions = test_questions or [
            "What is the main topic discussed in this video?",
            "What are the key technical concepts explained?",
            "What did the speaker conclude at the end of the video?",
            "Does this video discuss extraterrestrial life or aliens?"
        ]

        logger.info(f"--- Running Evaluation Benchmark for video {video_id} ({len(questions)} queries) ---")
        results = []
        total_latency = 0.0

        for q in questions:
            res = self.rag_pipeline.query(video_id=video_id, question=q)
            results.append({
                "question": q,
                "answer": res["answer"],
                "citations": res["citations"],
                "confidence_score": res["confidence_score"],
                "evaluation_metrics": res["evaluation_metrics"],
                "latency_ms": res["latency_ms"],
            })
            total_latency += res["latency_ms"]

        # Calculate averages
        avg_faithfulness = sum(r["evaluation_metrics"]["faithfulness"] for r in results) / len(results)
        avg_relevancy = sum(r["evaluation_metrics"]["answer_relevancy"] for r in results) / len(results)
        avg_precision = sum(r["evaluation_metrics"]["context_precision"] for r in results) / len(results)
        avg_recall = sum(r["evaluation_metrics"]["context_recall"] for r in results) / len(results)
        avg_quality = sum(r["evaluation_metrics"]["rag_quality_score"] for r in results) / len(results)
        avg_latency = total_latency / len(results)

        report = {
            "video_id": video_id,
            "total_questions_evaluated": len(questions),
            "summary_metrics": {
                "avg_faithfulness": round(avg_faithfulness, 3),
                "avg_answer_relevancy": round(avg_relevancy, 3),
                "avg_context_precision": round(avg_precision, 3),
                "avg_context_recall": round(avg_recall, 3),
                "composite_rag_quality": round(avg_quality, 3),
                "avg_latency_ms": round(avg_latency, 2),
            },
            "detailed_results": results,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        report_file = self.output_dir / f"evaluation_report_{video_id}.json"
        save_json(report_file, report)
        logger.info(f"Evaluation benchmark report written to: {report_file}")

        return report
