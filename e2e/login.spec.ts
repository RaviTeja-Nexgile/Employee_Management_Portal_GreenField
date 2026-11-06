import { test, expect } from "@playwright/test"

// The Login page journeys. Each test covers one rule of the Login requirement
// (1.1-1.8, 1.10). The seeded demo logins come from design.md's "Test logins";
// a journey reads them from its E2E_ variable with the seeded value as the
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
}

// Rule 1.1: opening / shows the Login page at /login with a centered card
// holding the email field, the password field, a Show/Hide password control
// and a full-width Sign in button, and no sign-up link, role selector or
// password-reset link.
test("opening / shows the Login page with its card and controls", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  await expect(page.getByText("Employee Management", { exact: true })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Show password" })).toBeVisible()
  const signInButton = page.getByRole("button", { name: "Sign in" })
  await expect(signInButton).toBeVisible()

  // The Sign in button spans the card's content width.
  const card = page.locator("form").locator("..")
  const cardBox = await card.boundingBox()
  const buttonBox = await signInButton.boundingBox()
  expect(cardBox).not.toBeNull()
  expect(buttonBox).not.toBeNull()
  expect(buttonBox!.width).toBeGreaterThan(cardBox!.width * 0.85)

  // No sign-up link, role selector or password-reset link.
  await expect(page.getByRole("link", { name: /sign up|register|create account/i })).toHaveCount(0)
  await expect(page.getByRole("link", { name: /forgot|reset password/i })).toHaveCount(0)
  await expect(page.getByRole("combobox")).toHaveCount(0)
})

// Rule 1.2: submitting with an empty email or password shows a text error
// beside each empty field and sends no request.
test("submitting an empty form shows a field error and sends no request", async ({ page }) => {
  const loginRequests: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/login")) loginRequests.push(request.url())
  })

  await page.goto("/login")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByText("Enter your email address.")).toBeVisible()
  await expect(page.getByText("Enter your password.")).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  expect(loginRequests).toHaveLength(0)
})

// Rule 1.3: the Administrator's seeded login signs in and opens /dashboard.
test("the Administrator signs in and opens the Dashboard", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { name: "Hello, Avery Administrator" })).toBeVisible()
})

// Rule 1.4: the Manager's seeded login signs in and opens /dashboard.
test("the Manager signs in and opens the Dashboard", async ({ page }) => {
  await signIn(page, MANAGER_EMAIL, MANAGER_PASSWORD)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible()
})

// Rule 1.5: the Employee's seeded login signs in and opens /dashboard.
test("the Employee signs in and opens the Dashboard", async ({ page }) => {
  await signIn(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible()
})

// Rule 1.6: an unknown email or a wrong password shows the shared message and
// stays on the Login page.
test("a wrong password shows the incorrect message and stays on Login", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, "definitely-not-the-password")
  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect.")
  await expect(page).toHaveURL(/\/login$/)
})

test("an unknown email shows the incorrect message and stays on Login", async ({ page }) => {
  await signIn(page, "nobody@demo.test", "whatever-password")
  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect.")
  await expect(page).toHaveURL(/\/login$/)
})

// Rule 1.7: while signed in, opening /login redirects to /dashboard.
test("a signed-in person opening /login is redirected to the Dashboard", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto("/login")
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { name: "Hello, Avery Administrator" })).toBeVisible()
})

// Rule 1.8: Logout in the top bar ends the session, clears the signed-in state
// and opens the Login page.
test("Logout ends the session and opens the Login page", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole("button", { name: "Logout" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()

  // The signed-in state is gone: opening a protected page returns to Login.
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/login$/)
})

// Rule 1.10: clicking Sign in disables the button until the answer arrives and
// shows a submitting indicator.
test("Sign in is disabled with a submitting indicator until the answer arrives", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD)

  // Hold the login answer so the submitting state can be observed.
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/auth/login", async (route) => {
    await held
    await route.continue()
  })

  await page.getByRole("button", { name: "Sign in" }).click()

  const submitting = page.getByRole("button", { name: /Signing in/ })
  await expect(submitting).toBeVisible()
  await expect(submitting).toBeDisabled()
  await expect(submitting).toHaveAttribute("aria-busy", "true")

  release()
  await expect(page).toHaveURL(/\/dashboard$/)
})
