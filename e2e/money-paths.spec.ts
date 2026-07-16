import { test, expect, type Page } from '@playwright/test'

// ============================================
// Money-path E2E tests
// ============================================
// The flows the business dies without: create product, record sale
// (with stock decrement), record expense. These MUTATE data, so they
// only run when E2E_EMAIL / E2E_PASSWORD point at a test account —
// never point them at a real business's account.
//
// Each run uses a unique product name (E2E-<timestamp>) so repeated
// runs don't collide and leftovers are identifiable for cleanup.

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe('Money paths (authenticated, mutating)', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run money-path tests')

  // Serialize: the sale test depends on the product created before it
  test.describe.configure({ mode: 'serial' })

  const productName = `E2E-${Date.now()}`
  const initialStock = 100
  const saleQty = 2

  async function login(page: Page) {
    await page.goto('/')
    await page.getByPlaceholder(/email/i).fill(email!)
    await page.getByPlaceholder(/password/i).fill(password!)
    await page.getByRole('button', { name: /sign in|log ?in/i }).click()
    await page.locator('nav, [role="navigation"]').first().waitFor({ timeout: 15000 })
  }

  async function goToPage(page: Page, name: RegExp) {
    // SPA navigation via the sidebar/bottom nav
    await page.getByRole('navigation').getByText(name).first().click()
  }

  test('create a product', async ({ page }) => {
    await login(page)
    await goToPage(page, /products/i)

    await page.getByRole('button', { name: /add product/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/add product/i).first()).toBeVisible()

    // Product type — pick the first available option
    await dialog.getByRole('combobox').first().click()
    await page.getByRole('option').first().click()

    await dialog.getByLabel(/name/i).first().fill(productName)
    await dialog.getByLabel(/cost price/i).fill('50')
    await dialog.getByLabel(/selling price/i).fill('80')
    await dialog.getByLabel(/quantity/i).first().fill(String(initialStock))

    await dialog.getByRole('button', { name: /create|save/i }).last().click()

    // Success feedback + product visible in the list
    await expect(page.getByText(/product created successfully/i)).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder(/search/i).first().fill(productName)
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 })
  })

  test('record a sale and verify stock decrements', async ({ page }) => {
    await login(page)
    await goToPage(page, /sales/i)

    await page.getByRole('tab', { name: /create sale/i }).click()
    await page.getByRole('button', { name: /add item/i }).click()

    // Product select — search for our E2E product in the dropdown
    await page.getByRole('combobox').filter({ hasText: /select product/i }).first().click()
    await page.getByRole('option', { name: new RegExp(productName) }).click()

    // Quantity
    const qtyInput = page.locator('input[type="number"]').first()
    await qtyInput.fill(String(saleQty))

    await page.getByRole('button', { name: /complete sale/i }).click()

    // Success feedback (toast or invoice confirmation)
    await expect(
      page.getByText(/sale (completed|created|recorded)|invoice/i).first()
    ).toBeVisible({ timeout: 15000 })

    // Verify stock decremented on the products page
    await goToPage(page, /products/i)
    await page.getByPlaceholder(/search/i).first().fill(productName)
    const row = page.locator('tr, [data-slot=card]').filter({ hasText: productName }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await expect(row.getByText(String(initialStock - saleQty))).toBeVisible()
  })

  test('record an expense', async ({ page }) => {
    await login(page)
    await goToPage(page, /expenses/i)

    await page.getByRole('button', { name: /add expense/i }).first().click()
    const dialog = page.getByRole('dialog')

    // Category select
    await dialog.getByRole('combobox').filter({ hasText: /select category/i }).first().click()
    await page.getByRole('option').first().click()

    // Amount — first numeric input in the dialog
    await dialog.locator('input[type="number"]').first().fill('123.45')

    await dialog.getByRole('button', { name: /add|save|create/i }).last().click()

    await expect(page.getByText(/expense (added|created|recorded)/i)).toBeVisible({ timeout: 15000 })
  })
})
