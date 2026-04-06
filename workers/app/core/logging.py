import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import sys

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)


def configure_logging() -> None:
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)

    file = RotatingFileHandler(
        LOG_DIR / "workers.log",
        maxBytes=10_000_000,  # 10 MB
        backupCount=5,
    )
    file.setFormatter(formatter)

    logging.basicConfig(
        level=logging.INFO,
        handlers=[console, file],
    )

    # Reduce noise from common libs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
