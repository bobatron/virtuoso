/**
 * Playwright E2E tests for Virtuoso
 * Tests the account management functionality in the Electron app
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright-core';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined)
  ) as Record<string, string>;

  electronApp = await electron.launch({
    args: [path.join(__dirname, '../dist/main/main/main.js')],
    env: {
      ...baseEnv,
      NODE_ENV: 'development',
    },
  });

  // Wait for the first window
  page = await electronApp.firstWindow();
  
  // Wait for the app to be ready
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.app-container', { timeout: 10000 });
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Account Management', () => {
  test('should display the Add Account button', async () => {
    const addButton = page.locator('.add-account-btn');
    await expect(addButton).toBeVisible();
    await expect(addButton).toContainText('Add Account');
  });

  test('should open add account form when clicking Add Account', async () => {
    const addButton = page.locator('.add-account-btn');
    await addButton.click();

    // Form should appear
    const form = page.locator('.form-container');
    await expect(form).toBeVisible();

    // Check form title
    const title = page.locator('.content-title');
    await expect(title).toContainText('Add New Account');
  });

  test('should be able to type in Account ID field after opening form', async () => {
    // First make sure form is open
    const addButton = page.locator('.add-account-btn');
    await addButton.click();
    
    // Wait a moment for React to update
    await page.waitForTimeout(100);

    // Find the Account ID input
    const accountIdInput = page.locator('input[name="id"]');
    await expect(accountIdInput).toBeVisible();
    
    // Clear and type in it
    await accountIdInput.clear();
    await accountIdInput.fill('test-account');
    
    // Verify the value was set
    await expect(accountIdInput).toHaveValue('test-account');
  });

  test('should be able to fill out the complete add account form', async () => {
    const addButton = page.locator('.add-account-btn');
    await addButton.click();
    
    await page.waitForTimeout(100);

    // Fill out the form
    await page.locator('input[name="id"]').clear();
    await page.locator('input[name="id"]').fill('e2e-test-account');
    await page.locator('input[name="jid"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('password123');
    await page.locator('input[name="host"]').fill('localhost');
    await page.locator('input[name="port"]').clear();
    await page.locator('input[name="port"]').fill('5222');

    // Check all fields have values
    await expect(page.locator('input[name="id"]')).toHaveValue('e2e-test-account');
    await expect(page.locator('input[name="jid"]')).toHaveValue('test@example.com');
    await expect(page.locator('input[name="password"]')).toHaveValue('password123');
  });
});

test.describe('Confirm Dialog Focus Bug', () => {
  test('form inputs should be editable after cancelling delete dialog', async () => {
    // Step 1: Add an account first
    const addButton = page.locator('.add-account-btn');
    await addButton.click();
    await page.waitForTimeout(100);
    
    await page.locator('input[name="id"]').clear();
    await page.locator('input[name="id"]').fill('focus-test');
    await page.locator('input[name="jid"]').fill('focus@example.com');
    await page.locator('input[name="password"]').fill('password');
    await page.locator('input[name="host"]').fill('localhost');

    // Submit the form
    await page.locator('button[type="submit"]').click();
    
    // Wait for account to appear in list
    await page.waitForSelector('.account-item', { timeout: 5000 });
    
    // Step 2: Select the account
    const accountItem = page.locator('.account-item').filter({ hasText: 'focus-test' });
    await accountItem.click();
    
    // Step 3: Click Delete and cancel via modal
    const deleteButton = page.locator('button').filter({ hasText: 'Delete' });
    await deleteButton.click();

    const modal = page.locator('.modal-overlay .modal-content');
    await expect(modal).toBeVisible();
    await modal.locator('.clear-btn').click();
    await expect(modal).toBeHidden();
    
    // Step 5: Click Add Account
    await addButton.click();
    await page.waitForTimeout(100);
    
    // Step 6: Try to type in the form - THIS WAS THE BUG
    const accountIdInput = page.locator('input[name="id"]');
    await expect(accountIdInput).toBeVisible();
    
    // This should work now after the fix
    await accountIdInput.clear();
    await accountIdInput.fill('after-cancel-test');
    
    // Verify the value was set (if this fails, the focus bug is still present)
    await expect(accountIdInput).toHaveValue('after-cancel-test');
  });

  test('form inputs should be editable after confirming delete dialog', async () => {
    // Step 1: Add an account to delete
    const addButton = page.locator('.add-account-btn');
    await addButton.click();
    await page.waitForTimeout(100);
    
    await page.locator('input[name="id"]').clear();
    await page.locator('input[name="id"]').fill('delete-me');
    await page.locator('input[name="jid"]').fill('delete@example.com');
    await page.locator('input[name="password"]').fill('password');
    await page.locator('input[name="host"]').fill('localhost');

    // Submit the form
    await page.locator('button[type="submit"]').click();
    
    // Wait for account to appear
    await page.waitForSelector('.account-item', { timeout: 5000 });
    
    // Step 2: Select and delete the account
    const accountItem = page.locator('.account-item').filter({ hasText: 'delete-me' });
    await accountItem.click();
    
    const deleteButton = page.locator('button').filter({ hasText: 'Delete' });
    await deleteButton.click();

    const modal = page.locator('.modal-overlay .modal-content');
    await expect(modal).toBeVisible();
    await modal.locator('.delete-account-btn').click();
    await expect(modal).toBeHidden();

    // Wait for delete to complete
    await page.waitForTimeout(500);
    
    // Step 3: Click Add Account again
    await addButton.click();
    await page.waitForTimeout(100);
    
    // Step 4: Form should be editable
    const accountIdInput = page.locator('input[name="id"]');
    await expect(accountIdInput).toBeVisible();
    
    await accountIdInput.clear();
    await accountIdInput.fill('new-after-delete');
    
    await expect(accountIdInput).toHaveValue('new-after-delete');
  });
});
