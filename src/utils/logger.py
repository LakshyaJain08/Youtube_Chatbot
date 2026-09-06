"""
Enterprise logging utility.
Provides formatted console and file logging.
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path

LOG_FORMAT = "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d]: %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Directory for logs
LOGS_DIR = Path("logs")
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE_PATH = LOGS_DIR / f"app_{datetime.now().strftime('%Y_%m_%d')}.log"

# Configure root logger
logger = logging.getLogger("youtube_chatbot")
logger.setLevel(logging.INFO)

# Prevent duplicate handlers
if not logger.handlers:
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    logger.addHandler(console_handler)

    # File handler
    file_handler = logging.FileHandler(LOG_FILE_PATH, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    logger.addHandler(file_handler)


def get_logger(name: str = "youtube_chatbot") -> logging.Logger:
    """Returns a logger instance with standardized formatting."""
    return logging.getLogger(f"youtube_chatbot.{name}")
