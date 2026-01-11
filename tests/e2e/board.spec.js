/**
 * E2E tests for board functionality
 * 
 * These tests require authentication. 
 * Set RUN_BOARD_TESTS=1 and configure TEST_USER credentials.
 */

import { test, expect } from '@playwright/test';

// Test credentials - configure for your environment
const TEST_USER = {
  username: process.env.TEST_USERNAME || 'e2e_test_user',
  password: process.env.TEST_PASSWORD || 'e2e_test_password_123',
};

test.describe('Board', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.RUN_BOARD_TESTS, 'Skipping - set RUN_BOARD_TESTS=1 to run');
    
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    // Login
    await page.fill('#login-username', TEST_USER.username);
    await page.fill('#login-password', TEST_USER.password);
    await page.click('#login-submit');
    
    // Wait for board to load
    await expect(page).toHaveURL(/board\.html/, { timeout: 15000 });
    await expect(page.locator('#kanban-board')).toBeVisible({ timeout: 10000 });
  });

  test('displays kanban board after login', async ({ page }) => {
    await expect(page.locator('#kanban-board')).toBeVisible();
    await expect(page.locator('.column')).toHaveCount({ minimum: 1, timeout: 10000 });
  });

  test('shows user menu with username', async ({ page }) => {
    await expect(page.locator('#user-menu-btn')).toBeVisible();
    await expect(page.locator('#username-display')).toContainText(TEST_USER.username);
  });

  test('can open add task modal', async ({ page }) => {
    await page.click('#add-task-btn');
    
    await expect(page.locator('#task-modal')).toHaveClass(/active/);
    await expect(page.locator('#task-title')).toBeVisible();
  });

  test('can close add task modal', async ({ page }) => {
    await page.click('#add-task-btn');
    await expect(page.locator('#task-modal')).toHaveClass(/active/);
    
    await page.click('#cancel-task-btn');
    
    await expect(page.locator('#task-modal')).not.toHaveClass(/active/);
  });

  test('can create a new task', async ({ page }) => {
    const taskTitle = `Test Task ${Date.now()}`;
    
    await page.click('#add-task-btn');
    await page.fill('#task-title', taskTitle);
    await page.click('#add-task-form button[type="submit"]');
    
    // Task should appear on board
    await expect(page.locator(`.task:has-text("${taskTitle}")`)).toBeVisible({ timeout: 5000 });
  });

  test('can open add column modal', async ({ page }) => {
    // Check if add column button exists (may be hidden if at max columns)
    const addColumnBtn = page.locator('#add-column-btn');
    if (await addColumnBtn.isVisible()) {
      await addColumnBtn.click();
      await expect(page.locator('#column-modal')).toHaveClass(/active/);
    }
  });

  test('logout clears session and redirects', async ({ page }) => {
    await page.click('#user-menu-btn');
    await page.click('#logout-btn');
    
    await expect(page).toHaveURL(/index\.html|\/$/);
    
    // Verify we're logged out
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeNull();
  });
});

test.describe('Task Operations', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.RUN_BOARD_TESTS, 'Skipping - set RUN_BOARD_TESTS=1 to run');
    
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.fill('#login-username', TEST_USER.username);
    await page.fill('#login-password', TEST_USER.password);
    await page.click('#login-submit');
    await expect(page.locator('#kanban-board')).toBeVisible({ timeout: 15000 });
  });

  test('can edit task via double-click', async ({ page }) => {
    // Create a task first
    const taskTitle = `Edit Test ${Date.now()}`;
    await page.click('#add-task-btn');
    await page.fill('#task-title', taskTitle);
    await page.click('#add-task-form button[type="submit"]');
    
    // Wait for task to appear
    const task = page.locator(`.task:has-text("${taskTitle}")`);
    await expect(task).toBeVisible({ timeout: 5000 });
    
    // Double-click to edit
    await task.locator('.task-title').dblclick();
    
    // Edit modal should open
    await expect(page.locator('#edit-task-modal')).toHaveClass(/active/);
    await expect(page.locator('#edit-task-title')).toHaveValue(taskTitle);
  });

  test('can delete task', async ({ page }) => {
    // Create a task
    const taskTitle = `Delete Test ${Date.now()}`;
    await page.click('#add-task-btn');
    await page.fill('#task-title', taskTitle);
    await page.click('#add-task-form button[type="submit"]');
    
    const task = page.locator(`.task:has-text("${taskTitle}")`);
    await expect(task).toBeVisible({ timeout: 5000 });
    
    // Set up dialog handler
    page.on('dialog', dialog => dialog.accept());
    
    // Click delete button
    await task.locator('.delete-task').click();
    
    // Task should be removed
    await expect(task).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.RUN_BOARD_TESTS, 'Skipping - set RUN_BOARD_TESTS=1 to run');
    
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.fill('#login-username', TEST_USER.username);
    await page.fill('#login-password', TEST_USER.password);
    await page.click('#login-submit');
    await expect(page.locator('#kanban-board')).toBeVisible({ timeout: 15000 });
  });

  test('task is draggable', async ({ page }) => {
    // Create a task
    const taskTitle = `Drag Test ${Date.now()}`;
    await page.click('#add-task-btn');
    await page.fill('#task-title', taskTitle);
    await page.click('#add-task-form button[type="submit"]');
    
    const task = page.locator(`.task:has-text("${taskTitle}")`);
    await expect(task).toBeVisible({ timeout: 5000 });
    
    // Check draggable attribute
    await expect(task).toHaveAttribute('draggable', 'true');
  });

  test('can drag task between columns', async ({ page }) => {
    // This test assumes at least 2 columns exist
    const columns = page.locator('.column');
    const columnCount = await columns.count();
    
    test.skip(columnCount < 2, 'Need at least 2 columns for this test');
    
    // Create a task in first column
    const taskTitle = `Move Test ${Date.now()}`;
    const firstColumn = columns.first();
    const secondColumn = columns.nth(1);
    
    // Open modal and select first column
    await page.click('#add-task-btn');
    await page.fill('#task-title', taskTitle);
    
    // Get first column ID and select it
    const firstColumnId = await firstColumn.getAttribute('data-column-id');
    await page.selectOption('#task-column', firstColumnId);
    await page.click('#add-task-form button[type="submit"]');
    
    // Verify task is in first column
    await expect(firstColumn.locator(`.task:has-text("${taskTitle}")`)).toBeVisible({ timeout: 5000 });
    
    // Drag to second column
    const task = firstColumn.locator(`.task:has-text("${taskTitle}")`);
    const targetTasks = secondColumn.locator('.tasks');
    
    await task.dragTo(targetTasks);
    
    // Wait a moment for the API call
    await page.waitForTimeout(1000);
    
    // Task should now be in second column
    await expect(secondColumn.locator(`.task:has-text("${taskTitle}")`)).toBeVisible({ timeout: 5000 });
  });

  test('column has drag handle', async ({ page }) => {
    const column = page.locator('.column').first();
    await expect(column.locator('.drag-handle')).toBeVisible();
  });
});
