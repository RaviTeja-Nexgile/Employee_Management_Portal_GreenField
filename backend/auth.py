"""Password hashing, sessions, CSRF checks, role checks and projections."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, Request

try:  # pragma: no cover - exercised through the API tests
    from pwdlib import PasswordHash

    _password_hash = PasswordHash.recommended()
except Exception:  # pragma: no cover - fallback when pwdlib is unavailable
    _password_hash = None

SESSION_COOKIE = "ems_session"
SESSION_HOURS = 8
CSRF_HEADER = "X-CSRF-Token"
REQUEST_HEADER = "X-EMS-Request"


def hash_password(password: str) -> str:
    """Return an Argon2id hash of the password."""
    if _password_hash is not None:
        return _password_hash.hash(password)
    # Fallback: PBKDF2-SHA256 with a random salt, still never stores the password.
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Return True when the password matches the stored hash."""
    if stored.startswith("pbkdf2_sha256$"):
        _, salt, digest = stored.split("$", 2)
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), 200_000
        ).hex()
        return hmac.compare_digest(candidate, digest)
    if _password_hash is None:
        return False
    try:
        return bool(_password_hash.verify(password, stored))
    except Exception:
        return False


def sha256(value: str) -> str:
    """Return the hex SHA-256 digest of a value."""
    return hashlib.sha256(value.encode()).hexdigest()


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime) -> str:
    return value.isoformat()


def create_session(conn: sqlite3.Connection, user_id: int) -> tuple[str, str]:
    """Create a session row and return (cookie secret, csrf token)."""
    secret = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    session_id = secrets.token_hex(16)
    created = utc_now()
    expires = created + timedelta(hours=SESSION_HOURS)
    conn.execute(
        """
        INSERT INTO sessions (id, token_hash, csrf_token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (session_id, sha256(secret), csrf_token, user_id, iso(created), iso(expires)),
    )
    return secret, csrf_token


def delete_session(conn: sqlite3.Connection, secret: str | None) -> None:
    if not secret:
        return
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (sha256(secret),))


def delete_user_sessions(conn: sqlite3.Connection, user_id: int) -> None:
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


def _parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def current_session(conn: sqlite3.Connection, request: Request) -> sqlite3.Row | None:
    """Return the session row for the request cookie, or None."""
    secret = request.cookies.get(SESSION_COOKIE)
    if not secret:
        return None
    row = conn.execute(
        """
        SELECT s.id AS session_id, s.token_hash, s.csrf_token, s.user_id,
               s.created_at, s.expires_at,
               u.email AS user_email, u.role AS user_role, u.employee_id,
               e.full_name, e.is_active
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        JOIN employees e ON e.id = u.employee_id
        WHERE s.token_hash = ?
        """,
        (sha256(secret),),
    ).fetchone()
    if row is None:
        return None
    if _parse_iso(row["expires_at"]) <= utc_now():
        conn.execute("DELETE FROM sessions WHERE id = ?", (row["session_id"],))
        return None
    if not row["is_active"]:
        conn.execute("DELETE FROM sessions WHERE id = ?", (row["session_id"],))
        return None
    return row


def require_session(conn: sqlite3.Connection, request: Request) -> sqlite3.Row:
    """Return the session row or raise 401."""
    session = current_session(conn, request)
    if session is None:
        raise HTTPException(status_code=401, detail="unauthorized")
    return session


def check_csrf(session: sqlite3.Row, request: Request) -> None:
    """Raise 403 when the CSRF header does not match the session token."""
    sent = request.headers.get(CSRF_HEADER)
    if not sent or not hmac.compare_digest(sent, session["csrf_token"]):
        raise HTTPException(status_code=403, detail="forbidden")


def require_role(session: sqlite3.Row, role: str) -> None:
    if session["user_role"] != role:
        raise HTTPException(status_code=403, detail="forbidden")


def user_payload(session: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": session["user_id"],
        "email": session["user_email"],
        "role": session["user_role"],
        "employee_id": session["employee_id"],
        "full_name": session["full_name"],
    }


def employee_code(employee_id: int) -> str:
    return f"EMP-{int(employee_id):04d}"


def _base_fields(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "employee_code": employee_code(row["id"]),
        "full_name": row["full_name"],
        "work_email": row["work_email"],
        "job_title": row["job_title"],
        "department": row["department"],
    }


def project_employee(row: sqlite3.Row, view_kind: str) -> dict[str, Any]:
    """Return only the fields the view kind may see."""
    data = _base_fields(row)
    if view_kind in ("TEAM", "SELF", "ADMIN"):
        data["date_of_joining"] = row["date_of_joining"]
        data["employment_type"] = row["employment_type"]
        data["manager_id"] = row["manager_id"]
    if view_kind in ("SELF", "ADMIN"):
        data["phone"] = row["phone"]
        data["version"] = row["version"]
    if view_kind == "ADMIN":
        data["is_active"] = bool(row["is_active"])
        data["created_at"] = row["created_at"]
        data["updated_at"] = row["updated_at"]
    return data


def directory_item(row: sqlite3.Row, include_status: bool) -> dict[str, Any]:
    data = _base_fields(row)
    if include_status:
        data["is_active"] = bool(row["is_active"])
    return data


def view_kind_for(session: sqlite3.Row, row: sqlite3.Row) -> str:
    """Choose the projection for an active record."""
    if session["user_role"] == "ADMIN":
        return "ADMIN"
    if row["id"] == session["employee_id"]:
        return "SELF"
    if session["user_role"] == "MANAGER" and row["manager_id"] == session["employee_id"]:
        return "TEAM"
    return "DIRECTORY"
