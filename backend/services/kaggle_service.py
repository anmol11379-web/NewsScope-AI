"""
NewsScope AI — Kaggle Dataset Sync Service
Synchronizes self-updating news feeds from Kaggle datasets (e.g. gpreda/bbc-news)
into the NewsScope verification and benchmark pipeline.
"""

import os
import json
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd

from backend.config import (
    BACKEND_DIR,
    DATASET_PATH_JSON,
    DATASET_PATH_CSV,
    BENCHMARK_SEED_PATH,
    KAGGLE_DATASET_SLUG,
    KAGGLE_MAX_ITEMS,
)

logger = logging.getLogger("newsscope.kaggle")
logging.basicConfig(level=logging.INFO)

CACHE_DIR = BACKEND_DIR / "data" / "kaggle_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

class KaggleSyncService:
    def __init__(self):
        self.is_syncing = False
        self.last_sync_time: Optional[str] = None
        self.last_sync_count: int = 0
        self.last_error: Optional[str] = None
        self.dataset_slug: str = KAGGLE_DATASET_SLUG

    def _map_category(self, link: str, title: str, description: str) -> str:
        """Infers category from BBC link or article text."""
        combined = f"{link} {title} {description}".lower()

        if any(w in combined for w in ["technology", "cyber", "robot", "software", "tech", "computer", "ai ", "apple", "google", "meta"]):
            return "Technology & AI"
        if any(w in combined for w in ["health", "science", "covid", "cancer", "medical", "doctor", "hospital", "nasa", "space", "climate", "environment"]):
            return "Science & Health"
        if any(w in combined for w in ["business", "economy", "inflation", "market", "bank", "trade", "jobs", "stock", "tax"]):
            return "Economy & Finance"
        if any(w in combined for w in ["entertainment", "arts", "movie", "film", "music", "actor", "celebrity", "tv", "oscar"]):
            return "Entertainment & Media"
        if any(w in combined for w in ["election", "vote", "parliament", "congress", "senate", "minister", "prime minister", "president", "politics"]):
            return "Politics & Elections"
        if any(w in combined for w in ["world", "uk", "war", "treaty", "nato", "un ", "diplomat", "ukraine", "russia", "china", "gaza"]):
            return "World & Geopolitics"

        return "World & Geopolitics"

    def _parse_date(self, date_str: Any) -> str:
        """Parses RFC 822 or ISO pubDate into YYYY-MM-DD."""
        if not date_str or pd.isna(date_str):
            return datetime.utcnow().strftime("%Y-%m-%d")
        try:
            # Handle 'Tue, 03 Dec 2024 21:03:00 GMT'
            clean_str = str(date_str).strip()
            dt = datetime.strptime(clean_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
            return dt.strftime("%Y-%m-%d")
        except Exception:
            try:
                dt = pd.to_datetime(date_str)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                return datetime.utcnow().strftime("%Y-%m-%d")

    def _extract_tags(self, title: str, category: str) -> List[str]:
        """Extracts short search tags from headline and category."""
        tags = set()
        words = re.findall(r'[a-zA-Z]{4,}', title.lower())
        common_stops = {"with", "from", "that", "this", "were", "what", "when", "where", "have", "been", "says", "after", "will", "more", "over", "into"}
        filtered = [w for w in words if w not in common_stops]
        for w in filtered[:4]:
            tags.add(w)
        tags.add(category.lower().split("&")[0].strip())
        tags.add("bbc")
        return list(tags)

    def sync(self, slug: Optional[str] = None, max_items: int = KAGGLE_MAX_ITEMS, force_download: bool = False) -> Dict[str, Any]:
        """Downloads latest dataset from Kaggle, processes news rows, and updates local dataset."""
        if self.is_syncing:
            return {
                "status": "already_running",
                "message": "A Kaggle sync operation is currently in progress."
            }

        target_slug = slug or self.dataset_slug
        self.is_syncing = True
        self.last_error = None

        try:
            logger.info(f"Starting Kaggle sync for dataset: {target_slug}")
            csv_path = CACHE_DIR / "bbc_news.csv"
            
            # Check if we should download or use fresh cached file
            should_download = force_download or not csv_path.exists()
            if not should_download and csv_path.exists():
                file_age_hours = (datetime.now().timestamp() - csv_path.stat().st_mtime) / 3600
                if file_age_hours > 6:
                    should_download = True

            if should_download:
                import kaggle
                kaggle.api.authenticate()

                # Clean any lingering partial downloads
                for partial in CACHE_DIR.glob("*.kaggle-partial"):
                    try:
                        partial.unlink()
                    except Exception:
                        pass

                # Download bbc_news.csv to cache directory
                kaggle.api.dataset_download_file(
                    target_slug,
                    "bbc_news.csv",
                    path=str(CACHE_DIR),
                    force=True
                )

            # Locate downloaded file (could be bbc_news.csv or zipped)
            zip_path = CACHE_DIR / "bbc_news.csv.zip"


            if zip_path.exists() and not csv_path.exists():
                import zipfile
                with zipfile.ZipFile(zip_path, 'r') as zf:
                    zf.extractall(CACHE_DIR)

            if not csv_path.exists():
                # Kaggle sometimes downloads as whole dataset zip
                for p in CACHE_DIR.glob("*.csv"):
                    csv_path = p
                    break

            if not csv_path.exists():
                raise FileNotFoundError(f"Could not locate CSV file in {CACHE_DIR} after download.")

            # Read CSV
            df = pd.read_csv(csv_path)
            logger.info(f"Loaded {len(df)} rows from {csv_path.name}")

            # Clean and take latest rows (end of dataset is chronologically newest)
            df = df.dropna(subset=['title']).drop_duplicates(subset=['title'])
            latest_df = df.tail(max_items).iloc[::-1]  # reverse to get newest first

            kaggle_items = []
            for idx, (_, row) in enumerate(latest_df.iterrows(), start=1):
                title = str(row.get('title', '')).strip()
                desc = str(row.get('description', '')).strip() if pd.notna(row.get('description')) else title
                link = str(row.get('link', '')).strip() if pd.notna(row.get('link')) else "https://www.bbc.co.uk/news"
                pub_date = self._parse_date(row.get('pubDate'))
                cat = self._map_category(link, title, desc)
                tags = self._extract_tags(title, cat)

                item = {
                    "id": f"BBC-{idx:05d}",
                    "category": cat,
                    "headline": title,
                    "claim": desc,
                    "verdict": "Verified & Accurate",
                    "verdict_class": "badge-credible",
                    "credibility_score": 95,
                    "bias_rating": "Center / Balanced",
                    "fact_checker": "BBC News (Primary Source)",
                    "verification_date": pub_date,
                    "sources": [
                        f"BBC News Reporting — {link}"
                    ],
                    "detailed_analysis": f"Official reporting published by BBC News ({pub_date}). Primary broadcast journalism with standard editorial oversight.",
                    "tags": tags
                }
                kaggle_items.append(item)

            # Load benchmark seed claims (ground truth fake/disputed/verified items)
            seed_items = []
            if BENCHMARK_SEED_PATH.exists():
                try:
                    with open(BENCHMARK_SEED_PATH, "r", encoding="utf-8") as f:
                        seed_items = json.load(f)
                except Exception as e:
                    logger.warning(f"Could not load benchmark seed: {e}")

            # Merge: Keep benchmark claims first, followed by live Kaggle BBC feed
            merged_dataset = seed_items + kaggle_items

            # Save to DATASET_PATH_JSON
            with open(DATASET_PATH_JSON, "w", encoding="utf-8") as f:
                json.dump(merged_dataset, f, indent=2, ensure_ascii=False)

            # Also export to CSV for convenience
            try:
                export_df = pd.DataFrame(merged_dataset)
                export_df.to_csv(DATASET_PATH_CSV, index=False, encoding="utf-8")
            except Exception as e:
                logger.warning(f"Could not export CSV: {e}")

            # Refresh dataset service cache in memory
            from backend.services.dataset_service import dataset_service
            dataset_service.load()

            self.last_sync_time = datetime.utcnow().isoformat() + "Z"
            self.last_sync_count = len(kaggle_items)

            logger.info(f"Kaggle sync complete: {len(kaggle_items)} BBC items + {len(seed_items)} benchmark items indexed.")

            return {
                "status": "success",
                "dataset_slug": target_slug,
                "synced_bbc_articles": len(kaggle_items),
                "benchmark_seed_items": len(seed_items),
                "total_items": len(merged_dataset),
                "last_sync": self.last_sync_time
            }

        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error during Kaggle sync: {e}", exc_info=True)
            return {
                "status": "error",
                "error": str(e)
            }
        finally:
            self.is_syncing = False

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_syncing": self.is_syncing,
            "dataset_slug": self.dataset_slug,
            "last_sync_time": self.last_sync_time,
            "last_sync_count": self.last_sync_count,
            "last_error": self.last_error
        }

kaggle_sync_service = KaggleSyncService()
