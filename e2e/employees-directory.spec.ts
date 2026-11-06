import { test, expect } from "@playwright/test"

// The Employees directory journeys. Each test covers one rule of the directory
// requirement (3.1-3.10). The seeded demo logins come from design.md's
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

// A fixed directory answer, so the journeys do not depend on the seed data or
// on records other journeys add.
function directoryItems(count: number, startId = 1) {
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index
    return {
      id,
      employee_code: `EMP-${String(id).padStart(4, "0")}`,
      full_name: `Person ${String(id).padStart(2, "0")}`,
      work_email: `person${id}@demo.test`,
      job_title: "Engineer",
      department: "Engineering",
      is_active: true,
    }
  })
}

// Rule 3.1: the title, the search box, the five columns and pagination with 25
// rows per page.
test("the directory shows the title, the search box, the five columns and 25 rows per page", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.route("**/api/employees*", (route) =>
    route.fulfill({
      json: { items: directoryItems(25), page: 1, page_size: 25, total: 60 },
    }),
  )
  await page.goto("/employees")

  await expect(page.getByRole("heading", { name: "Employees", level: 1 })).toBeVisible()
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible()

  const headers = page.getByRole("columnheader")
  await expect(headers.filter({ hasText: "Name" })).toHaveCount(1)
  await expect(headers.filter({ hasText: "Employee code" })).toHaveCount(1)
  await expect(headers.filter({ hasText: "Work email" })).toHaveCount(1)
  await expect(headers.filter({ hasText: "Job title" })).toHaveCount(1)
  await expect(headers.filter({ hasText: "Department" })).toHaveCount(1)

  await expect(page.locator("tbody tr")).toHaveCount(25)
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible()
  await expect(page.getByText("Page 1 of 3 · 60 employees")).toBeVisible()
})

// Rule 3.2: the search filters by name or work email, ignoring case, about
// 250 ms after the last keystroke, and resets the table to page 1.
test("the search filters by name or work email, ignoring case, and resets to page 1", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  const requests: string[] = []
  await page.route("**/api/employees*", async (route) => {
    const url = new URL(route.request().url())
    requests.push(url.search)
    const q = (url.searchParams.get("q") ?? "").toLowerCase()
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const all = directoryItems(60)
    const matched = q
      ? all.filter(
          (item) =>
            item.full_name.toLowerCase().includes(q) || item.work_email.toLowerCase().includes(q),
        )
      : all
    const start = (pageNumber - 1) * 25
    await route.fulfill({
      json: {
        items: matched.slice(start, start + 25),
        page: pageNumber,
        page_size: 25,
        total: matched.length,
      },
    })
  })

  await page.goto("/employees?page=2")
  await expect(page.getByText("Page 2 of 3 · 60 employees")).toBeVisible()

  // Typed in upper case, matched against the lower-case names and emails.
  await page.getByRole("searchbox", { name: "Search" }).fill("PERSON 42")
  await expect(page).toHaveURL(/[?&]q=PERSON\+42/)
  await expect(page).not.toHaveURL(/[?&]page=/)
  await expect(page.getByText("Page 1 of 1 · 1 employee")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Person 42" })).toBeVisible()

  // A work-email fragment matches too.
  await page.getByRole("searchbox", { name: "Search" }).fill("person7@")
  await expect(page.getByText("Page 1 of 1 · 1 employee")).toBeVisible()
  await expect(page.getByRole("link", { name: "Person 07" })).toBeVisible()

  // The debounce: one request carries the final text, not one per keystroke.
  const searchRequests = requests.filter((search) => search.includes("q="))
  expect(searchRequests.length).toBeLessThanOrEqual(3)
})

