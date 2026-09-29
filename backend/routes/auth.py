"""
NewsScope AI — Authentication Routes
Endpoints for user registration, login, and session validation.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.services.auth_service import auth_service
from backend.services.sms_service import sms_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full Name")
    email: str = Field(..., min_length=3, max_length=150, description="Valid Email Address")
    password: str = Field(..., min_length=6, max_length=128, description="Password (at least 6 characters)")


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=150, description="Registered Email Address")
    password: str = Field(..., min_length=1, description="Password")


class SendOtpRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20, description="Mobile Phone Number")


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20, description="Mobile Phone Number")
    otp: str = Field(..., min_length=4, max_length=8, description="Verification Code")


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    initials: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserResponse] = None


class OtpResponse(BaseModel):
    success: bool
    message: str
    debug_code: Optional[str] = None


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


@router.post("/send-phone-otp", response_model=OtpResponse)
def send_phone_otp(payload: SendOtpRequest):
    """Sends an OTP to the user's mobile phone number."""
    success, msg, debug_code = sms_service.send_otp(payload.phone)
    if not success and not debug_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return OtpResponse(
        success=success,
        message=msg,
        debug_code=debug_code
    )


@router.post("/verify-phone-otp", response_model=OtpResponse)
def verify_phone_otp(payload: VerifyOtpRequest):
    """Verifies the OTP code for the user's mobile phone number."""
    success, msg = sms_service.verify_otp(payload.phone, payload.otp)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return OtpResponse(
        success=True,
        message=msg
    )


@router.get("/status")
def auth_status():
    """Returns status of authentication service."""
    return {"status": "active", "service": "NewsScope Auth Engine", "storage": "sqlite3"}

