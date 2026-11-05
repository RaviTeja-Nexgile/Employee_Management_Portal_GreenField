# Requirements: Employee Management System

## Requirement 1: Sign in

**User Story:** As an Administrator, a Manager or an Employee, I want to sign in with my demo account, so that I see the dashboard for my role.

_Source: W1, R1, R2, R3, S1, F2_

### Acceptance Criteria

1. WHEN a person opens `/` THE SYSTEM SHALL show the Login page at `/login` with a centered card holding the email field, the password field, a Show/Hide password control and a full-width Sign in button, and no sign-up link, role selector or password-reset link.
2. WHEN a person submits the Login form with an empty email or an empty password THE SYSTEM SHALL show a text error beside each empty field and send no request.
3. WHEN a person submits the email `admin@demo.test` and the password `DemoOnly-Admin-2026!` THE SYSTEM SHALL sign them in and open the Dashboard at `/dashboard`.
4. WHEN a person submits the email `manager@demo.test` and the password `DemoOnly-Manager-2026!` THE SYSTEM SHALL sign them in and open the Dashboard at `/dashboard`.
5. WHEN a person submits the email `employee@demo.test` and the password `DemoOnly-Employee-2026!` THE SYSTEM SHALL sign them in and open the Dashboard at `/dashboard`.
6. IF the email is unknown, the password is wrong, or the linked employee is inactive THEN THE SYSTEM SHALL show the message "Email or password is incorrect." and stay on the Login page.
7. WHILE a person is signed in, WHEN they open `/login` THE SYSTEM SHALL redirect them to `/dashboard`.
8. WHEN a signed-in person clicks Logout in the top bar THE SYSTEM SHALL end their session, clear the signed-in state and open the Login page at `/login`.
9. WHILE a person is signed in, WHEN they reload the page THE SYSTEM SHALL restore their session and show the same screen.
10. WHEN a person clicks Sign in THE SYSTEM SHALL disable the Sign in button until the answer arrives and show a submitting indicator.

## Requirement 2: Dashboard

**User Story:** As an Administrator, a Manager or an Employee, I want a dashboard for my role, so that I see the figures and the next step that matter to me.

_Source: S3, S2, F6_

### Acceptance Criteria

1. WHEN an Administrator opens `/dashboard` THE SYSTEM SHALL show the greeting, a subtitle, three summary cards with the total records, the active records and the inactive records, and an Open Employees action that opens `/employees`.
2. WHEN a Manager opens `/dashboard` THE SYSTEM SHALL show the greeting, a subtitle, cards with the active direct-report count, their own department and their own job title, and an Open my direct reports action that opens `/employees?team_only=true`.
3. WHEN an Employee opens `/dashboard` THE SYSTEM SHALL show the greeting, a subtitle, cards with their own department, their own job title and their Active status, and an Open My Profile action that opens `/my-profile`.
4. WHILE the dashboard figures load THE SYSTEM SHALL show skeleton placeholders in place of the cards.
5. IF the dashboard request fails THEN THE SYSTEM SHALL show an error notice with a Retry button that sends the request again.
6. WHEN a Manager or an Employee opens `/dashboard` THE SYSTEM SHALL show no company-wide total of employees.

## Requirement 3: Employees directory

**User Story:** As an Administrator, a Manager or an Employee, I want to search the employee directory, so that I find the colleague I am looking for.

_Source: W2, S4, S6, BR1_

### Acceptance Criteria

1. WHEN a signed-in person opens `/employees` THE SYSTEM SHALL show the title, the search box, a table with the columns Name, Employee code, Work email, Job title and Department, and pagination, with 25 rows per page.
2. WHEN a signed-in person types in the search box THE SYSTEM SHALL filter the table by full name or work email, ignoring case, about 250 ms after the last keystroke, and reset the table to page 1.
3. WHEN a signed-in person clicks a page number THE SYSTEM SHALL show that page of results and keep the search text, the filters and the page in the address.
4. WHEN a signed-in person clicks an employee's name THE SYSTEM SHALL open that employee's detail page at `/employees/:id`.
5. IF the search matches no employee THEN THE SYSTEM SHALL show an empty state with a Clear search button and no error.
6. WHILE a person is signed in as an Administrator THE SYSTEM SHALL show the Add employee button, the Include inactive checkbox, the Status column and a row action menu, and WHEN the Include inactive checkbox is ticked THE SYSTEM SHALL list inactive employees as well.
7. WHILE a person is signed in as a Manager THE SYSTEM SHALL show the My direct reports checkbox, and WHEN it is ticked THE SYSTEM SHALL list only active employees whose manager is the Manager.
8. WHILE a person is signed in as a Manager or an Employee THE SYSTEM SHALL list only active employees and show no Add employee button, no Include inactive checkbox and no row actions.
9. IF the directory request fails THEN THE SYSTEM SHALL show an error notice with a Retry button.
10. WHILE the directory loads THE SYSTEM SHALL show a loading placeholder in place of the table rows.

## Requirement 4: Add and edit an employee

**User Story:** As an Administrator, I want to add and edit employee records, so that the directory stays current.

_Source: W3, W4, S5, BR3, BR4, BR5_

