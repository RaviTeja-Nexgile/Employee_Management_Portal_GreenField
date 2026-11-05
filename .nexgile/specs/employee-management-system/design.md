# Design: Employee Management System

## Overview

A local demonstration of an employee management app for three fixed roles: Administrator, Manager and Employee. People sign in with one of three seeded demo accounts, browse a searchable employee directory, open an employee's details with the fields their role may see, and update their own phone number. An Administrator adds, edits, deactivates and anonymises employee records.

The app is a single-page React application served by Vite, talking to a FastAPI server over same-origin `/api` requests, with data kept in one local SQLite file. There are exactly five page routes, three tables and eleven API operations. It runs locally only, on synthetic data, and is not deployed.

## Architecture

```
Browser (React + TypeScript + Vite, port from PORT)
  |  same-origin /api requests, session cookie, X-CSRF-Token, X-EMS-Request: 1
  v
Vite dev server (127.0.0.1:PORT) --proxy /api--> FastAPI (uvicorn, 127.0.0.1:API_PORT)
                                                     |
                                                     v
                                             SQLite file backend/data/employees.db
```

- **Frontend**: React 18 + TypeScript + Vite, React Router for the five routes, plain CSS with shared CSS variables, IBM Plex Sans self-hosted from `frontend/public/fonts/`, Lucide React icons, browser `fetch` through one small API helper (`frontend/src/api.ts`) that sends credentials, the CSRF token and the `X-EMS-Request: 1` header, and turns error answers into one shared error shape.
- **Backend**: Python 3.12+, FastAPI, Uvicorn, Pydantic models with `extra="forbid"` for every mutation, `pwdlib[argon2]` for Argon2id password hashes, and Python `sqlite3` with parameterized SQL. One connection per request, `PRAGMA foreign_keys = ON`, a five-second busy timeout, and short `BEGIN IMMEDIATE` write transactions.
- **Database**: one SQLite file at `backend/data/employees.db`, created and seeded at first start when empty, excluded from version control.
- **Ports**: the Vite dev server listens on `127.0.0.1` at the port in `PORT` and proxies `/api` to the API. The API listens on `127.0.0.1` at the port in `API_PORT` (default `8000`). `Dev` starts both.

## Components and Interfaces

### Frontend

| File | Responsibility |
|---|---|
| `frontend/src/main.tsx` | Mounts the app, loads the IBM Plex Sans faces through the Font Loading API before rendering text. |
| `frontend/src/App.tsx` | Routes, auth bootstrap (`GET /api/auth/me`), protected shell, redirects, Not found view. |
| `frontend/src/api.ts` | Same-origin fetch helper: credentials, CSRF header, `X-EMS-Request`, error parsing, `401` handling. |
| `frontend/src/auth.tsx` | Auth context: current user, CSRF token in memory, sign-in, sign-out, `401` reset. |
| `frontend/src/pages/Login.tsx` | Login page. |
| `frontend/src/pages/Dashboard.tsx` | Role-aware dashboard. |
| `frontend/src/pages/Employees.tsx` | Directory, search, filters, pagination, Add/Edit modal, Deactivate and Anonymise dialogs. |
| `frontend/src/pages/EmployeeDetail.tsx` | One employee with role-specific fields. |
| `frontend/src/pages/MyProfile.tsx` | Own record, phone editing only. |
| `frontend/src/components/` | Shell (sidebar, top bar), Button, Field, Modal, Card, Table, Pagination, EmployeeForm, ConfirmDialog, states (loading, empty, error). |
| `frontend/src/styles.css` | Font declarations, CSS variables, base and responsive styles. |

Each page has its own CSS module beside it (`Login.module.css`, `Dashboard.module.css`, `Employees.module.css`, `EmployeeDetail.module.css`, `MyProfile.module.css`) that uses the shared variables.

### Backend

| File | Responsibility |
|---|---|
| `backend/main.py` | FastAPI app, the eleven endpoints, error handlers, origin and header checks. |
| `backend/db.py` | Connections, schema creation, seed routine, write transactions. |
| `backend/auth.py` | Password hashing, session creation and lookup, CSRF checks, role checks, projections. |
| `backend/schemas.py` | Pydantic request and response models. |
| `backend/tests/test_api.py` | API and authorization tests. |
| `backend/requirements.txt` | Pinned backend dependencies. |

