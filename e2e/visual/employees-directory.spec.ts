import { test, expect } from "@playwright/test"

// The Employees directory's look: the Administrator's directory with fixed
// records, so the screenshot does not change when other journeys add or change
// records.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@demo.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DemoOnly-Admin-2026!"

const ITEMS = [
  {
    id: 1,
    employee_code: "EMP-0001",
    full_name: "Avery Administrator",
    work_email: "admin@demo.test",
    job_title: "Head of People",
    department: "People",
    is_active: true,
  },
  {
    id: 2,
    employee_code: "EMP-0002",
    full_name: "Morgan Manager",
    work_email: "manager@demo.test",
    job_title: "Engineering Manager",
    department: "Engineering",
    is_active: true,
  },
  {
    id: 3,
    employee_code: "EMP-0003",
    full_name: "Priya Patel",
    work_email: "priya.patel@demo.test",
    job_title: "Software Engineer",
    department: "Engineering",
    is_active: true,
  },
]

test("the Administrator directory keeps its look", async ({ page }) => {
  await page.route("**/api/employees*", (route) =>
    route.fulfill({
      json: { items: ITEMS, page: 1, page_size: 25, total: ITEMS.length },
    }),
  )

  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto("/employees")
  await expect(page.locator("tbody tr")).toHaveCount(3)

  await expect(page).toHaveScreenshot("employees-directory.png", { animations: "disabled" })
})
