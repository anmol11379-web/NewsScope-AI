"""
NewsScope AI — Authentication & User Database Service
Provides user registration, secure PBKDF2-HMAC password hashing, and login authentication.
Backed by persistent SQLite database in backend/data/users.db.
"""

import os
import sqlite3
import hashlib
import secrets
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from backend.config import BACKEND_DIR

DB_PATH = BACKEND_DIR / "data" / "users.db"


class AuthService:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initializes users table if it does not exist."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
            conn.commit()

    def _hash_password(self, password: str, salt: Optional[str] = None) -> Tuple[str, str]:
        """Generates secure PBKDF2-HMAC-SHA256 password hash with 100,000 iterations."""
        if not salt:
            salt = secrets.token_hex(16)
        hash_bytes = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        )
        return hash_bytes.hex(), salt

    def register(self, name: str, email: str, password: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Registers a new user. Returns (user_dict, error_message)."""
        clean_name = name.strip()
        clean_email = email.strip().lower()

        if len(clean_name) < 2:
            return None, "Name must be at least 2 characters."
        if "@" not in clean_email or "." not in clean_email:
            return None, "Invalid email address format."
        if len(password) < 6:
            return None, "Password must be at least 6 characters."

        pw_hash, salt = self._hash_password(password)

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO users (email, name, password_hash, salt, created_at, last_login)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (clean_email, clean_name, pw_hash, salt, datetime.utcnow(), datetime.utcnow()))
                conn.commit()
                user_id = cursor.lastrowid

            user = {
                "id": user_id,
                "name": clean_name,
                "email": clean_email,
                "initials": "".join([part[0] for part in clean_name.split() if part])[:2].upper() or "NS"
            }
            return user, None

        except sqlite3.IntegrityError:
            return None, "An account with this email address already exists."
        except Exception as e:
            return None, f"Database error: {str(e)}"

    def authenticate(self, email: str, password: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Verifies email and password. Returns (user_dict, error_message)."""
        clean_email = email.strip().lower()

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE email = ?", (clean_email,))
                row = cursor.fetchone()

                if not row:
                    return None, "Invalid email or password."

                stored_hash = row["password_hash"]
                salt = row["salt"]

                computed_hash, _ = self._hash_password(password, salt=salt)
                if not secrets.compare_digest(stored_hash, computed_hash):
                    return None, "Invalid email or password."

                cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (datetime.utcnow(), row["id"]))
                conn.commit()

                user_name = row["name"]
                user = {
                    "id": row["id"],
                    "name": user_name,
                    "email": row["email"],
                    "initials": "".join([part[0] for part in user_name.split() if part])[:2].upper() or "NS"
                }
                return user, None

        except Exception as e:
            return None, f"Authentication error: {str(e)}"


# Singleton instance
auth_service = AuthService()
