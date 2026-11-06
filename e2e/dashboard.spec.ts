import { test, expect } from "@playwright/test"

// The Dashboard journeys. Each test covers one rule of the Dashboard
// requirement (2.1-2.6). The seeded demo logins come from design.md's
// "Test logins"; a journey reads them from its E2E_ variable with the seeded
// value as the fallback when the variable is unset.

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

// Rule 2.1: the Administrator sees the greeting, a subtitle, the three summary
// cards (total, active, inactive) and an Open Employees action that opens
// /employees.
test("the Administrator sees the summary cards and Open Employees opens /employees", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await expect(page.getByRole("heading", { name: "Hello, Avery Administrator" })).toBeVisible()
  await expect(page.getByText("Here is how the company looks today.")).toBeVisible()

  const total = page.locator(".stat-card").filter({ hasText: /^Total records/ })
  const active = page.locator(".stat-card").filter({ hasText: /^Active records/ })
  const inactive = page.locator(".stat-card").filter({ hasText: /^Inactive records/ })
  await expect(total).toBeVisible()
  await expect(active).toBeVisible()
  await expect(inactive).toBeVisible()
  await expect(total.locator(".stat-card__value")).toHaveText(/^\d+$/)
  await expect(active.locator(".stat-card__value")).toHaveText(/^\d+$/)
  await expect(inactive.locator(".stat-card__value")).toHaveText(/^\d+$/)

  const openEmployees = page.getByRole("link", { name: "Open Employees" })
  await expect(openEmployees).toHaveAttribute("href", "/employees")
  await openEmployees.click()
  await expect(page).toHaveURL(/\/employees$/)
})

// Rule 2.2: the Manager sees the greeting, a subtitle, the active direct-report
// count, their own department and job title, and Open my direct reports opens
// /employees?team_only=true.
test("the Manager sees the direct-report count, department and job title", async ({ page }) => {
  await signIn(page, MANAGER_EMAIL, MANAGER_PASSWORD)

  await expect(page.getByRole("heading", { name: "Hello, Morgan Manager" })).toBeVisible()
  await expect(page.getByText("Here is your team at a glance.")).toBeVisible()

  const reports = page.locator(".stat-card").filter({ hasText: "Active direct reports" })
  await expect(reports.locator(".stat-card__value")).toHaveText(/^\d+$/)
  await expect(page.locator(".stat-card").filter({ hasText: "Department" })).toContainText("Engineering")
  await expect(page.locator(".stat-card").filter({ hasText: "Job title" })).toContainText("Engineering Manager")

  const openReports = page.getByRole("link", { name: "Open my direct reports" })
  await expect(openReports).toHaveAttribute("href", "/employees?team_only=true")
  await openReports.click()
  await expect(page).toHaveURL(/\/employees\?team_only=true$/)
})

// Rule 2.3: the Employee sees the greeting, a subtitle, their own department,
// their own job title and their Active status, and Open My Profile opens
// /my-profile.
test("the Employee sees the department, job title and Active status", async ({ page }) => {
  await signIn(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)

  await expect(page.getByRole("heading", { name: "Hello, Elliot Employee" })).toBeVisible()
  await expect(page.getByText("Here is your employment summary.")).toBeVisible()

  await expect(page.locator(".stat-card").filter({ hasText: "Department" })).toContainText("Engineering")
  await expect(page.locator(".stat-card").filter({ hasText: "Job title" })).toContainText("Software Engineer")
  await expect(page.locator(".stat-card").filter({ hasText: "Status" })).toContainText("Active")

  const openProfile = page.getByRole("link", { name: "Open My Profile" })
  await expect(openProfile).toHaveAttribute("href", "/my-profile")
  await openProfile.click()
  await expect(page).toHaveURL(/\/my-profile$/)
})

// Rule 2.4: while the dashboard figures load, skeleton placeholders show in
// place of the cards. The answer is held back so the loading state is visible.
test("skeleton placeholders show while the dashboard figures load", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.route("**/api/dashboard", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({
      json: { role: "ADMIN", total_employees: 7, active_employees: 6, inactive_employees: 1 },
    })
  })
  await page.reload()

  const skeletons = page.locator(".skeleton-card")
  await expect(skeletons).toHaveCount(3)
  await expect(skeletons.first()).toBeVisible()
  await expect(page.locator(".stat-card")).toHaveCount(0)

  await expect(page.locator(".stat-card")).toHaveCount(3)
  await expect(skeletons).toHaveCount(0)
})

// Rule 2.5: when the dashboard request fails, an error notice with a Retry
// button shows, and Retry sends the request again.
test("a failed dashboard request shows an error notice and Retry sends it again", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  let calls = 0
  await page.route("**/api/dashboard", async (route) => {
    calls += 1
    if (calls === 1) {
      await route.fulfill({ status: 503, json: { detail: "The service is temporarily unavailable. Try again." } })
    } else {
      await route.fulfill({
        json: { role: "ADMIN", total_employees: 7, active_employees: 6, inactive_employees: 1 },
      })
    }
  })
  await page.reload()

  const notice = page.getByRole("alert")
  await expect(notice).toBeVisible()
  await expect(notice).toContainText("Something went wrong. Try again.")
  const retry = page.getByRole("button", { name: "Retry" })
  await expect(retry).toBeVisible()

  await retry.click()
  await expect(page.locator(".stat-card")).toHaveCount(3)
  await expect(notice).toHaveCount(0)
  expect(calls).toBeGreaterThanOrEqual(2)
})

// Rule 2.6: a Manager or an Employee sees no company-wide total of employees.
test("the Manager and the Employee see no company-wide total", async ({ browser }) => {
  const manager = await (await browser.newContext()).newPage()
  await signIn(manager, MANAGER_EMAIL, MANAGER_PASSWORD)
  await expect(manager.getByText("Total records")).toHaveCount(0)
  await expect(manager.getByText(/total employees/i)).toHaveCount(0)
  await manager.context().close()

  const employee = await (await browser.newContext()).newPage()
  await signIn(employee, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
  await expect(employee.getByText("Total records")).toHaveCount(0)
  await expect(employee.getByText(/total employees/i)).toHaveCount(0)
  await employee.context().close()
})