### Acceptance Criteria

1. WHEN an Administrator clicks Add employee THE SYSTEM SHALL open a modal with the fields Full name, Work email, Job title, Department, Employment type, Joining date, Manager and Phone, and the buttons Save and Cancel.
2. WHEN an Administrator fills in a valid form and clicks Save THE SYSTEM SHALL create the employee as active, close the modal, show a success message and refresh the directory.
3. IF the work email already belongs to another employee THEN THE SYSTEM SHALL keep the modal open and show the error "This work email is already in use." beside the Work email field.
4. IF a required field is empty or invalid THEN THE SYSTEM SHALL keep the modal open, show a text error beside each such field and send no request.
5. IF the chosen Manager is the employee, is inactive, or is below the employee in the reporting chain THEN THE SYSTEM SHALL keep the modal open and show the error "Choose a manager who is active and not below this employee." beside the Manager field.
6. WHEN an Administrator clicks Edit on an active employee THE SYSTEM SHALL open the same modal filled with that employee's current values and its version.
7. WHEN an Administrator saves an edit with the current version THE SYSTEM SHALL update the record, increment its version, close the modal, show a success message and refresh the record.
8. IF an Administrator saves with a version older than the stored one THEN THE SYSTEM SHALL keep the modal open and show the error "This record changed since you opened it. Reload to see the latest values." with a Reload button.
9. WHEN an Administrator clicks Cancel in a modal with unsaved changes THE SYSTEM SHALL ask for confirmation before discarding them.
10. WHEN an Administrator saves a new employee THE SYSTEM SHALL create no login account for that employee.

## Requirement 5: Deactivate or anonymise an employee

**User Story:** As an Administrator, I want to deactivate an employee who has left and anonymise the record of an employee who asks for their data to be deleted, so that access ends and personal data is removed while the record is kept.

_Source: W5, BR2, BR6, F10, A5_

### Acceptance Criteria

1. WHEN an Administrator clicks Deactivate on an active employee THE SYSTEM SHALL open an application-styled confirmation dialog naming the employee and stating that the person can no longer sign in.
2. WHEN the Administrator confirms THE SYSTEM SHALL set the employee inactive, increment the version, end that person's sessions, close the dialog, show a success message and refresh the directory.
3. IF the employee is linked to an Administrator account THEN THE SYSTEM SHALL keep the dialog open and show the error "An administrator account cannot be deactivated."
4. IF the employee has active direct reports THEN THE SYSTEM SHALL keep the dialog open and show the error "Reassign this employee's direct reports before deactivating."
5. IF the version sent with the confirmation is older than the stored one THEN THE SYSTEM SHALL keep the dialog open and show the error "This record changed since you opened it. Reload to see the latest values."
6. WHEN an Administrator opens the detail page of an inactive employee THE SYSTEM SHALL show the record read-only with no Edit or Deactivate action.
7. WHEN a deactivated person tries to sign in THE SYSTEM SHALL show "Email or password is incorrect." and keep them on the Login page.
8. WHEN an Administrator clicks Anonymise on an employee who asks for their personal data to be deleted THE SYSTEM SHALL open an application-styled confirmation dialog naming the employee and stating that their name, work email and phone will be replaced and the record kept.
9. WHEN the Administrator confirms THE SYSTEM SHALL replace the employee's full name with "Anonymised employee", the work email with `anonymised-<id>@demo.test` and the phone with an empty value, set the employee inactive, increment the version, end that person's sessions, close the dialog, show a success message and refresh the directory.
10. IF the employee is linked to an Administrator account, has active direct reports, or the version sent with the confirmation is older than the stored one THEN THE SYSTEM SHALL keep the dialog open, change no record and show the error "This record cannot be anonymised. Reload to see the latest values."

## Requirement 6: Employee details

**User Story:** As a signed-in person, I want to open an employee's details, so that I see the fields my role is allowed to see.

_Source: S6, BR1, S2_

### Acceptance Criteria

1. WHEN a signed-in person opens `/employees/:id` THE SYSTEM SHALL show a Back to employees link, the employee's name, job title and department, and an information card.
2. WHILE a person is signed in as an Employee or a Manager and the record is not their own or an active direct report THE SYSTEM SHALL show only the fields Name, Employee code, Work email, Job title and Department.
3. WHILE a person is signed in as a Manager and the record is their own or an active direct report THE SYSTEM SHALL also show the joining date, the employment type and the manager.
4. WHILE a person is signed in as an Employee and the record is their own THE SYSTEM SHALL also show the joining date, the employment type, the manager and the phone.
5. WHILE a person is signed in as an Administrator THE SYSTEM SHALL show every field of the record, including the phone, the active status, the version and the created and updated timestamps.
6. WHEN an Administrator opens the detail page of an active employee THE SYSTEM SHALL show an Edit action that opens the edit modal.
7. IF the record does not exist, or is inactive and the person is not an Administrator THEN THE SYSTEM SHALL show "Employee unavailable" with a link back to `/employees`.
8. IF the address holds an id that is not a number THEN THE SYSTEM SHALL show "Employee unavailable" and not crash the page.
9. WHILE the record loads THE SYSTEM SHALL show a loading placeholder, and IF the request fails THEN THE SYSTEM SHALL show an error notice with a Retry button.

