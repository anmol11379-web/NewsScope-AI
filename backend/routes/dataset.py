"""
NewsScope AI — Dataset Routes
Provides access to the News Validity Benchmark Dataset, search, and statistics.
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from backend.services.dataset_service import dataset_service

router = APIRouter(prefix="/api/dataset", tags=["Dataset"])

@router.get("")
def list_dataset(
    category: Optional[str] = Query(None, description="Category filter (e.g. 'Science & Health', 'Politics & Elections')"),
    q: Optional[str] = Query(None, description="Search keyword in claims, headlines, tags"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Retrieves dataset claims with optional search or category filter."""
    if q and q.strip():
        items = dataset_service.search(q, limit=limit)
        return {
            "total": len(items),
            "offset": 0,
            "limit": limit,
            "items": items
        }

    items = dataset_service.get_all(category=category, limit=limit, offset=offset)
    total = dataset_service.get_total_count(category=category)
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "category": category,
        "items": items
    }

@router.get("/stats")
def dataset_stats():
    """Returns statistical metrics, category breakdowns, and verdict distributions."""
    return dataset_service.get_statistics()

@router.get("/random")
def get_random():
    """Returns a random benchmark claim for quick validation and testing."""
    sample = dataset_service.get_random_sample()
    if not sample:
        raise HTTPException(status_code=404, detail="Dataset is empty")
    return sample

@router.get("/{item_id}")
def get_by_id(item_id: str):
    """Retrieves an individual claim by ID."""
    item = dataset_service.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Claim with ID {item_id} not found")
    return item