## Data Models

Exactly three tables. Timestamps are UTC ISO-8601 strings; joining date is `YYYY-MM-DD`; flags are `0/1`.

**employees**

| Column | Type and rule |
|---|---|
| `id` | `INTEGER PRIMARY KEY` |
| `full_name` | `TEXT NOT NULL`, 1–100 trimmed characters |
| `work_email` | `TEXT NOT NULL UNIQUE`, valid email, max 254, normalized (trimmed, lower-cased) |
| `job_title` | `TEXT NOT NULL`, 1–100 |
| `department` | `TEXT NOT NULL`, 1–80, free text |
| `employment_type` | `TEXT NOT NULL CHECK (employment_type IN ('FULL_TIME','CONTRACT'))` |
| `date_of_joining` | `TEXT NOT NULL`, valid date not after today (UTC) |
| `manager_id` | `INTEGER NULL REFERENCES employees(id) ON DELETE RESTRICT` |
| `phone` | `TEXT NULL`, max 30 |
| `is_active` | `INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))` |
| `version` | `INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)` |
| `created_at` | `TEXT NOT NULL` |
| `updated_at` | `TEXT NOT NULL` |

Employee code is derived, not stored: `EMP-` plus the id padded to four digits (`EMP-0003`).

**users**

| Column | Type and rule |
|---|---|
| `id` | `INTEGER PRIMARY KEY` |
| `email` | `TEXT NOT NULL UNIQUE` (login email) |
| `password_hash` | `TEXT NOT NULL` (Argon2id) |
| `role` | `TEXT NOT NULL CHECK (role IN ('ADMIN','MANAGER','EMPLOYEE'))` |
| `employee_id` | `INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT` |

**sessions**

| Column | Type and rule |
|---|---|
| `id` | `TEXT PRIMARY KEY` (non-secret UUID) |
| `token_hash` | `TEXT NOT NULL UNIQUE` (SHA-256 of the cookie secret) |
| `csrf_token` | `TEXT NOT NULL` |
| `user_id` | `INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `created_at` | `TEXT NOT NULL` |
| `expires_at` | `TEXT NOT NULL` (created_at + 8 hours) |

Indexes: `employees(manager_id, is_active)`, `employees(is_active)`, `sessions(user_id)`.

**Seed data** (only when the database is empty; never resets existing records):

| Role | Login email | Password | Linked employee |
|---|---|---|---|
| ADMIN | `admin@demo.test` | `DemoOnly-Admin-2026!` | Administrator record, active |
| MANAGER | `manager@demo.test` | `DemoOnly-Manager-2026!` | Manager record, active |
| EMPLOYEE | `employee@demo.test` | `DemoOnly-Employee-2026!` | Employee record, active |

Six synthetic employees in all: the three above, at least two active direct reports under the Manager, one unrelated active employee, and one inactive employee. Creating an employee never creates a login account.

## API

Base path `/api`. JSON in and out. All paths below are relative to `/api`.

**Error body** (every error answer):

```json
{"error":{"code":"validation_error","message":"Please check the highlighted fields.","fields":{"work_email":"Enter a valid email address."}}}
```

Codes: `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `validation_error` (422), `unavailable` (503). FastAPI validation errors are normalized into this shape. Passwords and SQL details are never echoed.

**Headers on every unsafe request** (POST, PATCH, including login and logout): exact allowed `Origin` (the Vite origin, `http://127.0.0.1:<PORT>` or `http://localhost:<PORT>`), `Content-Type: application/json`, `X-EMS-Request: 1`, and for signed-in requests `X-CSRF-Token` equal to the session's token. CORS stays disabled.

**Session cookie**: `ems_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure=false` for local development, holding the random 32-byte secret. Only its SHA-256 digest is stored.

