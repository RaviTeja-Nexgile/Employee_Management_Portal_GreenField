"""FastAPI application: the eleven /api operations of the design."""

from __future__ import annotations

import os
import sqlite3
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import auth, db
from .schemas import (
    DeactivateRequest,
    EmployeeCreate,
    EmployeeUpdate,
    LoginRequest,
    ProfileUpdate,
)

ERROR_MESSAGES = {
    "unauthorized": "Email or password is incorrect.",
    "forbidden": "You are not allowed to do that.",
    "not_found": "Not found.",
    "conflict": "This record changed since you opened it. Reload to see the latest values.",
    "validation_error": "Please check the highlighted fields.",
    "unavailable": "The service is temporarily unavailable. Try again.",
}

FIELD_LABELS = {
    "full_name": "Full name",
    "work_email": "Work email",
    "job_title": "Job title",
    "department": "Department",
    "employment_type": "Employment type",
    "date_of_joining": "Joining date",
    "manager_id": "Manager",
    "phone": "Phone",
    "version": "Version",
    "email": "Email",
    "password": "Password",
}


def error_body(code: str, message: str | None = None, fields: dict | None = None) -> dict:
    body: dict[str, Any] = {
        "error": {"code": code, "message": message or ERROR_MESSAGES.get(code, "Error.")}
    }
    if fields:
        body["error"]["fields"] = fields
    return body


def api_error(status: int, code: str, message: str | None = None, fields: dict | None = None):
    return JSONResponse(status_code=status, content=error_body(code, message, fields))


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_database()
    yield


app = FastAPI(title="Employee Management System", lifespan=lifespan)


# --------------------------------------------------------------------------
# Error handlers: every error answer uses the shared shape.
# --------------------------------------------------------------------------


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    code = {
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        503: "unavailable",
    }.get(exc.status_code, "error")
    message = None
    if isinstance(exc.detail, str) and exc.detail not in (
        "unauthorized",
        "forbidden",
        "not_found",
        "conflict",
        "validation_error",
        "unavailable",
    ):
        message = exc.detail
    return api_error(exc.status_code, code, message)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    fields: dict[str, str] = {}
    for err in exc.errors():
        loc = [part for part in err.get("loc", []) if part not in ("body", "query", "path")]
        name = str(loc[-1]) if loc else "form"
        label = FIELD_LABELS.get(name, name.replace("_", " ").capitalize())
        message = err.get("msg", "Invalid value.")
        if err.get("type") == "extra_forbidden":
            message = "This field is not allowed."
        fields[name] = f"{label}: {message}"
    return api_error(422, "validation_error", fields=fields)


@app.exception_handler(sqlite3.OperationalError)
async def sqlite_error_handler(request: Request, exc: sqlite3.OperationalError):
    return api_error(503, "unavailable")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _allowed_origins() -> set[str]:
    port = os.environ.get("PORT", "5173")
    return {
        f"http://127.0.0.1:{port}",
        f"http://localhost:{port}",
        f"http://127.0.0.1:{os.environ.get('API_PORT', '8000')}",
        f"http://localhost:{os.environ.get('API_PORT', '8000')}",
    }


def check_unsafe_request(request: Request) -> None:
    """Origin, content type and request header checks for unsafe requests."""
    origin = request.headers.get("origin")
    if origin:
        parsed = urlparse(origin)
        host = parsed.hostname or ""
        if host not in ("127.0.0.1", "localhost"):
            raise HTTPException(status_code=403, detail="forbidden")
    if request.headers.get(auth.REQUEST_HEADER) != "1":
        raise HTTPException(status_code=403, detail="forbidden")
    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("application/json"):
        raise HTTPException(status_code=403, detail="forbidden")


def get_conn() -> sqlite3.Connection:
    return db.connect()


