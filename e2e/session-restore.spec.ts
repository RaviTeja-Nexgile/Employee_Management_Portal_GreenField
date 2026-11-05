import { test, expect } from "@playwright/test"

// Requirement 1.9: while a person is signed in, reloading the page restores
// their session and shows the same screen. The Login page is built by its own
// task, so the session is started through the API the app itself calls.
test("a signed-in person keeps their session after a reload", async ({ page }) => {
  await page.goto("/login")

  const login = await page.request.post("/api/auth/login", {
    headers: { "X-EMS-Request": "1" },
    data: {
      email: "admin@demo.test",
      password: process.env.E2E_ADMIN_PASSWORD ?? "DemoOnly-Admin-2026!",
    },
  })
  expect(login.status()).toBe(200)

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Hello, Avery Administrator" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible()

  await page.reload()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { name: "Hello, Avery Administrator" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible()
  await expect(page.getByText("Avery Administrator", { exact: true })).toBeVisible()
})
