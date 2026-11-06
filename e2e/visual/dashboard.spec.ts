import { test, expect } from "@playwright/test"

// The Dashboard's look: the Administrator's dashboard with fixed figures, so
// the screenshot does not change when other journeys add or change records.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@demo.test"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DemoOnly-Admin-2026!"

test("the Administrator dashboard keeps its look", async ({ page }) => {
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      json: { role: "ADMIN", total_employees: 7, active_employees: 6, inactive_employees: 1 },
    }),
  )

  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator(".stat-card")).toHaveCount(3)

  await expect(page).toHaveScreenshot("dashboard.png", { animations: "disabled" })
})