// Rule 3.3: clicking a page number shows that page and keeps the search text,
// the filters and the page in the address.
test("a page number shows that page and keeps the search, filters and page in the address", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.route("**/api/employees*", async (route) => {
    const url = new URL(route.request().url())
    const q = (url.searchParams.get("q") ?? "").toLowerCase()
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const all = directoryItems(60)
    const matched = q
      ? all.filter(
          (item) =>
            item.full_name.toLowerCase().includes(q) || item.work_email.toLowerCase().includes(q),
        )
      : all
    const start = (pageNumber - 1) * 25
    await route.fulfill({
      json: {
        items: matched.slice(start, start + 25),
        page: pageNumber,
        page_size: 25,
        total: matched.length,
      },
    })
  })

  await page.goto("/employees?q=person&include_inactive=true")
  await expect(page.getByText("Page 1 of 3 · 60 employees")).toBeVisible()

  // On a phone the table scrolls sideways inside its own box; bring the
  // pagination into view and tap the button where it sits, as a person would.
  const pagination = page.getByRole("navigation", { name: "Pagination" })
  await pagination.scrollIntoViewIfNeeded()
  const pageTwo = pagination.getByRole("button", { name: "2", exact: true })
  const box = await pageTwo.boundingBox()
  if (!box) throw new Error("the page 2 button is not on the page")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page).toHaveURL(/[?&]page=2/)
  await expect(page).toHaveURL(/[?&]q=person/)
  await expect(page).toHaveURL(/[?&]include_inactive=true/)
  await expect(page.getByText("Page 2 of 3 · 60 employees")).toBeVisible()
  await expect(page.getByRole("link", { name: "Person 26" })).toBeVisible()

  // The page survives the debounce window, so the search box does not bounce
  // the table back to page 1.
  await page.waitForTimeout(600)
  await expect(page).toHaveURL(/[?&]page=2/)
  await expect(page.getByText("Page 2 of 3 · 60 employees")).toBeVisible()

  await pagination.scrollIntoViewIfNeeded()
  const nextButton = pagination.getByRole("button", { name: "Next" })
  const nextBox = await nextButton.boundingBox()
  if (!nextBox) throw new Error("the Next button is not on the page")
  await page.mouse.click(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2)
  await expect(page).toHaveURL(/[?&]page=3/)
  await expect(page.getByText("Page 3 of 3 · 60 employees")).toBeVisible()
})

// Rule 3.4: clicking an employee's name opens that employee's detail page.
test("an employee's name opens the detail page at /employees/:id", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.route("**/api/employees*", (route) =>
    route.fulfill({
      json: { items: directoryItems(3), page: 1, page_size: 25, total: 3 },
    }),
  )
  await page.goto("/employees")

  const nameLink = page.getByRole("link", { name: "Person 02" })
  await expect(nameLink).toHaveAttribute("href", "/employees/2")
  await nameLink.click()
  await expect(page).toHaveURL(/\/employees\/2$/)
})

// Rule 3.5: a search that matches nothing shows an empty state with a Clear
// search button and no error.
test("a search with no match shows the empty state with Clear search", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.route("**/api/employees*", async (route) => {
    const url = new URL(route.request().url())
    const q = url.searchParams.get("q")
    await route.fulfill({
      json: q
        ? { items: [], page: 1, page_size: 25, total: 0 }
        : { items: directoryItems(3), page: 1, page_size: 25, total: 3 },
    })
  })

  await page.goto("/employees")
  await expect(page.locator("tbody tr")).toHaveCount(3)

  await page.getByRole("searchbox", { name: "Search" }).fill("nobody-matches-this")
  await expect(page.getByText("No employees match your search.")).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)

  const clear = page.getByRole("button", { name: "Clear search" })
  await expect(clear).toBeVisible()
  await clear.click()
  await expect(page).not.toHaveURL(/[?&]q=/)
  await expect(page.locator("tbody tr")).toHaveCount(3)
})

// Rule 3.6: the Administrator sees the Add employee button, the Include
// inactive checkbox, the Status column and a row action menu, and ticking
// Include inactive lists inactive employees as well.
test("the Administrator sees the admin controls and Include inactive lists inactive employees", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.route("**/api/employees*", async (route) => {
    const url = new URL(route.request().url())
    const includeInactive = url.searchParams.get("include_inactive") === "true"
    const active = directoryItems(2)
    const inactive = { ...directoryItems(1, 9)[0], full_name: "Sam Okafor", is_active: false }
    const items = includeInactive ? [...active, inactive] : active
    await route.fulfill({
      json: { items, page: 1, page_size: 25, total: items.length },
    })
  })

  await page.goto("/employees")

  await expect(page.getByRole("button", { name: "Add employee" })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: "Include inactive" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Actions for Person 01" })).toBeVisible()
  await expect(page.getByText("Inactive", { exact: true })).toHaveCount(0)

  await page.getByRole("checkbox", { name: "Include inactive" }).click()
  await expect(page).toHaveURL(/[?&]include_inactive=true/)
  await expect(page.getByRole("link", { name: "Sam Okafor" })).toBeVisible()
  await expect(page.getByText("Inactive", { exact: true })).toHaveCount(1)

  // The row action menu opens with a View details item.
  await page.getByRole("button", { name: "Actions for Person 01" }).click()
  await expect(page.getByRole("menuitem", { name: "View details" })).toBeVisible()
})

