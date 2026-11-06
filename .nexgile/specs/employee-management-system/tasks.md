# Tasks: Employee Management System

- [x] 1. Project setup
  - [x] 1.1 Project setup
    - Create the React + TypeScript + Vite frontend and the FastAPI backend skeleton, the shared stylesheet with the Look and feel colours and IBM Plex Sans faces, the SQLite schema for the three tables with the seed routine, the health path, the `pytest-playwright` runner with an `e2e/` folder holding a `.gitkeep` that the unit test runner leaves out, and one passing test.
    - Build every API operation of the design: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/dashboard`, `GET /api/employees`, `POST /api/employees`, `GET /api/employees/{id}`, `PATCH /api/employees/{id}`, `POST /api/employees/{id}/deactivate` (with `anonymise`), `GET /api/me/profile` and `PATCH /api/me/profile`, with the shared error shape, session cookie, CSRF and origin checks, role checks, projections, version checks and the seed data, and the pytest tests that call them.
    - `npm run dev` starts the API on `127.0.0.1` at `API_PORT` (default `8000`) and Vite on `127.0.0.1` at `PORT`, proxying `/api`; `Dev` seeds an empty database and leaves a seeded one as it is.
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.9, 2.1, 2.2, 2.3, 3.1, 3.2, 3.6, 3.7, 3.8, 4.2, 4.3, 4.5, 4.7, 4.8, 4.10, 5.2, 5.3, 5.4, 5.5, 5.7, 5.9, 5.10, 6.2, 6.3, 6.4, 6.5, 6.7, 7.2, 7.3, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
    - _Files: package.json, package-lock.json, vite.config.ts, tsconfig.json, tsconfig.node.json, index.html, README.md, .gitignore, .env.example, playwright.config.ts, e2e/.gitkeep, frontend/public/fonts/**, frontend/src/main.tsx, frontend/src/App.tsx, frontend/src/api.ts, frontend/src/auth.tsx, frontend/src/styles.css, frontend/src/components/**, frontend/src/test/setup.ts, frontend/src/api.test.ts, backend/main.py, backend/db.py, backend/auth.py, backend/schemas.py, backend/requirements.txt, backend/tests/conftest.py, backend/tests/test_api.py_
    - _Verify: npm test_
    - _Verify: python -m pytest backend/tests_
    - _Area: setup_
    - _Issue: #1_

- [x] 2. Login page
  - [x] 2.1 Login page
    - Build the Login page at `/login`: a centered card with the wordmark, the email and password fields, a Show/Hide password control and a full-width Sign in button, field errors for empty values, the "Email or password is incorrect." message, the submitting state, the redirect of a signed-in person to `/dashboard`, and the local-demo account note; style it for phone and desktop.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10_
    - _Depends: 1_
    - _Files: frontend/src/pages/Login.tsx, frontend/src/pages/Login.module.css, frontend/src/pages/Login.test.tsx_
    - _Verify: npm test -- Login_
    - _Area: ui_
    - _Issue: #2_

- [x] 3. Dashboard
  - [x] 3.1 Dashboard
    - Build the Dashboard at `/dashboard`: the greeting and subtitle, the Administrator's three summary cards and Open Employees action, the Manager's direct-report count, department and job title with Open my direct reports, the Employee's department, job title and Active status with Open My Profile, skeleton placeholders, and the error notice with Retry; style it for phone and desktop.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
    - _Depends: 1_
    - _Files: frontend/src/pages/Dashboard.tsx, frontend/src/pages/Dashboard.module.css, frontend/src/pages/Dashboard.test.tsx_
    - _Verify: npm test -- Dashboard_
    - _Area: ui_
    - _Issue: #3_

- [x] 4. Employees directory
  - [x] 4.1 Employees directory
    - Build the Employees page at `/employees`: the title, the search box with its 250 ms debounce, the table with Name, Employee code, Work email, Job title and Department, pagination of 25 rows with the search, filters and page kept in the address, the empty state with Clear search, the Administrator's Add employee button, Include inactive checkbox, Status column and row action menu, the Manager's My direct reports checkbox, the loading placeholder and the error notice with Retry; style it for phone and desktop.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_
    - _Depends: 1_
    - _Files: frontend/src/pages/Employees.tsx, frontend/src/pages/Employees.module.css, frontend/src/pages/Employees.test.tsx_
    - _Verify: npm test -- Employees_
    - _Area: ui_
    - _Issue: #4_

- [ ] 5. Employee details
  - [ ] 5.1 Employee details
    - Build the Employee details page at `/employees/:id`: the Back to employees link, the name, job title and department header, the information card with the fields each role may see, the Administrator's Edit action, the "Employee unavailable" view for a missing, inactive or non-numeric record, the loading placeholder and the error notice with Retry; style it for phone and desktop.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
    - _Depends: 1_
    - _Files: frontend/src/pages/EmployeeDetail.tsx, frontend/src/pages/EmployeeDetail.module.css, frontend/src/pages/EmployeeDetail.test.tsx_
    - _Verify: npm test -- EmployeeDetail_
    - _Area: ui_
    - _Issue: #5_

- [ ] 6. My Profile
  - [ ] 6.1 My Profile
    - Build the My Profile page at `/my-profile`: the name, job title and department, the read-only employment details, the single Phone field with its 30-character error, the Save changes button with its disabled state, the success message and the stale-version message with Reload; style it for phone and desktop.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
    - _Depends: 1_
    - _Files: frontend/src/pages/MyProfile.tsx, frontend/src/pages/MyProfile.module.css, frontend/src/pages/MyProfile.test.tsx_
    - _Verify: npm test -- MyProfile_
    - _Area: ui_
    - _Issue: #6_

- [ ] 7. Add, edit, deactivate and anonymise an employee
  - [ ] 7.1 Add, edit, deactivate and anonymise an employee
    - Build the Add/Edit employee modal with the eight fields, Save and Cancel, field errors, the duplicate-email error, the manager error, the stale-version message with Reload and the unsaved-changes confirmation, and the Deactivate and Anonymise confirmation dialogs with their blocked and stale messages, wired into the directory and the details page; style them for phone and desktop.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 5.10_
    - _Depends: 1, 4, 5_
    - _Files: frontend/src/components/EmployeeForm.tsx, frontend/src/components/EmployeeForm.module.css, frontend/src/components/ConfirmDialog.tsx, frontend/src/components/ConfirmDialog.module.css, frontend/src/components/EmployeeForm.test.tsx, frontend/src/components/ConfirmDialog.test.tsx_
    - _Verify: npm test -- EmployeeForm_
    - _Verify: npm test -- ConfirmDialog_
    - _Area: ui_
    - _Issue: #7_
