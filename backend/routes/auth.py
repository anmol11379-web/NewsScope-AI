"""
NewsScope AI — Authentication Routes
Endpoints for user registration, login, and session validation.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from backend.services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full Name")
    email: EmailStr = Field(..., description="Valid Email Address")
    password: str = Field(..., min_length=6, max_length=128, description="Password (at least 6 characters)")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered Email Address")
    password: str = Field(..., min_length=1, description="Password")


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    initials: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserResponse] = None


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: RegisterRequest):
    """Registers a new user and creates their account in the database."""
    user, err = auth_service.register(payload.name, payload.email, payload.password)
    if err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    return AuthResponse(
        success=True,
        message="Account registered successfully.",
        user=UserResponse(**user)
    )


@router.post("/login", response_model=AuthResponse)
def login_user(payload: LoginRequest):
    """Authenticates existing user with email and password."""
    user, err = auth_service.authenticate(payload.email, payload.password)
    if err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=err)

    return AuthResponse(
        success=True,
        message="Login successful.",
        user=UserResponse(**user)
    )


@router.get("/status")
def auth_status():
    """Returns status of authentication service."""
    return {"status": "active", "service": "NewsScope Auth Engine", "storage": "sqlite3"}