// Rule 3.7: the Manager sees the My direct reports checkbox, and ticking it
// lists only active employees whose manager is the Manager.
test("the Manager's My direct reports lists only their active direct reports", async ({ page }) => {
  await signIn(page, MANAGER_EMAIL, MANAGER_PASSWORD)

  await page.route("**/api/employees*", async (route) => {
    const url = new URL(route.request().url())
    const teamOnly = url.searchParams.get("team_only") === "true"
    const items = teamOnly
      ? [
          { ...directoryItems(1, 4)[0], full_name: "Priya Patel" },
          { ...directoryItems(1, 5)[0], full_name: "Quinn Rivera" },
        ]
      : directoryItems(6)
    await route.fulfill({
      json: { items, page: 1, page_size: 25, total: items.length },
    })
  })

  await page.goto("/employees")

  const teamOnly = page.getByRole("checkbox", { name: "My direct reports" })
  await expect(teamOnly).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(6)

  await teamOnly.click()
  await expect(page).toHaveURL(/[?&]team_only=true/)
  await expect(page.locator("tbody tr")).toHaveCount(2)
  await expect(page.getByRole("link", { name: "Priya Patel" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Quinn Rivera" })).toBeVisible()
  await expect(page.getByText("Page 1 of 1 · 2 employees")).toBeVisible()
})

// Rule 3.8: a Manager or an Employee sees only active employees and no Add
// employee button, no Include inactive checkbox and no row actions.
test("the Manager and the Employee see only active employees and no admin controls", async ({ browser }) => {
  const manager = await (await browser.newContext()).newPage()
  await manager.route("**/api/employees*", (route) =>
    route.fulfill({
      json: { items: directoryItems(4), page: 1, page_size: 25, total: 4 },
    }),
  )
  await signIn(manager, MANAGER_EMAIL, MANAGER_PASSWORD)
  await manager.goto("/employees")
  await expect(manager.locator("tbody tr")).toHaveCount(4)
  await expect(manager.getByRole("button", { name: "Add employee" })).toHaveCount(0)
  await expect(manager.getByRole("checkbox", { name: "Include inactive" })).toHaveCount(0)
  await expect(manager.getByRole("columnheader", { name: "Status" })).toHaveCount(0)
  await expect(manager.getByRole("button", { name: /^Actions for / })).toHaveCount(0)
  await manager.context().close()

  const employee = await (await browser.newContext()).newPage()
  await employee.route("**/api/employees*", (route) =>
    route.fulfill({
      json: { items: directoryItems(4), page: 1, page_size: 25, total: 4 },
    }),
  )
  await signIn(employee, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
  await employee.goto("/employees")
  await expect(employee.locator("tbody tr")).toHaveCount(4)
  await expect(employee.getByRole("button", { name: "Add employee" })).toHaveCount(0)
  await expect(employee.getByRole("checkbox", { name: "Include inactive" })).toHaveCount(0)
  await expect(employee.getByRole("columnheader", { name: "Status" })).toHaveCount(0)
  await expect(employee.getByRole("button", { name: /^Actions for / })).toHaveCount(0)
  await employee.context().close()
})

// Rule 3.9: a failed directory request shows an error notice with a Retry
// button, and Retry sends the request again.
test("a failed directory request shows an error notice and Retry sends it again", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  // The page's own load may send the request more than once, so every request
  // fails until Retry is pressed; then the answer is the directory.
  let failing = true
  let calls = 0
  await page.route("**/api/employees*", async (route) => {
    calls += 1
    if (failing) {
      await route.fulfill({
        status: 503,
        json: { error: { code: "unavailable", message: "The directory could not be loaded. Try again." } },
      })
    } else {
      await route.fulfill({
        json: { items: directoryItems(3), page: 1, page_size: 25, total: 3 },
      })
    }
  })

  await page.goto("/employees")

  const notice = page.getByRole("alert")
  await expect(notice).toBeVisible()
  const retry = page.getByRole("button", { name: "Retry" })
  await expect(retry).toBeVisible()

  failing = false
  await retry.click()
  await expect(page.locator("tbody tr")).toHaveCount(3)
  await expect(notice).toHaveCount(0)
  expect(calls).toBeGreaterThanOrEqual(2)
})

// Rule 3.10: while the directory loads, a loading placeholder shows in place
// of the table rows. The answer is held back so the state is visible.
test("a loading placeholder shows in place of the table rows", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.route("**/api/employees*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({
      json: { items: directoryItems(3), page: 1, page_size: 25, total: 3 },
    })
  })

  await page.goto("/employees")

  const skeletons = page.locator("tbody tr").filter({ has: page.locator("span[class*='skeletonLine']") })
  await expect(skeletons).toHaveCount(5)
  await expect(page.getByRole("link", { name: "Person 01" })).toHaveCount(0)

  await expect(page.getByRole("link", { name: "Person 01" })).toBeVisible()
  await expect(skeletons).toHaveCount(0)
})
