"""
NewsScope AI — Backend API Server
FastAPI application powering news validity verification with Google Gemini 3.6 Flash.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import MODEL_NAME, DEBUG
from backend.routes.health import router as health_router
from backend.routes.dataset import router as dataset_router
from backend.routes.verify import router as verify_router
from backend.routes.chat import router as chat_router

app = FastAPI(
    title="NewsScope AI API",
    description="Backend service for news verification, bias detection, and fact-checking with Gemini 3.6 Flash.",
    version="2.0.0",
    debug=DEBUG
)

# Enable CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router)
app.include_router(dataset_router)
app.include_router(verify_router)
app.include_router(chat_router)

@app.get("/")
def root():
    return {
        "message": "Welcome to NewsScope AI Backend",
        "model": MODEL_NAME,
        "docs": "/docs",
        "endpoints": {
            "health": "/api/health",
            "chat": "POST /api/chat",
            "verify": "POST /api/verify",
            "dataset": "GET /api/dataset",
            "dataset_stats": "GET /api/dataset/stats",
            "dataset_random": "GET /api/dataset/random"
        }
    }
