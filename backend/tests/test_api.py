"""API and authorization tests for the Employee Management System."""

from __future__ import annotations

from backend.tests.conftest import csrf_headers, login

ADMIN = ("admin@demo.test", "DemoOnly-Admin-2026!")
MANAGER = ("manager@demo.test", "DemoOnly-Manager-2026!")
EMPLOYEE = ("employee@demo.test", "DemoOnly-Employee-2026!")


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_each_role(client):
    for email, password in (ADMIN, MANAGER, EMPLOYEE):
        data = login(client, email, password)
        assert data["user"]["email"] == email
        assert data["csrf_token"]
        assert "ems_session" in client.cookies


def test_login_wrong_password(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@demo.test", "password": "wrong"},
        headers={"X-EMS-Request": "1"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Email or password is incorrect."


def test_login_requires_request_header(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@demo.test", "password": "DemoOnly-Admin-2026!"},
    )
    assert response.status_code == 403


def test_anonymous_access_is_401(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/employees").status_code == 401


def test_me_returns_user(client):
    data = login(client, *ADMIN)
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "ADMIN"
    assert response.json()["csrf_token"] == data["csrf_token"]


def test_logout_clears_session(client):
    data = login(client, *ADMIN)
    response = client.post("/api/auth/logout", json={}, headers=csrf_headers(data["csrf_token"]))
    assert response.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_dashboard_per_role(client):
    admin_login = login(client, *ADMIN)
    admin = client.get("/api/dashboard").json()
    assert admin["role"] == "ADMIN"
    assert admin["total_employees"] >= 6
    assert admin["inactive_employees"] >= 1
    client.post(
        "/api/auth/logout", json={}, headers=csrf_headers(admin_login["csrf_token"])
    )

    login(client, *MANAGER)
    manager = client.get("/api/dashboard").json()
    assert manager["role"] == "MANAGER"
    assert manager["direct_report_count"] >= 2
    assert manager["department"] == "Engineering"


def test_directory_hides_private_fields(client):
    login(client, *EMPLOYEE)
    response = client.get("/api/employees")
    assert response.status_code == 200
    body = response.json()
    assert body["page_size"] == 25
    assert body["items"]
    for item in body["items"]:
        assert "phone" not in item
        assert "date_of_joining" not in item
        assert "employment_type" not in item
        assert "is_active" not in item


def test_directory_search_is_case_insensitive(client):
    login(client, *EMPLOYEE)
    response = client.get("/api/employees", params={"q": "PRIYA"})
    assert response.status_code == 200
    items = response.json()["items"]
    assert any(item["work_email"] == "priya.patel@demo.test" for item in items)


def test_manager_team_only(client):
    login(client, *MANAGER)
    response = client.get("/api/employees", params={"team_only": "true"})
    assert response.status_code == 200
    assert response.json()["total"] >= 2


def test_employee_cannot_use_team_only(client):
    login(client, *EMPLOYEE)
    assert client.get("/api/employees", params={"team_only": "true"}).status_code == 403


def test_employee_cannot_create(client):
    data = login(client, *EMPLOYEE)
    response = client.post(
        "/api/employees",
        json={
            "full_name": "New Person",
            "work_email": "new.person@demo.test",
            "job_title": "Engineer",
            "department": "Engineering",
            "employment_type": "FULL_TIME",
            "date_of_joining": "2024-01-01",
        },
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 403


def test_csrf_rejected(client):
    data = login(client, *ADMIN)
    response = client.post(
        "/api/employees",
        json={
            "full_name": "New Person",
            "work_email": "new.person@demo.test",
            "job_title": "Engineer",
            "department": "Engineering",
            "employment_type": "FULL_TIME",
            "date_of_joining": "2024-01-01",
        },
        headers={"X-EMS-Request": "1", "X-CSRF-Token": "wrong"},
    )
    assert response.status_code == 403


def test_admin_creates_employee(client):
    data = login(client, *ADMIN)
    response = client.post(
        "/api/employees",
        json={
            "full_name": "Avery Stone",
            "work_email": "avery.stone@demo.test",
            "job_title": "Software Engineer",
            "department": "Engineering",
            "employment_type": "FULL_TIME",
            "date_of_joining": "2024-01-01",
            "phone": None,
        },
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 201, response.text
    employee = response.json()["employee"]
    assert employee["employee_code"].startswith("EMP-")
    assert employee["is_active"] is True
    assert employee["version"] == 1


def test_duplicate_email_conflict(client):
    data = login(client, *ADMIN)
    response = client.post(
        "/api/employees",
        json={
            "full_name": "Duplicate",
            "work_email": "admin@demo.test",
            "job_title": "Engineer",
            "department": "Engineering",
            "employment_type": "FULL_TIME",
            "date_of_joining": "2024-01-01",
        },
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 409


def test_extra_field_rejected(client):
    data = login(client, *ADMIN)
    response = client.post(
        "/api/employees",
        json={
            "full_name": "Role Setter",
            "work_email": "role.setter@demo.test",
            "job_title": "Engineer",
            "department": "Engineering",
            "employment_type": "FULL_TIME",
            "date_of_joining": "2024-01-01",
            "role": "ADMIN",
        },
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 422


def test_self_profile_phone_update(client):
    data = login(client, *EMPLOYEE)
    profile = client.get("/api/me/profile").json()["employee"]
    response = client.patch(
        "/api/me/profile",
        json={"phone": "+1 202 555 0199", "version": profile["version"]},
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 200
    assert response.json()["employee"]["phone"] == "+1 202 555 0199"
    assert response.json()["employee"]["version"] == profile["version"] + 1


def test_self_profile_rejects_other_fields(client):
    data = login(client, *EMPLOYEE)
    profile = client.get("/api/me/profile").json()["employee"]
    response = client.patch(
        "/api/me/profile",
        json={"job_title": "CEO", "version": profile["version"]},
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 422


def test_stale_version_conflict(client):
    data = login(client, *EMPLOYEE)
    profile = client.get("/api/me/profile").json()["employee"]
    response = client.patch(
        "/api/me/profile",
        json={"phone": "1", "version": profile["version"] + 5},
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 409


def test_admin_cannot_deactivate_self(client):
    data = login(client, *ADMIN)
    me = client.get("/api/auth/me").json()["user"]
    response = client.post(
        f"/api/employees/{me['employee_id']}/deactivate",
        json={"version": 1},
        headers=csrf_headers(data["csrf_token"]),
    )
    assert response.status_code == 409
    assert response.json()["error"]["message"] == "An administrator account cannot be deactivated."


def test_detail_projection_for_employee(client):
    login(client, *EMPLOYEE)
    me = client.get("/api/auth/me").json()["user"]
    response = client.get(f"/api/employees/{me['employee_id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["view_kind"] == "SELF"
    assert "phone" in body["employee"]


def test_detail_non_numeric_id_is_404(client):
    login(client, *EMPLOYEE)
    assert client.get("/api/employees/abc").status_code == 404


def test_inactive_employee_login_rejected(client, conn):
    conn.execute("UPDATE employees SET is_active = 0 WHERE work_email = 'employee@demo.test'")
    response = client.post(
        "/api/auth/login",
        json={"email": "employee@demo.test", "password": "DemoOnly-Employee-2026!"},
        headers={"X-EMS-Request": "1"},
    )
    assert response.status_code == 401
