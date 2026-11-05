import { test, expect } from "@playwright/test"

// Requirement 9.3: while a person is signed in the app shows a 220 px sidebar
// with Dashboard, Employees and My Profile and a top bar with the account
// name, the role and Logout. Requirement 9.4: below 768 px the sidebar becomes
// a compact top navigation and the page never scrolls sideways.
test("the signed-in shell shows the navigation, the account and Logout", async ({ page }) => {
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
  const nav = page.getByRole("navigation", { name: "Main" })
  await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Employees" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "My Profile" })).toBeVisible()
  await expect(page.getByText("Avery Administrator", { exact: true })).toBeVisible()
  await expect(page.getByText("Administrator", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible()

  const sidebar = page.locator("aside.sidebar")
  const box = await sidebar.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return { width: Math.round(rect.width), height: Math.round(rect.height) }
  })
  if (page.viewportSize()!.width >= 768) {
    expect(box.width).toBe(220)
  } else {
    // A compact top navigation: full width and only a bar tall.
    expect(box.width).toBe(page.viewportSize()!.width)
    expect(box.height).toBeLessThan(80)
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test("the app renders its text in IBM Plex Sans", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  const family = await page
    .getByRole("heading", { name: "Welcome back" })
    .evaluate((el) => getComputedStyle(el).fontFamily)
  expect(family).toContain("IBM Plex Sans")
})
