"""SQLite connections, schema creation and the seed routine.

One SQLite file holds the three tables of the design: employees, users and
sessions. The database is created and seeded at first start when it is empty;
an existing database is never reset.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "employees.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    work_email TEXT NOT NULL UNIQUE,
    job_title TEXT NOT NULL,
    department TEXT NOT NULL,
    employment_type TEXT NOT NULL CHECK (employment_type IN ('FULL_TIME', 'CONTRACT')),
    date_of_joining TEXT NOT NULL,
    manager_id INTEGER NULL REFERENCES employees(id) ON DELETE RESTRICT,
    phone TEXT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'EMPLOYEE')),
    employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_manager_active
    ON employees(manager_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
"""

# The three demo accounts of the design's "Test logins" table.
SEED_ACCOUNTS = [
    {
        "email": "admin@demo.test",
        "password": "DemoOnly-Admin-2026!",
        "role": "ADMIN",
        "full_name": "Avery Administrator",
        "job_title": "Head of People",
        "department": "People",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2021-01-04",
        "phone": "+1 202 555 0100",
    },
    {
        "email": "manager@demo.test",
        "password": "DemoOnly-Manager-2026!",
        "role": "MANAGER",
        "full_name": "Morgan Manager",
        "job_title": "Engineering Manager",
        "department": "Engineering",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2021-03-15",
        "phone": "+1 202 555 0101",
    },
    {
        "email": "employee@demo.test",
        "password": "DemoOnly-Employee-2026!",
        "role": "EMPLOYEE",
        "full_name": "Elliot Employee",
        "job_title": "Software Engineer",
        "department": "Engineering",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2022-06-01",
        "phone": "+1 202 555 0102",
    },
]

# The other synthetic employees: two active direct reports of the Manager, one
# unrelated active employee and one inactive employee.
SEED_EXTRA_EMPLOYEES = [
    {
        "full_name": "Priya Patel",
        "work_email": "priya.patel@demo.test",
        "job_title": "Software Engineer",
        "department": "Engineering",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2022-09-12",
        "manager_email": "manager@demo.test",
        "phone": "+1 202 555 0103",
        "is_active": 1,
    },
    {
        "full_name": "Quinn Rivera",
        "work_email": "quinn.rivera@demo.test",
        "job_title": "QA Engineer",
        "department": "Engineering",
        "employment_type": "CONTRACT",
        "date_of_joining": "2023-02-20",
        "manager_email": "manager@demo.test",
        "phone": None,
        "is_active": 1,
    },
    {
        "full_name": "Riley Chen",
        "work_email": "riley.chen@demo.test",
        "job_title": "Finance Analyst",
        "department": "Finance",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2020-11-02",
        "manager_email": None,
        "phone": "+1 202 555 0104",
        "is_active": 1,
    },
    {
        "full_name": "Sam Okafor",
        "work_email": "sam.okafor@demo.test",
        "job_title": "Support Specialist",
        "department": "Support",
        "employment_type": "CONTRACT",
        "date_of_joining": "2019-05-06",
        "manager_email": None,
        "phone": None,
        "is_active": 0,
    },
]


def utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def database_path() -> Path:
    """Return the SQLite file path, from EMS_DB_PATH when set."""
    configured = os.environ.get("EMS_DB_PATH")
    if configured:
        return Path(configured)
    return DEFAULT_DB_PATH


def connect(path: Path | str | None = None) -> sqlite3.Connection:
    """Open one connection with foreign keys on and a five-second busy timeout."""
    target = Path(path) if path is not None else database_path()
    if str(target) != ":memory:":
        target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target), timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    """Create the three tables and their indexes when they do not exist."""
    conn.executescript(SCHEMA)


def is_seeded(conn: sqlite3.Connection) -> bool:
    """Return True when the three demo accounts already exist."""
    row = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()
    return bool(row and row["n"] >= len(SEED_ACCOUNTS))


def seed(conn: sqlite3.Connection) -> bool:
    """Seed the demo data when the database holds no users.

    Returns True when rows were written. An already seeded database is left as
    it is.
    """
    if is_seeded(conn):
        return False

    # Imported here so the module can be imported without the password library.
    from .auth import hash_password

    now = utc_now()
    conn.execute("BEGIN IMMEDIATE")
    try:
        if is_seeded(conn):
            conn.execute("ROLLBACK")
            return False

        manager_employee_id = None
        for account in SEED_ACCOUNTS:
            cur = conn.execute(
                """
                INSERT INTO employees (
                    full_name, work_email, job_title, department, employment_type,
                    date_of_joining, manager_id, phone, is_active, version,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 1, 1, ?, ?)
                """,
                (
                    account["full_name"],
                    account["email"],
                    account["job_title"],
                    account["department"],
                    account["employment_type"],
                    account["date_of_joining"],
                    account["phone"],
                    now,
                    now,
                ),
            )
            employee_id = cur.lastrowid
            if account["role"] == "MANAGER":
                manager_employee_id = employee_id
            conn.execute(
                """
                INSERT INTO users (email, password_hash, role, employee_id)
                VALUES (?, ?, ?, ?)
                """,
                (
                    account["email"],
                    hash_password(account["password"]),
                    account["role"],
                    employee_id,
                ),
            )

        for extra in SEED_EXTRA_EMPLOYEES:
            manager_id = None
            if extra["manager_email"] == "manager@demo.test":
                manager_id = manager_employee_id
            conn.execute(
                """
                INSERT INTO employees (
                    full_name, work_email, job_title, department, employment_type,
                    date_of_joining, manager_id, phone, is_active, version,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    extra["full_name"],
                    extra["work_email"],
                    extra["job_title"],
                    extra["department"],
                    extra["employment_type"],
                    extra["date_of_joining"],
                    manager_id,
                    extra["phone"],
                    extra["is_active"],
                    now,
                    now,
                ),
            )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return True


def init_database(path: Path | str | None = None) -> None:
    """Create the schema and seed an empty database."""
    conn = connect(path)
    try:
        create_schema(conn)
        seed(conn)
    finally:
        conn.close()


def write_transaction(conn: sqlite3.Connection):
    """Context manager for a short BEGIN IMMEDIATE write transaction."""

    class _Tx:
        def __enter__(self):
            conn.execute("BEGIN IMMEDIATE")
            return conn

        def __exit__(self, exc_type, exc, tb):
            if exc_type is None:
                conn.execute("COMMIT")
            else:
                conn.execute("ROLLBACK")
            return False

    return _Tx()
