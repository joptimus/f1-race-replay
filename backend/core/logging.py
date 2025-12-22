import logging
import sys
from pathlib import Path

def setup_logging(log_level=logging.INFO):
    """Configure structured logging for the F1 Race Replay backend"""

    # Create formatter - friendly without timestamps
    friendly_formatter = logging.Formatter(
        '%(levelname)-8s %(name)s: %(message)s'
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(friendly_formatter)
    root_logger.addHandler(console_handler)

    return root_logger

def get_logger(name: str) -> logging.Logger:
    """Get a logger for a specific module"""
    return logging.getLogger(name)
