import { test, expect } from "@playwright/test"

// The Employee details screen's look: the Administrator's view of one active
// record, answered with fixed data so the screenshot does not change when other
// journeys add or change records.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@demo.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DemoOnly-Admin-2026!"

const EMPLOYEE = {
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
}

test("the employee detail page keeps its look", async ({ page }) => {
  await page.route("**/api/employees/3", (route) =>
    route.fulfill({ json: { view_kind: "ADMIN", employee: EMPLOYEE } }),
  )

  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto("/employees/3")
  await expect(page.getByRole("heading", { name: "Priya Raman", level: 1 })).toBeVisible()

  await expect(page).toHaveScreenshot("employee-detail.png", { animations: "disabled" })
})