| Method and path | Access | Request body | Success answer |
|---|---|---|---|
| `POST /api/auth/login` | public, origin-protected | `{"email": string, "password": string}` | `200` `{"user": User, "csrf_token": string}` + cookie; `401` `{"error":{"code":"unauthorized","message":"Email or password is incorrect."}}` |
| `GET /api/auth/me` | signed in | none | `200` `{"user": User, "csrf_token": string}`; `401` |
| `POST /api/auth/logout` | signed in + CSRF | `{}` | `204`, session deleted, cookie cleared |
| `GET /api/dashboard` | signed in | none | `200` role-specific summary (below) |
| `GET /api/employees` | signed in | query `q`, `page`, `page_size`, `team_only`, `include_inactive` | `200` `{"items": DirectoryItem[], "page": int, "page_size": int, "total": int}` |
| `POST /api/employees` | ADMIN + CSRF | create fields (below) | `201` `{"view_kind":"ADMIN","employee": AdminEmployee}`; `409` duplicate email; `422` invalid |
| `GET /api/employees/{id}` | signed in | none | `200` `{"view_kind": "DIRECTORY"\|"TEAM"\|"SELF"\|"ADMIN", "employee": ...}`; `404` |
| `PATCH /api/employees/{id}` | ADMIN + CSRF | allowed fields + `version` | `200` `{"view_kind":"ADMIN","employee": AdminEmployee}`; `409` stale version; `422`; `404` |
| `POST /api/employees/{id}/deactivate` | ADMIN + CSRF | `{"version": int}` | `200` `{"view_kind":"ADMIN","employee": AdminEmployee}`; `409` blocked or stale |
| `GET /api/me/profile` | signed in | none | `200` `{"view_kind":"SELF","employee": SelfEmployee}` |
| `PATCH /api/me/profile` | signed in + CSRF | `{"phone": string \| null, "version": int}` | `200` `{"view_kind":"SELF","employee": SelfEmployee}`; `409` stale; `422` |

**User**: `{"id": int, "email": string, "role": "ADMIN"|"MANAGER"|"EMPLOYEE", "employee_id": int, "full_name": string}`.

**DirectoryItem**: `{"id", "employee_code", "full_name", "work_email", "job_title", "department"}` and, for an Administrator only, `"is_active": boolean`.

**Employee detail projections** (only authorized fields are selected before serialization):

- `DIRECTORY`: `id`, `employee_code`, `full_name`, `work_email`, `job_title`, `department`.
- `TEAM`: DIRECTORY plus `date_of_joining`, `employment_type`, `manager_id`.
- `SELF`: TEAM plus `phone`, `version`.
- `ADMIN`: SELF plus `is_active`, `created_at`, `updated_at`.

