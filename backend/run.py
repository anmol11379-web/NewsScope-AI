"""
NewsScope AI — Backend Launcher
Runs the FastAPI application on http://127.0.0.1:8000
"""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn
from backend.config import HOST, PORT

if __name__ == "__main__":
    print(f"Starting NewsScope AI Backend Server on http://{HOST}:{PORT}")
    print(f"Interactive API Docs available at http://{HOST}:{PORT}/docs")
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
