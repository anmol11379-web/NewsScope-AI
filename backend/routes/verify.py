"""
NewsScope AI — News Verification Route
Dedicated endpoint for verifying specific headlines, articles, or claims.
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.services.gemini_service import gemini_service

router = APIRouter(prefix="/api/verify", tags=["Verification"])

class VerifyRequest(BaseModel):
    claim: str = Field(..., min_length=3, description="Headline, statement, or text to verify")
    context: Optional[str] = Field(None, description="Optional extra context or article text")

class AnalysisResponse(BaseModel):
    title: str
    score: int
    level: str
    verdict: str
    verdictClass: str
    bias: Optional[str] = None
    summary: str
    sources: List[str]
    key_claims: Optional[List[str]] = None
    benchmark_matched: Optional[dict] = None

class VerifyResponse(BaseModel):
    is_news_query: bool
    conversational_reply: str
    analysis: Optional[AnalysisResponse] = None

@router.post("", response_model=VerifyResponse)
def verify_news(payload: VerifyRequest):
    """Evaluates a claim using Gemini 3.6 Flash and returns structured validity report."""
    query = payload.claim.strip()
    if payload.context:
        query = f"Headline/Claim: {query}\nContext: {payload.context}"

    result = gemini_service.analyze_news(query)
    return result