Projection choice for an active record: ADMIN first, then SELF (the person's own linked employee), then TEAM (an active direct report of a Manager), otherwise DIRECTORY. A nonexistent record, or an inactive record requested by a non-Administrator, answers `404`.

**Dashboard answers**:

- ADMIN: `{"role":"ADMIN","total_employees": int,"active_employees": int,"inactive_employees": int}`
- MANAGER: `{"role":"MANAGER","direct_report_count": int,"department": string,"job_title": string}`
- EMPLOYEE: `{"role":"EMPLOYEE","department": string,"job_title": string,"is_active": boolean}`

**List rules**: `page` defaults to 1; `page_size` defaults to 25, range 1–100; `q` max 100 characters, case-insensitive match on full name or work email with LIKE wildcards escaped; sort by full name then id. `include_inactive=true` is ADMIN-only and `team_only=true` is MANAGER-only (the manager comes from the session); a prohibited filter answers `403`. Scope is applied before counting and paging.

**Create body** (all required except `manager_id` and `phone`):

```json
{
  "full_name": "Avery Stone",
  "work_email": "avery.stone@demo.test",
  "job_title": "Software Engineer",
  "department": "Engineering",
  "employment_type": "FULL_TIME",
  "date_of_joining": "2026-10-01",
  "manager_id": 2,
  "phone": null
}
```

**Edit body**: any of the create fields plus `"version": int`. `null` clears `manager_id` or `phone`; omitted fields stay unchanged. `is_active` is rejected with `422`. An inactive employee cannot be edited (`409`).

**Deactivate**: rejected with `409` when the employee is linked to an ADMIN account or has active direct reports. On success, in one transaction: set `is_active = 0`, increment `version`, delete the linked user's sessions.

**Anonymise** (the same `POST /api/employees/{id}/deactivate` operation, with `"anonymise": true` in the body): in one transaction, set `full_name = 'Anonymised employee'`, `work_email = 'anonymised-<id>@demo.test'`, `phone = NULL`, `is_active = 0`, increment `version`, delete the linked user's sessions. Rejected with `409` under the same blocks as deactivation or a stale version.

**Self-phone update**: body `{"phone": "+1 202 555 0100", "version": 1}`; `phone` may be `null`; any other field answers `422`. Success increments `version`.

## Error Handling

- `401` on any request: the API helper clears the signed-in state and the app opens `/login`.
- `403`: the page shows a safe inline notice; the person stays where they are.
- `404` on a detail page: "Employee unavailable" with a link back to `/employees`.
- `409` stale version: the modal or profile shows "This record changed since you opened it. Reload to see the latest values." with a Reload button.
- `409` blocked deactivation or anonymisation: the dialog stays open with the message the requirement names.
- `422`: field errors are shown beside the matching fields; the form keeps its entered values.
- `503` (database lock timeout): "The service is temporarily unavailable. Try again." shown without crashing React.
- Any unexpected failure: an error notice with a Retry button; loading, empty and no-results states are shown where the requirements name them.
- Authentication and employee-data answers carry `Cache-Control: no-store`. Credentials, cookies and password hashes are never logged or returned.

## Look and feel

A light, restrained enterprise style: white surfaces on a pale slate background, thin borders, subtle shadows, generous whitespace, no gradients behind data and no decorative animation.

**Colours** (CSS variables in `frontend/src/styles.css`):

| Token | Value |
|---|---|
| `--bg` page background | `#F8FAFC` |
| `--surface` | `#FFFFFF` |
| `--text` primary text | `#0F172A` |
| `--text-muted` secondary text | `#475569` |
| `--primary` primary action | `#4338CA` (white label) |
| `--primary-hover` | `#3730A3` |
| `--border` | `#E2E8F0` |
| `--danger` destructive action | `#B91C1C` |
| `--success` | `#15803D` |
| `--error` | `#B91C1C` |
| `--focus` focus ring | `#4338CA` |

**Font**: IBM Plex Sans only, self-hosted WOFF2 faces for weights 400, 500 and 600 in `frontend/public/fonts/` with their license, registered with `@font-face` and `font-display: block`, applied to every element including controls, dialogs and errors. Faces are loaded through the Font Loading API before the app renders text; if loading fails, the app shows a non-text retry control with an accessible label instead of rendering in another font. No other font family is declared.

**Spacing**: 4, 8, 12, 16, 24, 32 px. **Corners**: 10 px cards, 8 px fields and buttons. **Type scale**: page title 28/36 px, section title 20/28, body 14/20, helper text 12/18. **Weights**: 400, 500, 600 only.

**Controls**:

- Buttons: 40–44 px high, 8 px corners, 500 weight label. Primary is `--primary` with a white label; secondary is a white surface with a `--border` border and `--text` label; destructive is `--danger` with a white label. Hover darkens the fill; focus shows a 2 px `--focus` outline with a 2 px offset; pressed darkens further; disabled is 50% opacity with no pointer cursor.
- Fields: 40–44 px high, white surface, 1 px `--border`, 8 px corners, persistent label above, helper text below in `--text-muted`. Focus shows a 2 px `--focus` border and outline; hover darkens the border; disabled is a `#F1F5F9` fill; an invalid field shows a 1 px `--error` border and a text error below.
- Lists and tables: header row in `--text-muted` at 12 px uppercase, rows separated by 1 px `--border`, row hover `#F8FAFC`, the whole table scrolls inside its own container.
- Cards: white surface, 1 px `--border`, 10 px corners, a subtle shadow, 24 px padding.
- Modals: white surface, 10 px corners, a dimmed backdrop, focus moved inside, Escape closes, focus returns to the trigger.

**Signed-in shell**: a 220 px sidebar with Dashboard, Employees and My Profile, and a top bar with the account name, the role and Logout. Below 768 px the sidebar becomes a compact top navigation and cards stack in one column; the page never scrolls sideways.

**Login** — phone: one column, a centered card filling the width minus 24 px margins, wordmark, "Welcome back" heading, email and password fields, Show/Hide control, full-width Sign in button, and the local-demo account note below the card. Desktop: a 400 px centered card on the slate background.

**Dashboard** — phone: greeting and subtitle, then up to three cards stacked in one column, then the navigation action as a full-width button. Desktop: greeting and subtitle, three cards in one row, the navigation action at the end of the row.

**Employees** — phone: title, Add employee button (Administrator), search box, filter checkboxes, then the table scrolling inside its container with the name column first, and pagination below. Desktop: title and Add employee button on one row, search and filters on the next, the full table, pagination at the bottom. The Add/Edit modal is a full-height sheet on a phone and a centered 560 px dialog on a desktop.

**Employee details** — phone: Back to employees link, name, job title and department header, then the information card with label and value rows stacked. Desktop: the same header with the Edit action on the right, and the information card in a two-column label/value grid.

**My Profile** — phone: profile header, read-only employment details stacked, then the Phone field and a full-width Save changes button. Desktop: profile header, a two-column read-only details card, and the Phone field with Save changes in a card of its own.

## Build and run
Install: npm install && pip install -r backend/requirements.txt
Test: npm test && python -m pytest backend/tests
Run locally: yes
Dev: npm run dev
Port variable: PORT
Health path: /api/health
Devices: both
Deploy: none

`npm run dev` starts the FastAPI server on `127.0.0.1` at `API_PORT` (default `8000`) and the Vite dev server on `127.0.0.1` at `PORT`, which proxies `/api` to the API. `npm test` runs the frontend unit tests once and exits; `python -m pytest backend/tests` runs the API tests, each starting its own temporary SQLite database.

## Test logins

| Role | User name | Password |
|---|---|---|
| Administrator | `admin@demo.test` | `DemoOnly-Admin-2026!` |
| Manager | `manager@demo.test` | `DemoOnly-Manager-2026!` |
| Employee | `employee@demo.test` | `DemoOnly-Employee-2026!` |

## Testing Strategy

- **API tests** (`backend/tests/test_api.py`, pytest with FastAPI `TestClient`): one successful login per role, anonymous access `401`, unauthorized employee mutation `403`, CSRF rejection `403`, self-phone allowlist `422`, private-field projections, stale version `409`, deactivation and anonymisation protection, inactive-user rejection, duplicate email `409`, manager cycle `422`. Each test starts its own temporary SQLite file, creates the schema and seeds it, and removes it at the end.
- **Frontend tests** (Vitest with React Testing Library): the API helper's CSRF and `401` handling, the login form validation, the directory search and pagination state, the employee form validation and stale-version message, and the profile phone save.
- **Browser journeys** (Playwright, `e2e/`): sign in as each role, browse and search the directory, add, edit, deactivate and anonymise an employee as the Administrator, and update the phone number on My Profile. These run only through `run_journeys` against the running app.

## Assumptions

- The app opens at `/` and redirects to `/login`; a signed-in person who opens `/` goes to `/dashboard`.
- The Vite dev server listens on `127.0.0.1` and the API on `127.0.0.1` at `API_PORT`, default `8000`; the allowed origin is the Vite origin on that port.
- The three seeded accounts are the only logins, and the demo passwords are the ones the document lists.
- The Administrator's own record cannot be deactivated or anonymised, because it is linked to an Administrator account.
- Anonymising a record replaces only the name, work email and phone; the job title, department, employment type, joining date and manager stay as they are.
- Employee records are kept for 7 years after someone leaves; the app has no automatic deletion.
- The app is used on both phones and computers.
- The app runs locally only and is not deployed.
