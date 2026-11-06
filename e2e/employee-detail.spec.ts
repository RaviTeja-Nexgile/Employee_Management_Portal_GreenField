import { test, expect } from "@playwright/test"

// The Employee details journeys. Each test covers one rule of requirement 6
// (6.1-6.9). The seeded demo logins come from design.md's "Test logins"; a
// journey reads them from its E2E_ variable with the seeded value as the
// fallback when the variable is unset.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@demo.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DemoOnly-Admin-2026!"
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? "manager@demo.test"
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD ?? "DemoOnly-Manager-2026!"
const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "employee@demo.test"
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "DemoOnly-Employee-2026!"

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// A fixed detail answer, so the journeys do not depend on the seed data.
function adminEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    employee_code: "EMP-0003",
    full_name: "Priya Raman",
    work_email: "priya.raman@demo.test",
    job_title: "Software Engineer",
    department: "Engineering",
    date_of_joining: "2022-06-01",
    employment_type: "FULL_TIME",
    manager_id: 2,
    phone: "+1 202 555 0100",
    version: 4,
    is_active: true,
    created_at: "2022-06-01T09:00:00Z",
    updated_at: "2026-01-02T10:30:00Z",
    ...overrides,
  }
}

const DIRECTORY_FIELDS = ["Name", "Employee code", "Work email", "Job title", "Department"]
const TEAM_FIELDS = ["Joining date", "Employment type", "Manager"]

async function fieldLabels(page: import("@playwright/test").Page): Promise<string[]> {
  return page.getByRole("term").allTextContents()
}

// Rule 6.1: the Back to employees link, the name, job title and department
// header, and an information card.
test("the detail page shows the back link, the header and the information card", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.route("**/api/employees/3", (route) =>
    route.fulfill({ json: { view_kind: "ADMIN", employee: adminEmployee() } }),
  )
  await page.goto("/employees/3")

  await expect(page.getByRole("link", { name: "Back to employees" })).toHaveAttribute("href", "/employees")
  await expect(page.getByRole("heading", { name: "Priya Raman", level: 1 })).toBeVisible()
  await expect(page.getByText("Software Engineer · Engineering")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Information", level: 2 })).toBeVisible()
})

// Rule 6.2: an Employee or Manager viewing a colleague sees only the five
// directory fields.
test("a colleague's record shows only the five directory fields", async ({ page }) => {
  await signIn(page, MANAGER_EMAIL, MANAGER_PASSWORD)
  await page.route("**/api/employees/6", (route) =>
    route.fulfill({
      json: {
        view_kind: "DIRECTORY",
        employee: adminEmployee({
          id: 6,
          employee_code: "EMP-0006",
          full_name: "Riley Chen",
          work_email: "riley.chen@demo.test",
          job_title: "Finance Analyst",
          department: "Finance",
        }),
      },
    }),
  )
  await page.goto("/employees/6")

  await expect(page.getByRole("heading", { name: "Riley Chen", level: 1 })).toBeVisible()
  expect(await fieldLabels(page)).toEqual(DIRECTORY_FIELDS)
  await expect(page.getByRole("term", { name: "Phone" })).toHaveCount(0)
  await expect(page.getByRole("term", { name: "Joining date" })).toHaveCount(0)
})

// Rule 6.3: a Manager viewing an active direct report also sees the joining
// date, the employment type and the manager.
test("a Manager sees the team fields for a direct report", async ({ page }) => {
  await signIn(page, MANAGER_EMAIL, MANAGER_PASSWORD)
  await page.route("**/api/employees/4", (route) =>
    route.fulfill({
      json: {
        view_kind: "TEAM",
        employee: adminEmployee({
          id: 4,
          employee_code: "EMP-0004",
          full_name: "Priya Patel",
          work_email: "priya.patel@demo.test",
        }),
      },
    }),
  )
  await page.goto("/employees/4")

  await expect(page.getByRole("heading", { name: "Priya Patel", level: 1 })).toBeVisible()
  expect(await fieldLabels(page)).toEqual([...DIRECTORY_FIELDS, ...TEAM_FIELDS])
  await expect(page.getByText("2022-06-01")).toBeVisible()
  await expect(page.getByText("Full time")).toBeVisible()
  await expect(page.getByText("EMP-0002")).toBeVisible()
  await expect(page.getByRole("term", { name: "Phone" })).toHaveCount(0)
})

