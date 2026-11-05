"""Pytest fixtures: each test gets its own temporary SQLite database."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import db  # noqa: E402


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    monkeypatch.setenv("EMS_DB_PATH", str(path))
    db.init_database(path)
    return path


@pytest.fixture()
def client(db_path):
    from fastapi.testclient import TestClient

    from backend.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def conn(db_path):
    connection = db.connect(db_path)
    yield connection
    connection.close()


def login(client, email: str, password: str) -> dict:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers={"X-EMS-Request": "1", "Origin": "http://127.0.0.1:5173"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def csrf_headers(token: str) -> dict:
    return {
        "X-EMS-Request": "1",
        "X-CSRF-Token": token,
        "Origin": "http://127.0.0.1:5173",
    }
