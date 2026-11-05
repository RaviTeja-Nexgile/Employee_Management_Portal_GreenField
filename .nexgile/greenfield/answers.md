# Requirements brief — Employee Management System
## Profile
A small employee management demo app for administrators, managers and employees to log in, browse a directory, manage employee records and update their own phone number. · internal tool · HR / employee management · size: small · depth: short · personalData
- **Has a user interface?** Yes (The document specifies five React page routes with a shared shell, tables and forms.)
- **Runs locally?** Yes (A React frontend and FastAPI server with a local SQLite file, started on the person's machine.)
## The app
A small internal employee management demo where administrators, managers and employees sign in to browse a directory, administrators add, edit and deactivate employee records, and everyone can update their own phone number. It runs locally on React, FastAPI and SQLite with three seeded accounts and synthetic data, and deliberately leaves out registration, payroll, notifications and other production features.
## Ruled out by the person
- OUT1 registration: "Do not build registration" (documents) [no requirement, design, task or code for it]
- OUT2 password reset: "password reset" (documents) [no requirement, design, task or code for it]
- OUT3 invitation email: "invitation email" (documents) [no requirement, design, task or code for it]
- OUT4 MFA: "MFA" (documents) [no requirement, design, task or code for it]
- OUT5 SSO: "SSO" (documents) [no requirement, design, task or code for it]
- OUT6 role-management screens: "role-management screens" (documents) [no requirement, design, task or code for it]
- OUT7 department-management screens: "department-management screens" (documents) [no requirement, design, task or code for it]
- OUT8 payroll: "payroll" (documents) [no requirement, design, task or code for it]
- OUT9 attendance: "attendance" (documents) [no requirement, design, task or code for it]
- OUT10 leave requests: "leave requests" (documents) [no requirement, design, task or code for it]
- OUT11 recruitment: "recruitment" (documents) [no requirement, design, task or code for it]
- OUT12 file uploads: "file uploads" (documents) [no requirement, design, task or code for it]
- OUT13 chat: "chat" (documents) [no requirement, design, task or code for it]
- OUT14 AI: "AI" (documents) [no requirement, design, task or code for it]
- OUT15 notifications: "notifications" (documents) [no requirement, design, task or code for it]
- OUT16 charts: "charts" (documents) [no requirement, design, task or code for it]
- OUT17 CSV import/export: "CSV import/export" (documents) [no requirement, design, task or code for it]
- OUT18 audit-log infrastructure: "audit-log infrastructure" (documents) [no requirement, design, task or code for it]
- OUT19 Docker/Kubernetes deployment: "Docker/Kubernetes deployment" (documents) [no requirement, design, task or code for it]
- OUT20 a large design-system project: "a large design-system project" (documents) [no requirement, design, task or code for it]
## Goals and success
- G1 Build a small, working employee management demo with a real React frontend, Python API and persistent SQLite database that works end to end: logging in, viewing authorized data, adding and editing employees as an administrator, and updating one's own phone number. (doc:Employee_Management_MVP_Development_Spec 1.md)
- G2 Keep the application small: five page routes, three fixed roles, three database tables and eleven API operations. (doc:Employee_Management_MVP_Development_Spec 1.md)
## Roles
- R1 Administrator (one seeded account) (doc:Employee_Management_MVP_Development_Spec 1.md)
- R2 Manager (one seeded account) (doc:Employee_Management_MVP_Development_Spec 1.md)
- R3 Employee (one seeded account) (doc:Employee_Management_MVP_Development_Spec 1.md)
## Permissions
- R3 Employee may update own phone number; may not update own job title, update own department (Q2)
- R2 Manager may update own phone number (Q2)
- R1 Administrator may update own phone number (Q2)
## Workflows
### W1 Sign in (release 1) — actors: R1 Administrator, R2 Manager, R3 Employee; trigger: a person opens the login page; outcome: the person is signed in and sees their role's dashboard; how often: each time a person uses the app (doc:Employee_Management_MVP_Development_Spec 1.md)
1. Enter email and password
2. The app checks the credentials and that the linked employee is active
3. The app creates a session and returns the user and a CSRF token
4. The app navigates to the dashboard
- wrong credentials
- inactive account
### W2 Browse the employee directory (release 1) — actors: R1 Administrator, R2 Manager, R3 Employee; trigger: a signed-in person opens the Employees page; outcome: the person sees the directory fields they are allowed to see; how often: daily (doc:Employee_Management_MVP_Development_Spec 1.md)
1. The app shows active employees in a table
2. The person searches by name or email
3. The person pages through results
4. The person opens an employee's detail page
- no search results
- server error
### W3 Add an employee (release 1) — actors: R1 Administrator; trigger: the administrator clicks Add employee; outcome: a new active employee record exists; how often: occasionally (doc:Employee_Management_MVP_Development_Spec 1.md)
1. The app opens the employee form
2. The administrator fills in name, work email, job title, department, employment type, joining date, optional manager and optional phone
3. The app validates the fields and the manager chain
4. The app saves the employee as active
5. The app refreshes the list
- duplicate email
- invalid manager or cycle
- validation error
### W4 Edit an employee (release 1) — actors: R1 Administrator; trigger: the administrator clicks Edit on an active employee; outcome: the employee record is updated; how often: occasionally (doc:Employee_Management_MVP_Development_Spec 1.md)
1. The app loads the authorized record and its version
2. The administrator changes allowed fields
3. The app checks the version and validates the fields
4. The app saves and increments the version
5. The app refreshes the record
- stale version
- validation error
- inactive employee
### W5 Deactivate an employee (release 1) — actors: R1 Administrator; trigger: the administrator clicks Deactivate on an active employee; outcome: the employee is inactive and cannot sign in; how often: occasionally (doc:Employee_Management_MVP_Development_Spec 1.md)
1. The app shows a confirmation with the employee name and the effect on access
2. The administrator confirms
3. The app checks the employee is not linked to an admin account and has no active direct reports
4. The app sets the employee inactive, increments the version and deletes the linked user's sessions
- employee linked to an admin account
- employee has active direct reports
- stale version
### W6 Update own phone number (release 1) — actors: R1 Administrator, R2 Manager, R3 Employee; trigger: a signed-in person opens My Profile; outcome: the person's phone number is updated; how often: rarely (doc:Employee_Management_MVP_Development_Spec 1.md)
1. The app shows the person's own record
2. The person edits the phone field
3. The app checks the version and saves only the phone
4. The app shows the updated record
- stale version
- validation error
## Records
- E1 Employee. fields: id, employee_code, full_name, work_email, job_title, department, employment_type, date_of_joining, manager_id, phone, is_active, version, created_at, updated_at; states: active → inactive; owner: Administrator; how many: about six seeded employees (doc:Employee_Management_MVP_Development_Spec 1.md)
- E2 User account. fields: id, email, password_hash, role, employee_id; states: active; owner: Administrator; how many: three seeded accounts (doc:Employee_Management_MVP_Development_Spec 1.md)
- E3 Session. fields: id, token_hash, csrf_token, user_id, created_at, expires_at; states: active → expired → revoked; owner: the app; how many: one per signed-in user; kept for: eight hours (doc:Employee_Management_MVP_Development_Spec 1.md)
## Rules
- BR1 A manager sees a record as a direct report only when the record's manager_id equals the manager's linked employee_id and the record is active.. Applies: An active employee whose manager_id is the manager's employee_id is in the manager's team.. Does not apply: An employee in the same department but with a different manager_id is not in the manager's team. (doc:Employee_Management_MVP_Development_Spec 1.md)
- BR2 Deactivation is blocked for any employee linked to an ADMIN account or any employee with active direct reports.. Applies: An employee with an active direct report cannot be deactivated until the report is reassigned.. Does not apply: An employee with no direct reports and no admin login can be deactivated. (doc:Employee_Management_MVP_Development_Spec 1.md)
- BR3 A manager must exist, be active, differ from the employee and not create a reporting cycle.. Applies: Choosing a manager who is already below the employee in the reporting chain is rejected.. Does not apply: Choosing an active employee outside the chain is accepted. (doc:Employee_Management_MVP_Development_Spec 1.md)
- BR4 Edits, deactivation and self-phone updates require the loaded version; a stale version returns 409 and the person must reload.. Applies: Saving with an old version is rejected with 409.. Does not apply: Saving with the current version succeeds and increments the version. (doc:Employee_Management_MVP_Development_Spec 1.md)
- BR5 Only the three seeded accounts can log in; creating an employee record does not create a login account.. Applies: A new employee record has no login until an account is seeded separately.. Does not apply: The three seeded accounts can sign in. (doc:Employee_Management_MVP_Development_Spec 1.md)
- BR6 When an employee asks for their personal data to be deleted, an administrator anonymises the record.. Applies: An employee asks for their data to be deleted: an administrator anonymises the record.. Does not apply: No deletion request: the record stays as it is. (Q7)
## Scope and constraints
- S1 Dedicated login page and server-managed authentication. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S2 Administrator, Manager and Employee roles, enforced by the backend. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S3 Small role-aware dashboard. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S4 Searchable employee directory with pagination. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S5 Administrator-only employee creation, editing and deactivation. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S6 Employee detail page with role-specific field visibility. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S7 My Profile page with phone-number editing only. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S8 Three demonstration login accounts and a handful of synthetic employees. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S9 Responsive layout, useful validation, and loading/empty/error states. (doc:Employee_Management_MVP_Development_Spec 1.md)
- S11 Stack: React + TypeScript + Vite frontend, Python 3.12+ FastAPI backend, SQLite through Python sqlite3. [constraint] (doc:Employee_Management_MVP_Development_Spec 1.md)
- S12 IBM Plex Sans must be used exclusively for all text throughout the frontend application; no other fonts. [constraint] (doc:Employee_Management_MVP_Development_Spec 1.md)
- S13 Local demonstration software using synthetic data; do not expose it publicly or load real sensitive personnel data. [constraint] (doc:Employee_Management_MVP_Development_Spec 1.md)
- S14 Exactly three database tables: employees, users, sessions. [constraint] (doc:Employee_Management_MVP_Development_Spec 1.md)
- S15 Exactly five page routes: /login, /dashboard, /employees, /employees/:id, /my-profile. [constraint] (doc:Employee_Management_MVP_Development_Spec 1.md)
- S16 Exactly eleven API operations under /api. [constraint] (doc:Employee_Management_MVP_Development_Spec 1.md)
## Decisions
- **Stack:** React, FastAPI and SQLite (as the user's description or documents say, Employee_Management_MVP_Development_Spec 1.md: "Stack: React + Python/FastAPI + SQLite") (Q1)
- **Deploy target:** No deploy for now (as the user's description or documents say, documents: "Docker/Kubernetes deployment") (Q4)
## Assumptions
- A1 The app stores the employee fields already listed and the account email and password hash, and no other personal data. — The records already define exactly these fields, and the app is a local demo with synthetic data.; high impact [assumed] (assumption, Q5)
- A2 The app is used only in the United States, so US privacy law applies. — The demo uses synthetic data and the documents name no other country. [assumed] (assumption, doc:Employee_Management_MVP_Development_Spec 1.md)
- A3 No consent step is built: the app holds only synthetic demo data and the three seeded accounts. — The app is a local demonstration with synthetic data, not a production HR system. [assumed] (assumption, doc:Employee_Management_MVP_Development_Spec 1.md)
- A4 An employee record moves from active to inactive only through the administrator's Deactivate action; no other state exists. — The records already define active and inactive, and deactivation is the only state change the workflows describe. [assumed] (assumption, doc:Employee_Management_MVP_Development_Spec 1.md)
- A5 A user account stays active for as long as its linked employee is active; deactivation ends its sessions and blocks sign-in. — The sign-in workflow checks that the linked employee is active, and deactivation ends sessions. [assumed] (assumption, doc:Employee_Management_MVP_Development_Spec 1.md)
- A6 A session moves from active to expired after eight hours, or to revoked when the linked employee is deactivated. — Sessions expire after eight hours and deactivation deletes the linked user's sessions. [assumed] (assumption, doc:Employee_Management_MVP_Development_Spec 1.md)
## Other facts
- F1 The app is a local demonstration using synthetic data, not a production HR system. [scope] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F2 Three seeded login accounts: admin@demo.test, manager@demo.test, employee@demo.test, each with a documented demo password. [stakeholders] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F3 Sessions expire after eight hours; there is no refresh-token or idle-timeout subsystem. [security] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F4 The app uses a same-origin /api request path; Vite proxies /api to FastAPI on 127.0.0.1:8000 during development. [integrations] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F5 No external service is required. [integrations] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F6 The interface should have the restrained, modern, elegant appearance associated with Fortune 500 enterprise applications. [scope] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F7 Build target is approximately 15–20 minutes of coding-agent work, a scope target, not a delivery guarantee. [scope] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F8 The document is cut at Section 11; the rest of the acceptance checklist is not yet given. [scope] (doc:Employee_Management_MVP_Development_Spec 1.md)
- F9 An employee may change only their phone number; no other field is self-editable. [permissions] (Q2)
- F10 Deactivating an employee ends their sessions and prevents them from signing in. [rules] (Q3)
- F11 Employee personal data is kept for 7 years after someone leaves. (Q6)
## Out of scope and later releases
- S10 Registration, password reset, invitation email, MFA, SSO, role-management screens, department-management screens, payroll, attendance, leave requests, recruitment, file uploads, chat, AI, notifications, charts, CSV import/export, audit-log infrastructure, Docker/Kubernetes deployment, and a large design-system project. [out of scope] (doc:Employee_Management_MVP_Development_Spec 1.md)
- People: not relevant, the user's description or documents say so [out of scope]
- Scope and constraints: not relevant, the user's description or documents say so [out of scope]
- Workflows: not relevant, the user's description or documents say so [out of scope]
- Reports: not relevant, the user's description or documents say so [out of scope]
- Administration: not relevant, the user's description or documents say so [out of scope]
- Security and sign-in: not relevant, the user's description or documents say so [out of scope]
- Hosting and deployment: not relevant, the user's description or documents say so [out of scope]
## The interview
- Q2 [permissions · owner] Should an employee be able to change anything besides their phone number? → No, only the phone number
- Q3 [rules · owner] When an administrator deactivates an employee, what should happen to that person's access? → Their sessions end and they cannot sign in
- Q5 [privacy · security] What personal information about employees does the app need to store? → Decide for me (settled: The app stores the employee fields already listed and the account email and password hash, and no other personal data.)
- Q6 [privacy · security] How long should employee records be kept after someone leaves? → Keep for 7 years
- Q7 [privacy · security] If an employee asks for their personal data to be deleted, what should happen? → An administrator anonymises the record
