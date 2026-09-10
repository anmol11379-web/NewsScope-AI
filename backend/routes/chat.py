"""
NewsScope AI — Chat Route
Endpoint handling chat interactions from the frontend with Gemini 3.6 Flash.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel, Field
from backend.services.gemini_service import gemini_service

router = APIRouter(prefix="/api/chat", tags=["Chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User query or message")
    history: Optional[List[ChatMessage]] = Field(default=[], description="Recent conversation turns")

class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    analysis: Optional[Dict[str, Any]] = None

@router.post("", response_model=ChatResponse)
def handle_chat(payload: ChatRequest):
    """Processes user query through Gemini 3.6 Flash and returns assistant message + analysis."""
    user_query = payload.message.strip()
    history_dicts = [{"role": m.role, "content": m.content} for m in payload.history] if payload.history else []

    result = gemini_service.analyze_news(user_query, conversation_history=history_dicts)

    reply_content = result.get("conversational_reply") or "Here is the analysis of your query:"
    analysis_data = result.get("analysis")

    return ChatResponse(
        role="assistant",
        content=reply_content,
        analysis=analysis_data
    )
