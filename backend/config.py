"""
NewsScope AI — Backend Configuration
Handles environment variables, Gemini API setup, and application constants.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"

# Load .env
load_dotenv(dotenv_path=ENV_FILE)

# API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-3.5-flash").strip()

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# Dataset Configuration
DATASET_PATH_JSON = BACKEND_DIR / "data" / "news_dataset.json"
DATASET_PATH_CSV = BACKEND_DIR / "data" / "news_dataset.csv"