## Requirement 7: My Profile

**User Story:** As a signed-in person, I want to update my own phone number, so that colleagues reach me on the right number.

_Source: W6, S7, F9, BR4_

### Acceptance Criteria

1. WHEN a signed-in person opens `/my-profile` THE SYSTEM SHALL show their own name, job title and department, their employment details as read-only text, one Phone field holding their current phone, and a Save changes button.
2. WHEN a person changes the Phone field and clicks Save changes THE SYSTEM SHALL save only the phone and the loaded version, increment the version, and show the updated phone with a success message.
3. WHEN a person clears the Phone field and clicks Save changes THE SYSTEM SHALL save the phone as empty.
4. IF the phone is longer than 30 characters THEN THE SYSTEM SHALL show a text error beside the Phone field and send no request.
5. IF the version sent with the save is older than the stored one THEN THE SYSTEM SHALL show the error "This record changed since you opened it. Reload to see the latest values." with a Reload button.
6. WHEN a person opens `/my-profile` THE SYSTEM SHALL show no editable field other than Phone.
7. WHEN a person clicks Save changes THE SYSTEM SHALL disable the button until the answer arrives.

## Requirement 8: Access control and sessions

**User Story:** As the owner of the demo, I want the server to enforce every role rule, so that no one reaches data or actions their role does not allow.

_Source: S2, BR1, BR2, BR4, BR5, F3, F4_

### Acceptance Criteria

1. IF a request to a protected `/api` operation arrives without a valid session THEN THE SYSTEM SHALL answer `401` and the app SHALL return to the Login page.
2. IF a signed-in Manager or Employee sends a create, edit or deactivate request for an employee THEN THE SYSTEM SHALL answer `403` and change no record.
3. IF a signed-in person sends a request without the CSRF token of their session, or with a different one THEN THE SYSTEM SHALL answer `403` and change no record.
4. IF a signed-in person sends a request whose body holds a role, an employee id or an active status they may not set THEN THE SYSTEM SHALL answer `422` and change no record.
5. WHEN a session is eight hours old THE SYSTEM SHALL treat it as expired and answer `401` to its requests.
6. WHEN the server answers a directory or detail request THE SYSTEM SHALL include only the fields the person's role may see, and never the phone, the joining date or the employment type in a directory list.
7. WHEN the app receives `401` on any request THE SYSTEM SHALL clear the signed-in state and open the Login page.
8. IF the server cannot reach the database in time THEN THE SYSTEM SHALL answer `503` with the error message "The service is temporarily unavailable. Try again." and the app SHALL show that message without crashing.

## Requirement 9: Look and feel

**User Story:** As a person using the demo, I want a restrained, modern interface, so that the app looks like a finished enterprise tool.

_Source: S9, S12, F6, S13_

### Acceptance Criteria

1. WHEN any screen of the app renders THE SYSTEM SHALL render all of its text in IBM Plex Sans, with no other font family loaded or applied.
2. WHEN any screen renders THE SYSTEM SHALL use the page background `#F8FAFC`, white surfaces, the primary text `#0F172A`, the primary action `#4338CA` and the destructive action `#B91C1C`.
3. WHILE a person is signed in THE SYSTEM SHALL show a 220 px sidebar with Dashboard, Employees and My Profile and a top bar with the account name, the role and Logout.
4. WHILE the window is narrower than 768 px THE SYSTEM SHALL replace the sidebar with a compact top navigation, stack the cards in one column and keep the page from scrolling sideways.
5. WHEN a person moves focus to a button or a field with the keyboard THE SYSTEM SHALL show a visible focus outline on it.
6. WHEN a modal is open THE SYSTEM SHALL move focus into it, close it on Escape and return focus to the button that opened it.
7. WHEN a person opens an address that is not one of the five routes THE SYSTEM SHALL show a Not found view inside the signed-in shell.

## Later releases

- OUT1 registration
- OUT2 password reset
- OUT3 invitation email
- OUT4 MFA
- OUT5 SSO
- OUT6 role-management screens
- OUT7 department-management screens
- OUT8 payroll
- OUT9 attendance
- OUT10 leave requests
- OUT11 recruitment
- OUT12 file uploads
- OUT13 chat
- OUT14 AI
- OUT15 notifications
- OUT16 charts
- OUT17 CSV import/export
- OUT18 audit-log infrastructure
- OUT19 Docker/Kubernetes deployment
- OUT20 a large design-system project

## Assumptions

- The app opens at `/` and redirects to `/login`; a signed-in person who opens `/` goes to `/dashboard`.
- The three seeded accounts are the only logins, and the demo passwords are the ones the document lists.
- The Administrator's own record cannot be deactivated, because it is linked to an Administrator account.
- Anonymising a record replaces only the name, work email and phone, the personal fields the app stores; the job title, department, employment type, joining date and manager stay as they are.
- Employee records are kept for 7 years after someone leaves; the app has no automatic deletion.
- The app is used on both phones and computers.
- The app runs locally only and is not deployed.
