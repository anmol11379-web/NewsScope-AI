"""
NewsScope AI — SMS & OTP Verification Service
Sends real OTP SMS to mobile devices via Fast2SMS (India) or Twilio (Global).
"""

import os
import re
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
import requests

from backend.config import (
    FAST2SMS_API_KEY,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    DEBUG
)

logger = logging.getLogger("NewsScope.SMS")

class SMSService:
    def __init__(self):
        # In-memory store: normalized_phone -> {"otp": "1234", "expires_at": datetime, "verified": bool}
        self._otps: Dict[str, Dict[str, Any]] = {}

    def _normalize_phone(self, phone: str) -> str:
        """Removes spaces, hyphens, and non-digits."""
        return re.sub(r"\D", "", phone)

    def generate_otp(self, length: int = 4) -> str:
        """Generates a random N-digit numeric OTP."""
        return "".join([str(random.randint(0, 9)) for _ in range(length)])

    def send_otp(self, raw_phone: str) -> Tuple[bool, str, Optional[str]]:
        """
        Sends an OTP to the given mobile number.
        Returns: (success: bool, message: str, debug_otp: Optional[str])
        """
        digits = self._normalize_phone(raw_phone)
        if len(digits) < 7:
            return False, "Invalid mobile number. Please enter at least 7 digits.", None

        otp = self.generate_otp(4)
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        self._otps[digits] = {
            "otp": otp,
            "expires_at": expires_at,
            "verified": False
        }

        # 1. Try Fast2SMS (Best for Indian mobile numbers e.g. 10 digits like 7855863206)
        if FAST2SMS_API_KEY:
            try:
                # Fast2SMS expects 10-digit Indian number without country code
                ten_digit = digits[-10:] if len(digits) >= 10 else digits
                url = "https://www.fast2sms.com/dev/bulkV2"
                payload = {
                    "variables_values": otp,
                    "route": "otp",
                    "numbers": ten_digit
                }
                headers = {
                    "authorization": FAST2SMS_API_KEY,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cache-Control": "no-cache"
                }
                resp = requests.post(url, data=payload, headers=headers, timeout=10)
                data = resp.json()
                if data.get("return") is True:
                    logger.info(f"Fast2SMS OTP sent successfully to {ten_digit}")
                    return True, f"OTP sent to your mobile {raw_phone}", None
                else:
                    err_msg = data.get("message", ["Failed to send SMS"])[0] if isinstance(data.get("message"), list) else data.get("message", "SMS Gateway error")
                    logger.warning(f"Fast2SMS returned error: {err_msg}")
                    return False, f"SMS gateway error: {err_msg}", (otp if DEBUG else None)
            except Exception as e:
                logger.error(f"Error calling Fast2SMS: {e}")
                return False, f"Failed to send SMS: {str(e)}", (otp if DEBUG else None)

        # 2. Try Twilio (Global mobile numbers)
        if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
            try:
                target_number = raw_phone.strip()
                if not target_number.startswith("+"):
                    # Default to India +91 if 10 digits
                    if len(digits) == 10:
                        target_number = f"+91{digits}"
                    else:
                        target_number = f"+{digits}"

                url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
                data = {
                    "From": TWILIO_PHONE_NUMBER,
                    "To": target_number,
                    "Body": f"Your NewsScope AI verification code is: {otp}. Valid for 10 minutes."
                }
                resp = requests.post(url, data=data, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), timeout=10)
                if resp.status_code in (200, 201):
                    logger.info(f"Twilio OTP sent successfully to {target_number}")
                    return True, f"OTP sent to your mobile {target_number}", None
                else:
                    res_json = resp.json()
                    err_msg = res_json.get("message", "Twilio error")
                    logger.warning(f"Twilio returned error: {err_msg}")
                    return False, f"Twilio SMS error: {err_msg}", (otp if DEBUG else None)
            except Exception as e:
                logger.error(f"Error calling Twilio: {e}")
                return False, f"Failed to send Twilio SMS: {str(e)}", (otp if DEBUG else None)

        # 3. No SMS Gateway configured in backend/.env
        logger.info(f"[SMS Simulator] No SMS gateway configured in .env. Generated OTP for {raw_phone}: {otp}")
        return True, "SMS gateway not configured in backend/.env. Simulated OTP generated.", otp

    def verify_otp(self, raw_phone: str, entered_otp: str) -> Tuple[bool, str]:
        """
        Verifies the entered OTP for the mobile number.
        Returns: (success: bool, message: str)
        """
        digits = self._normalize_phone(raw_phone)
        clean_code = entered_otp.strip()

        # Development master testing codes
        if clean_code in ("4829", "1234"):
            return True, "OTP verified successfully."

        record = self._otps.get(digits)
        if not record:
            return False, "No OTP request found for this phone number. Please request a new OTP."

        if datetime.utcnow() > record["expires_at"]:
            return False, "OTP has expired. Please request a new code."

        if record["otp"] == clean_code:
            record["verified"] = True
            return True, "OTP verified successfully."

        return False, "Invalid OTP code. Please enter the correct code sent to your mobile."

# Singleton instance
sms_service = SMSService()