// Rule 6.4: an Employee viewing their own record also sees the joining date,
// the employment type, the manager and the phone.
test("an Employee sees the team fields and the phone on their own record", async ({ page }) => {
  await signIn(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
  await page.route("**/api/employees/3", (route) =>
    route.fulfill({
      json: {
        view_kind: "SELF",
        employee: adminEmployee({ employment_type: "CONTRACT" }),
      },
    }),
  )
  await page.goto("/employees/3")

  await expect(page.getByRole("heading", { name: "Priya Raman", level: 1 })).toBeVisible()
  expect(await fieldLabels(page)).toEqual([...DIRECTORY_FIELDS, ...TEAM_FIELDS, "Phone"])
  await expect(page.getByText("+1 202 555 0100")).toBeVisible()
  await expect(page.getByText("Contract")).toBeVisible()
  await expect(page.getByRole("term", { name: "Active status" })).toHaveCount(0)
})

// Rule 6.5: an Administrator sees every field, including the phone, the active
// status, the version and the created and updated timestamps.
test("an Administrator sees every field of the record", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.route("**/api/employees/3", (route) =>
    route.fulfill({ json: { view_kind: "ADMIN", employee: adminEmployee() } }),
  )
  await page.goto("/employees/3")

  await expect(page.getByRole("heading", { name: "Priya Raman", level: 1 })).toBeVisible()
  expect(await fieldLabels(page)).toEqual([
    ...DIRECTORY_FIELDS,
    ...TEAM_FIELDS,
    "Phone",
    "Active status",
    "Version",
    "Created",
    "Updated",
  ])
  await expect(page.getByText("Active", { exact: true })).toBeVisible()
  await expect(page.getByText("4", { exact: true })).toBeVisible()
  await expect(page.getByText("2026-01-02 10:30:00 UTC")).toBeVisible()
})

// Rule 6.6: an Administrator's Edit action opens the edit modal.
test("an Administrator's Edit action opens the edit modal", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.route("**/api/employees/3", (route) =>
    route.fulfill({ json: { view_kind: "ADMIN", employee: adminEmployee() } }),
  )
  await page.goto("/employees/3")

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Edit" }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("heading", { name: "Edit employee" })).toBeVisible()
  await expect(dialog.getByRole("textbox", { name: "Full name" })).toHaveValue("Priya Raman")
  await expect(dialog.getByRole("button", { name: "Save" })).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Edit" })).toBeFocused()
})

// Rule 6.7: a missing record, or an inactive record for a non-Administrator,
// shows "Employee unavailable" with a link back to /employees.
test("a missing record shows Employee unavailable with a link back", async ({ page }) => {
  await signIn(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
  await page.route("**/api/employees/9999", (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: "not_found", message: "Not found." } },
    }),
  )
  await page.goto("/employees/9999")

  await expect(page.getByRole("heading", { name: "Employee unavailable", level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Back to employees" })).toHaveAttribute("href", "/employees")
})

test("an inactive record shows Employee unavailable to a non-Administrator", async ({ page }) => {
  await signIn(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
  await page.route("**/api/employees/7", (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: "not_found", message: "Not found." } },
    }),
  )
  await page.goto("/employees/7")

  await expect(page.getByRole("heading", { name: "Employee unavailable", level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Back to employees" })).toHaveAttribute("href", "/employees")
})

// Rule 6.8: an id that is not a number shows "Employee unavailable" and does
// not crash the page.
test("an id that is not a number shows Employee unavailable without a request", async ({ page }) => {
  await signIn(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)

  const requests: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/api/employees/")) requests.push(request.url())
  })

  await page.goto("/employees/abc")

  await expect(page.getByRole("heading", { name: "Employee unavailable", level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Back to employees" })).toHaveAttribute("href", "/employees")
  expect(requests).toEqual([])
})

// Rule 6.9: a loading placeholder while the record loads, and an error notice
// with a Retry button that loads the record again.
test("a failed request shows an error notice with Retry that recovers", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  let fail = true
  await page.route("**/api/employees/3", (route) => {
    if (fail) {
      return route.fulfill({
        status: 503,
        json: { error: { code: "unavailable", message: "The service is temporarily unavailable. Try again." } },
      })
    }
    return route.fulfill({ json: { view_kind: "ADMIN", employee: adminEmployee() } })
  })

  await page.goto("/employees/3")

  const alert = page.getByRole("alert")
  await expect(alert).toContainText("The service is temporarily unavailable. Try again.")

  fail = false
  await alert.getByRole("button", { name: "Retry" }).click()

  await expect(page.getByRole("heading", { name: "Priya Raman", level: 1 })).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)
})
