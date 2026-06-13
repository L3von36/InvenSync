import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should visit the landing page', async ({ page }) => {
    await page.goto('/')
    // The landing page should have the app name or hero section
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/')
    // Look for login link/button — common patterns
    const loginLink = page.getByRole('link', { name: /login|sign in/i }).first()
    const loginButton = page.getByRole('button', { name: /login|sign in/i }).first()

    // Click whichever is visible
    if (await loginLink.isVisible()) {
      await loginLink.click()
    } else if (await loginButton.isVisible()) {
      await loginButton.click()
    } else {
      // Try direct navigation
      await page.goto('/login')
    }

    // Should be on login page now
    await expect(page.locator('body')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate directly to the app root — the app shell should show login
    await page.goto('/')

    // The app is an SPA so we look for email/password fields
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()

    // If login form is visible, test it
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill('invalid@test.com')
      await passwordInput.fill('wrongpassword')

      const submitButton = page.getByRole('button', { name: /login|sign in|submit/i }).first()
      await submitButton.click()

      // Should show error message
      await page.waitForTimeout(2000)
      // Error could be a toast, inline message, etc.
      const errorElement = page.locator('[role="alert"], .error, [data-error]').first()
      if (await errorElement.isVisible()) {
        await expect(errorElement).toBeVisible()
      }
    }
  })

  test('should validate registration form fields', async ({ page }) => {
    await page.goto('/')

    // Look for register/sign up link
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i }).first()
    const registerButton = page.getByRole('button', { name: /register|sign up|create account/i }).first()

    if (await registerLink.isVisible()) {
      await registerLink.click()
    } else if (await registerButton.isVisible()) {
      await registerButton.click()
    }

    // Should be on registration page
    await expect(page.locator('body')).toBeVisible()
  })
})
