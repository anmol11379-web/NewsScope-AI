"""
NewsScope AI — Dataset Service
Provides query matching, category filtering, search, and statistical aggregations
for the News Validity Benchmark Dataset.
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.config import DATASET_PATH_JSON

class DatasetService:
    def __init__(self, json_path: Path = DATASET_PATH_JSON):
        self.json_path = json_path
        self._dataset: List[Dict[str, Any]] = []
        self.load()

    def load(self):
        """Loads or reloads the dataset from disk."""
        if not self.json_path.exists():
            self._dataset = []
            return
        with open(self.json_path, "r", encoding="utf-8") as f:
            self._dataset = json.load(f)

    def get_all(self, category: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Returns entries with optional category filtering and pagination."""
        items = self._dataset
        if category and category.lower() != "all":
            items = [item for item in items if item.get("category", "").lower() == category.lower()]
        return items[offset : offset + limit]

    def get_total_count(self, category: Optional[str] = None) -> int:
        if category and category.lower() != "all":
            return len([item for item in self._dataset if item.get("category", "").lower() == category.lower()])
        return len(self._dataset)

    def get_by_id(self, item_id: str) -> Optional[Dict[str, Any]]:
        for item in self._dataset:
            if item.get("id") == item_id:
                return item
        return None

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Keyword and token-based search across claims, headlines, tags, and explanations."""
        if not query or not query.strip():
            return self._dataset[:limit]

        q_terms = [t.lower() for t in query.strip().split() if len(t) > 2]
        if not q_terms:
            return self._dataset[:limit]

        scored_items = []
        for item in self._dataset:
            text_corpus = " ".join([
                item.get("headline", ""),
                item.get("claim", ""),
                item.get("category", ""),
                item.get("detailed_analysis", ""),
                " ".join(item.get("tags", []))
            ]).lower()

            matches = sum(1 for term in q_terms if term in text_corpus)
            if matches > 0:
                scored_items.append((matches, item))

        scored_items.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored_items[:limit]]

    def find_similar_claim(self, user_claim: str, threshold_score: int = 2) -> Optional[Dict[str, Any]]:
        """Finds if a user query closely matches a known ground-truth benchmark item."""
        results = self.search(user_claim, limit=1)
        if not results:
            return None
        
        top_item = results[0]
        q_terms = [t.lower() for t in user_claim.strip().split() if len(t) > 3]
        text_corpus = " ".join([
            top_item.get("headline", ""),
            top_item.get("claim", ""),
            " ".join(top_item.get("tags", []))
        ]).lower()

        overlap = sum(1 for term in q_terms if term in text_corpus)
        if overlap >= threshold_score:
            return top_item
        return None

    def get_statistics(self) -> Dict[str, Any]:
        """Calculates dataset analytics, category distribution, and average scores."""
        total = len(self._dataset)
        if total == 0:
            return {"total": 0, "categories": {}, "verdicts": {}, "avg_score": 0}

        categories = {}
        verdicts = {}
        total_score = 0

        for item in self._dataset:
            cat = item.get("category", "General")
            categories[cat] = categories.get(cat, 0) + 1

            verd = item.get("verdict", "Unknown")
            verdicts[verd] = verdicts.get(verd, 0) + 1

            total_score += item.get("credibility_score", 50)

        return {
            "total_items": total,
            "average_credibility_score": round(total_score / total, 1),
            "category_distribution": categories,
            "verdict_distribution": verdicts,
            "sources_indexed": list({src.split(" — ")[0] for item in self._dataset for src in item.get("sources", [])})[:10]
        }

    def get_random_sample(self) -> Optional[Dict[str, Any]]:
        import random
        if not self._dataset:
            return None
        return random.choice(self._dataset)

# Global singleton instance
dataset_service = DatasetService()
