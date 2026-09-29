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
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-3.5-flash-lite").strip()

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# Dataset Configuration
DATASET_PATH_JSON = BACKEND_DIR / "data" / "news_dataset.json"
DATASET_PATH_CSV = BACKEND_DIR / "data" / "news_dataset.csv"
BENCHMARK_SEED_PATH = BACKEND_DIR / "data" / "benchmark_seed.json"

# Kaggle Dataset Configuration
KAGGLE_DATASET_SLUG = os.getenv("KAGGLE_DATASET_SLUG", "gpreda/bbc-news").strip()
KAGGLE_MAX_ITEMS = int(os.getenv("KAGGLE_MAX_ITEMS", "1000"))
KAGGLE_AUTO_SYNC = os.getenv("KAGGLE_AUTO_SYNC", "true").lower() == "true"

# SMS Gateway Configuration (for sending real SMS to user's mobile)
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "").strip()
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

