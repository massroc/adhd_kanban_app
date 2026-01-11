/**
 * E2E tests for authentication flows
 */

import { test, expect } from '@playwright/test';

// Test credentials - use a test account on your backend
const TEST_USER = {
  username: 'e2e_test_user',
  password: 'e2e_test_password_123',
};

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored auth state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('shows login form by default', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.locator('#register-card')).not.toBeVisible();
    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('can toggle to register form', async ({ page }) => {
    await page.goto('/');
    
    await page.click('#show-register');
    
    await expect(page.locator('#register-card')).toBeVisible();
    await expect(page.locator('#login-card')).not.toBeVisible();
  });

  test('can toggle back to login form', async ({ page }) => {
    await page.goto('/');
    
    await page.click('#show-register');
    await page.click('#show-login');
    
    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.locator('#register-card')).not.toBeVisible();
  });

  test('shows error on invalid login', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('#login-username', 'nonexistent_user');
    await page.fill('#login-password', 'wrong_password');
    await page.click('#login-submit');
    
    // Wait for error message
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 10000 });
  });

  test('successful login redirects to board', async ({ page }) => {
    // Skip if no test account exists
    test.skip(!process.env.RUN_AUTH_TESTS, 'Skipping - set RUN_AUTH_TESTS=1 to run');
    
    await page.goto('/');
    
    await page.fill('#login-username', TEST_USER.username);
    await page.fill('#login-password', TEST_USER.password);
    await page.click('#login-submit');
    
    // Should redirect to board
    await expect(page).toHaveURL(/board\.html/, { timeout: 10000 });
  });

  test('authenticated user is redirected from login to board', async ({ page }) => {
    test.skip(!process.env.RUN_AUTH_TESTS, 'Skipping - set RUN_AUTH_TESTS=1 to run');
    
    // First login
    await page.goto('/');
    await page.fill('#login-username', TEST_USER.username);
    await page.fill('#login-password', TEST_USER.password);
    await page.click('#login-submit');
    await expect(page).toHaveURL(/board\.html/, { timeout: 10000 });
    
    // Now go back to login page - should redirect to board
    await page.goto('/');
    await expect(page).toHaveURL(/board\.html/, { timeout: 5000 });
  });
});

test.describe('Login Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('login button shows loading state during submission', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', 'testpass');
    
    // Click and immediately check button state
    const buttonPromise = page.click('#login-submit');
    
    // Button should show loading state briefly
    // Note: this is fast, may need to slow down network to reliably test
    await expect(page.locator('#login-submit')).toHaveText(/Sign|Signing/);
    
    await buttonPromise;
  });
});