def no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def fetch_employee(conn: sqlite3.Connection, employee_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM employees WHERE id = ?", (employee_id,)).fetchone()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _like_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _is_descendant(conn: sqlite3.Connection, candidate_id: int, ancestor_id: int) -> bool:
    """Return True when candidate_id is below ancestor_id in the chain."""
    seen: set[int] = set()
    current: int | None = candidate_id
    while current is not None and current not in seen:
        seen.add(current)
        row = conn.execute(
            "SELECT manager_id FROM employees WHERE id = ?", (current,)
        ).fetchone()
        if row is None:
            return False
        current = row["manager_id"]
        if current == ancestor_id:
            return True
    return False


def _validate_manager(
    conn: sqlite3.Connection, employee_id: int | None, manager_id: int | None
) -> None:
    if manager_id is None:
        return
    if employee_id is not None and manager_id == employee_id:
        raise HTTPException(
            status_code=422,
            detail="Choose a manager who is active and not below this employee.",
        )
    manager = fetch_employee(conn, manager_id)
    if manager is None or not manager["is_active"]:
        raise HTTPException(
            status_code=422,
            detail="Choose a manager who is active and not below this employee.",
        )
    if employee_id is not None and _is_descendant(conn, manager_id, employee_id):
        raise HTTPException(
            status_code=422,
            detail="Choose a manager who is active and not below this employee.",
        )


def _email_taken(conn: sqlite3.Connection, email: str, exclude_id: int | None = None) -> bool:
    row = conn.execute(
        "SELECT id FROM employees WHERE work_email = ?", (email,)
    ).fetchone()
    return row is not None and row["id"] != exclude_id


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------


@app.get("/api/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, response: Response):
    check_unsafe_request(request)
    conn = get_conn()
    try:
        email = _normalize_email(payload.email)
        row = conn.execute(
            """
            SELECT u.id AS user_id, u.email, u.password_hash, u.role, u.employee_id,
                   e.full_name, e.is_active
            FROM users u JOIN employees e ON e.id = u.employee_id
            WHERE u.email = ?
            """,
            (email,),
        ).fetchone()
        if (
            row is None
            or not row["is_active"]
            or not auth.verify_password(payload.password, row["password_hash"])
        ):
            return api_error(401, "unauthorized", "Email or password is incorrect.")

        secret, csrf_token = auth.create_session(conn, row["user_id"])
        session = {
            "user_id": row["user_id"],
            "user_email": row["email"],
            "user_role": row["role"],
            "employee_id": row["employee_id"],
            "full_name": row["full_name"],
        }
        response.set_cookie(
            auth.SESSION_COOKIE,
            secret,
            httponly=True,
            samesite="lax",
            path="/",
            secure=False,
        )
        no_store(response)
        return {"user": auth.user_payload(session), "csrf_token": csrf_token}
    finally:
        conn.close()


@app.get("/api/auth/me")
def me(request: Request, response: Response):
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        no_store(response)
        return {"user": auth.user_payload(session), "csrf_token": session["csrf_token"]}
    finally:
        conn.close()


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    check_unsafe_request(request)
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        auth.check_csrf(session, request)
        auth.delete_session(conn, request.cookies.get(auth.SESSION_COOKIE))
        response.delete_cookie(auth.SESSION_COOKIE, path="/")
        response.status_code = 204
        no_store(response)
        return Response(status_code=204, headers={"Cache-Control": "no-store"})
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Dashboard
# --------------------------------------------------------------------------


@app.get("/api/dashboard")
def dashboard(request: Request, response: Response):
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        no_store(response)
        role = session["user_role"]
        if role == "ADMIN":
            row = conn.execute(
                """
                SELECT COUNT(*) AS total,
                       COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active
                FROM employees
                """
            ).fetchone()
            total = row["total"]
            active = row["active"]
            return {
                "role": "ADMIN",
                "total_employees": total,
                "active_employees": active,
                "inactive_employees": total - active,
            }
        own = fetch_employee(conn, session["employee_id"])
        if role == "MANAGER":
            count = conn.execute(
                "SELECT COUNT(*) AS n FROM employees WHERE manager_id = ? AND is_active = 1",
                (session["employee_id"],),
            ).fetchone()["n"]
            return {
                "role": "MANAGER",
                "direct_report_count": count,
                "department": own["department"],
                "job_title": own["job_title"],
            }
        return {
            "role": "EMPLOYEE",
            "department": own["department"],
            "job_title": own["job_title"],
            "is_active": bool(own["is_active"]),
        }
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Employees
# --------------------------------------------------------------------------


@app.get("/api/employees")
def list_employees(
    request: Request,
    response: Response,
    q: str | None = None,
    page: int = 1,
    page_size: int = 25,
    team_only: bool = False,
    include_inactive: bool = False,
):
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        no_store(response)
        role = session["user_role"]
        if include_inactive and role != "ADMIN":
            raise HTTPException(status_code=403, detail="forbidden")
        if team_only and role != "MANAGER":
            raise HTTPException(status_code=403, detail="forbidden")
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 100:
            page_size = 100

        where: list[str] = []
        params: list[Any] = []
        if role == "ADMIN":
            if not include_inactive:
                where.append("is_active = 1")
        else:
            where.append("is_active = 1")
        if team_only:
            where.append("manager_id = ?")
            params.append(session["employee_id"])
        if q:
            needle = f"%{_like_escape(q.strip().lower())}%"
            where.append(
                "(LOWER(full_name) LIKE ? ESCAPE '\\' OR LOWER(work_email) LIKE ? ESCAPE '\\')"
            )
            params.extend([needle, needle])

        clause = (" WHERE " + " AND ".join(where)) if where else ""
        total = conn.execute(
            f"SELECT COUNT(*) AS n FROM employees{clause}", params
        ).fetchone()["n"]
        rows = conn.execute(
            f"""
            SELECT * FROM employees{clause}
            ORDER BY full_name COLLATE NOCASE ASC, id ASC
            LIMIT ? OFFSET ?
            """,
            [*params, page_size, (page - 1) * page_size],
        ).fetchall()
        items = [auth.directory_item(row, role == "ADMIN") for row in rows]
        return {"items": items, "page": page, "page_size": page_size, "total": total}
    finally:
        conn.close()


@app.post("/api/employees", status_code=201)
def create_employee(payload: EmployeeCreate, request: Request, response: Response):
    check_unsafe_request(request)
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        auth.require_role(session, "ADMIN")
        auth.check_csrf(session, request)

        email = _normalize_email(str(payload.work_email))
        if _email_taken(conn, email):
            return api_error(
                409,
                "conflict",
                "This work email is already in use.",
                {"work_email": "This work email is already in use."},
            )
        _validate_manager(conn, None, payload.manager_id)

        now = db.utc_now()
        with db.write_transaction(conn):
            cur = conn.execute(
                """
                INSERT INTO employees (
                    full_name, work_email, job_title, department, employment_type,
                    date_of_joining, manager_id, phone, is_active, version,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
                """,
                (
                    payload.full_name,
                    email,
                    payload.job_title,
                    payload.department,
                    payload.employment_type,
                    payload.date_of_joining.isoformat(),
                    payload.manager_id,
                    payload.phone,
                    now,
                    now,
                ),
            )
            new_id = cur.lastrowid
        row = fetch_employee(conn, new_id)
        no_store(response)
        return {"view_kind": "ADMIN", "employee": auth.project_employee(row, "ADMIN")}
    finally:
        conn.close()


@app.get("/api/employees/{employee_id}")
def get_employee(employee_id: str, request: Request, response: Response):
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        no_store(response)
        if not employee_id.isdigit():
            raise HTTPException(status_code=404, detail="not_found")
        row = fetch_employee(conn, int(employee_id))
        if row is None:
            raise HTTPException(status_code=404, detail="not_found")
        if not row["is_active"] and session["user_role"] != "ADMIN":
            raise HTTPException(status_code=404, detail="not_found")
        kind = auth.view_kind_for(session, row)
        return {"view_kind": kind, "employee": auth.project_employee(row, kind)}
    finally:
        conn.close()


@app.patch("/api/employees/{employee_id}")
def update_employee(
    employee_id: str, payload: EmployeeUpdate, request: Request, response: Response
):
    check_unsafe_request(request)
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        auth.require_role(session, "ADMIN")
        auth.check_csrf(session, request)
        if not employee_id.isdigit():
            raise HTTPException(status_code=404, detail="not_found")
        target_id = int(employee_id)
        row = fetch_employee(conn, target_id)
        if row is None:
            raise HTTPException(status_code=404, detail="not_found")
        if not row["is_active"]:
            return api_error(409, "conflict", "This employee is inactive.")
        if payload.version != row["version"]:
            return api_error(409, "conflict")

        updates: dict[str, Any] = {}
        data = payload.model_dump(exclude_unset=True)
        data.pop("version", None)
        if "work_email" in data and data["work_email"] is not None:
            email = _normalize_email(str(data["work_email"]))
            if _email_taken(conn, email, exclude_id=target_id):
                return api_error(
                    409,
                    "conflict",
                    "This work email is already in use.",
                    {"work_email": "This work email is already in use."},
                )
            updates["work_email"] = email
        for key in ("full_name", "job_title", "department", "employment_type", "phone"):
            if key in data:
                updates[key] = data[key]
        if "date_of_joining" in data and data["date_of_joining"] is not None:
            updates["date_of_joining"] = data["date_of_joining"].isoformat()
        if "manager_id" in data:
            _validate_manager(conn, target_id, data["manager_id"])
            updates["manager_id"] = data["manager_id"]

        now = db.utc_now()
        with db.write_transaction(conn):
            assignments = ", ".join(f"{key} = ?" for key in updates)
            values = list(updates.values())
            if assignments:
                conn.execute(
                    f"""
                    UPDATE employees
                    SET {assignments}, version = version + 1, updated_at = ?
                    WHERE id = ? AND version = ?
                    """,
                    [*values, now, target_id, payload.version],
                )
            else:
                conn.execute(
                    """
                    UPDATE employees
                    SET version = version + 1, updated_at = ?
                    WHERE id = ? AND version = ?
                    """,
                    (now, target_id, payload.version),
                )
        updated = fetch_employee(conn, target_id)
        no_store(response)
        return {"view_kind": "ADMIN", "employee": auth.project_employee(updated, "ADMIN")}
    finally:
        conn.close()


@app.post("/api/employees/{employee_id}/deactivate")
def deactivate_employee(
    employee_id: str, payload: DeactivateRequest, request: Request, response: Response
):
    check_unsafe_request(request)
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        auth.require_role(session, "ADMIN")
        auth.check_csrf(session, request)
        if not employee_id.isdigit():
            raise HTTPException(status_code=404, detail="not_found")
        target_id = int(employee_id)
        row = fetch_employee(conn, target_id)
        if row is None:
            raise HTTPException(status_code=404, detail="not_found")

        admin_link = conn.execute(
            "SELECT id FROM users WHERE employee_id = ? AND role = 'ADMIN'", (target_id,)
        ).fetchone()
        reports = conn.execute(
            "SELECT COUNT(*) AS n FROM employees WHERE manager_id = ? AND is_active = 1",
            (target_id,),
        ).fetchone()["n"]

        if payload.anonymise:
            if admin_link is not None or reports > 0 or payload.version != row["version"]:
                return api_error(
                    409,
                    "conflict",
                    "This record cannot be anonymised. Reload to see the latest values.",
                )
        else:
            if admin_link is not None:
                return api_error(
                    409, "conflict", "An administrator account cannot be deactivated."
                )
            if reports > 0:
                return api_error(
                    409,
                    "conflict",
                    "Reassign this employee's direct reports before deactivating.",
                )
            if payload.version != row["version"]:
                return api_error(409, "conflict")

        now = db.utc_now()
        with db.write_transaction(conn):
            if payload.anonymise:
                conn.execute(
                    """
                    UPDATE employees
                    SET full_name = 'Anonymised employee',
                        work_email = ?,
                        phone = NULL,
                        is_active = 0,
                        version = version + 1,
                        updated_at = ?
                    WHERE id = ? AND version = ?
                    """,
                    (f"anonymised-{target_id}@demo.test", now, target_id, payload.version),
                )
            else:
                conn.execute(
                    """
                    UPDATE employees
                    SET is_active = 0, version = version + 1, updated_at = ?
                    WHERE id = ? AND version = ?
                    """,
                    (now, target_id, payload.version),
                )
            linked = conn.execute(
                "SELECT id FROM users WHERE employee_id = ?", (target_id,)
            ).fetchone()
            if linked is not None:
                auth.delete_user_sessions(conn, linked["id"])

        updated = fetch_employee(conn, target_id)
        no_store(response)
        return {"view_kind": "ADMIN", "employee": auth.project_employee(updated, "ADMIN")}
    finally:
        conn.close()


# --------------------------------------------------------------------------
# My profile
# --------------------------------------------------------------------------


@app.get("/api/me/profile")
def get_profile(request: Request, response: Response):
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        no_store(response)
        row = fetch_employee(conn, session["employee_id"])
        if row is None:
            raise HTTPException(status_code=404, detail="not_found")
        return {"view_kind": "SELF", "employee": auth.project_employee(row, "SELF")}
    finally:
        conn.close()


@app.patch("/api/me/profile")
def update_profile(payload: ProfileUpdate, request: Request, response: Response):
    check_unsafe_request(request)
    conn = get_conn()
    try:
        session = auth.require_session(conn, request)
        auth.check_csrf(session, request)
        row = fetch_employee(conn, session["employee_id"])
        if row is None:
            raise HTTPException(status_code=404, detail="not_found")
        if payload.version != row["version"]:
            return api_error(409, "conflict")
        now = db.utc_now()
        with db.write_transaction(conn):
            conn.execute(
                """
                UPDATE employees
                SET phone = ?, version = version + 1, updated_at = ?
                WHERE id = ? AND version = ?
                """,
                (payload.phone, now, row["id"], payload.version),
            )
        updated = fetch_employee(conn, row["id"])
        no_store(response)
        return {"view_kind": "SELF", "employee": auth.project_employee(updated, "SELF")}
    finally:
        conn.close()
