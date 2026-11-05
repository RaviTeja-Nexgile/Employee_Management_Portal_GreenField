# Employee Management System

A local demonstration of an employee management app for three fixed roles:
Administrator, Manager and Employee. People sign in with one of three seeded
demo accounts, browse a searchable employee directory, open an employee's
details with the fields their role may see, and update their own phone number.
An Administrator adds, edits, deactivates and anonymises employee records.

The app is a single-page React application served by Vite, talking to a
FastAPI server over same-origin `/api` requests, with data kept in one local
SQLite file. It runs locally only, on synthetic data, and is not deployed.

## Requirements

- Node.js 20 or newer
- Python 3.12 or newer

## Install

```
npm install
pip install -r backend/requirements.txt
```

## Run

```
npm run dev
```

`npm run dev` seeds an empty database with the demo accounts and employees,
starts the API on `127.0.0.1` at `API_PORT` (default `8000`), then starts the
Vite dev server on `127.0.0.1` at `PORT` (default `5173`), which proxies
`/api` to the API. A database that already holds the demo accounts is left as
it is.

Open `http://127.0.0.1:5173`.

## Test logins

| Role | User name | Password |
|---|---|---|
| Administrator | `admin@demo.test` | `DemoOnly-Admin-2026!` |
| Manager | `manager@demo.test` | `DemoOnly-Manager-2026!` |
| Employee | `employee@demo.test` | `DemoOnly-Employee-2026!` |

## Test

```
npm test
python -m pytest backend/tests
```

`npm test` runs the frontend unit tests once and exits. `python -m pytest
backend/tests` runs the API tests, each starting its own temporary SQLite
database.

Browser journeys live in `e2e/` and run with `npm run test:e2e` against a
running app.

## Configuration

Both ports come from the environment; see `.env.example`. The SQLite file is
`backend/data/employees.db` unless `EMS_DB_PATH` names another path. The
database file is created and seeded at first start and is not committed.

## Layout

- `frontend/` — React + TypeScript + Vite app (`src/`), self-hosted IBM Plex
  Sans faces in `public/fonts/`.
- `backend/` — FastAPI app (`main.py`), SQLite access and seed routine
  (`db.py`), sessions and projections (`auth.py`), request models
  (`schemas.py`), tests in `tests/`.
- `scripts/dev.mjs` — the `npm run dev` runner: seed, API, Vite.
