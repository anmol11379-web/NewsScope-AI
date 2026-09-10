"""
NewsScope AI — Health Check Route
"""

from fastapi import APIRouter
from backend.config import MODEL_NAME
from backend.services.dataset_service import dataset_service

router = APIRouter(prefix="/api/health", tags=["Health"])

@router.get("")
def health_check():
    return {
        "status": "healthy",
        "service": "NewsScope AI Backend",
        "model": MODEL_NAME,
        "dataset_items_indexed": dataset_service.get_total_count(),
        "api_ready": True
    }
